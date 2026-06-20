import asyncio
import os
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict
from bson import ObjectId
import httpx
from groq import AsyncGroq
from dotenv import load_dotenv
import json

from filters import (
    segment_owners,
    enrich_owners_with_last_order,
    compute_restock_prediction,
    format_pet_names,
    build_data_summary_for_chat,
    get_last_orders_map,
    utc_now,
)
from autopilot import get_autopilot_suggestions

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME", "pawlife")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
CHANNEL_SERVICE_URL = os.getenv(
    "CHANNEL_SERVICE_URL", 
    "https://pawlife-channel.onrender.com" if os.getenv("RENDER") else "http://localhost:8001"
)

app = FastAPI(title="PawLife CRM API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = AsyncIOMotorClient(
    MONGO_URL,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=5000,
    maxPoolSize=50,
)
db = client[DB_NAME]
groq_client = AsyncGroq(api_key=GROQ_API_KEY)


def generate_object_id() -> str:
    return str(ObjectId())


PyObjectId = str


# --- Models ---

class PetModel(BaseModel):
    pet_id: str
    pet_name: str
    pet_type: str
    breed: str
    age_years: float
    birthday: str
    weight_kg: float


class PetOwnerModel(BaseModel):
    id: PyObjectId = Field(default_factory=generate_object_id, alias="_id")
    name: str
    email: str
    phone: str
    city: str
    total_orders: int = 0
    total_spent: float = 0.0
    created_at: datetime = Field(default_factory=utc_now)
    pets: List[PetModel] = []

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)


class BulkOwnersRequest(BaseModel):
    owners: List[Dict[str, Any]]


class BulkOrdersRequest(BaseModel):
    orders: List[Dict[str, Any]]


class SegmentManualRequest(BaseModel):
    city: Optional[str] = None
    pet_type: Optional[str] = None
    breed: Optional[str] = None
    min_spent: Optional[float] = None
    max_spent: Optional[float] = None
    last_order_days_ago: Optional[int] = None
    min_orders: Optional[int] = None
    product_category: Optional[str] = None
    days_to_birthday: Optional[int] = None
    pet_age_min: Optional[float] = None
    pet_age_max: Optional[float] = None
    top_spender: Optional[bool] = None
    life_stage_transition: Optional[str] = None


class SegmentAIRequest(BaseModel):
    query: str


class CreateCampaignRequest(BaseModel):
    name: str
    goal: str
    message_template: str
    channel: str
    segment_rule: Dict[str, Any]
    audience_ids: List[str]


class ReceiptRequest(BaseModel):
    message_id: str
    status: str
    timestamp: str


class AIWriteMessageRequest(BaseModel):
    goal: str
    channel: str
    sample_owner_name: str
    sample_pet_name: str
    sample_breed: str
    sample_product: str


class AICampaignInsightRequest(BaseModel):
    campaign_id: str


class AIChatRequest(BaseModel):
    query: str


class AISegmentExplainRequest(BaseModel):
    type: str
    title: str
    description: str
    audience_count: int
    segment_rule: Dict[str, Any]


# --- Startup ---

@app.on_event("startup")
async def create_indexes():
    await db.orders.create_index([("owner_id", 1), ("ordered_at", -1)])
    await db.orders.create_index([("owner_id", 1), ("product_category", 1), ("ordered_at", -1)])
    await db.messages.create_index([("campaign_id", 1)])
    await db.messages.create_index([("campaign_id", 1), ("callback_received", 1)])
    await db.campaigns.create_index([("created_at", -1)])


async def check_campaign_completion(campaign_id: str):
    """Mark campaign completed when no messages are still awaiting callbacks."""
    pending = await db.messages.count_documents({
        "campaign_id": campaign_id,
        "status": {"$in": ["queued", "sent"]},
        "callback_received": False,
    })
    if pending == 0:
        await db.campaigns.update_one(
            {"_id": ObjectId(campaign_id), "status": {"$ne": "completed"}},
            {"$set": {"status": "completed", "completed_at": utc_now()}},
        )


# --- Health ---

@app.get("/")
async def root():
    return {
        "service": "PawLife CRM API",
        "status": "ok",
        "health": "/api/health",
        "docs": "/docs",
    }


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "PawLife CRM API"}


# --- Customers ---

@app.get("/api/customers")
async def get_customers(
    city: Optional[str] = None,
    pet_type: Optional[str] = None,
    breed: Optional[str] = None,
    min_spent: Optional[float] = None,
    max_spent: Optional[float] = None,
    last_order_days_ago: Optional[int] = None,
):
    try:
        filter_rules = {
            k: v for k, v in {
                "city": city,
                "pet_type": pet_type,
                "breed": breed,
                "min_spent": min_spent,
                "max_spent": max_spent,
                "last_order_days_ago": last_order_days_ago,
            }.items() if v is not None
        }
        owners = await segment_owners(db, filter_rules) if filter_rules else [
            {**o, "_id": str(o["_id"])} for o in await db.pet_owners.find().to_list(1000)
        ]
        return await enrich_owners_with_last_order(db, owners)
    except Exception as e:
        logger.error(f"get_customers error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch customers")


@app.get("/api/customers/{owner_id}")
async def get_customer_profile(owner_id: str):
    try:
        owner = await db.pet_owners.find_one({"_id": ObjectId(owner_id)})
        if not owner:
            raise HTTPException(status_code=404, detail="Customer not found")
        owner["_id"] = str(owner["_id"])

        orders = await db.orders.find({"owner_id": owner_id}).sort("ordered_at", -1).to_list(100)
        for order in orders:
            order["_id"] = str(order["_id"])

        owner["orders"] = orders
        owner["restock_prediction"] = compute_restock_prediction(orders)
        return owner
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"get_customer_profile error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch customer profile")


@app.post("/api/customers/bulk")
async def create_bulk_customers(request: BulkOwnersRequest):
    try:
        if not request.owners:
            return {"success": True, "count": 0}
        owners_to_insert = []
        for owner_data in request.owners:
            if "_id" in owner_data:
                owner_data["_id"] = ObjectId(owner_data["_id"])
            owners_to_insert.append(owner_data)
        result = await db.pet_owners.insert_many(owners_to_insert)
        return {"success": True, "count": len(result.inserted_ids)}
    except Exception as e:
        logger.error(f"create_bulk_customers error: {e}")
        raise HTTPException(status_code=500, detail="Failed to insert customers")


# --- Orders ---

@app.post("/api/orders/bulk")
async def create_bulk_orders(request: BulkOrdersRequest):
    try:
        if not request.orders:
            return {"success": True, "count": 0}
        orders_to_insert = []
        for order_data in request.orders:
            if "_id" in order_data:
                order_data["_id"] = ObjectId(order_data["_id"])
            orders_to_insert.append(order_data)
        result = await db.orders.insert_many(orders_to_insert)
        return {"success": True, "count": len(result.inserted_ids)}
    except Exception as e:
        logger.error(f"create_bulk_orders error: {e}")
        raise HTTPException(status_code=500, detail="Failed to insert orders")


@app.get("/api/orders/owner/{owner_id}")
async def get_owner_orders(owner_id: str):
    try:
        orders = await db.orders.find({"owner_id": owner_id}).sort("ordered_at", -1).to_list(1000)
        for order in orders:
            order["_id"] = str(order["_id"])
        return orders
    except Exception as e:
        logger.error(f"get_owner_orders error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch orders")


# --- Segmentation ---

@app.post("/api/segment/manual")
async def segment_manual(request: SegmentManualRequest):
    try:
        filter_rules = request.model_dump(exclude_none=True)
        owners = await segment_owners(db, filter_rules)
        return {"owners": owners, "count": len(owners), "filter_used": filter_rules}
    except Exception as e:
        logger.error(f"segment_manual error: {e}")
        raise HTTPException(status_code=500, detail="Failed to segment customers")


@app.post("/api/segment/ai")
async def segment_ai(request: SegmentAIRequest):
    prompt = f"""You are a segmentation engine for a pet care CRM called PawLife.
Convert the marketer's natural language query into a JSON filter object.
The filter object can have these fields:
- city: string
- pet_type: dog or cat
- breed: string
- min_spent: float in INR
- max_spent: float in INR
- last_order_days_ago: integer (owners who havent ordered in X days)
- min_total_orders: integer
- pet_age_min: float years
- pet_age_max: float years
- product_category: food/grooming/health/accessories
- days_to_birthday: integer (pets with birthday in next X days)
- top_spender: boolean (top 20% by spend)
- life_stage_transition: "puppy_to_adult"

Respond ONLY with valid JSON. No explanation. No markdown.

Query: "{request.query}"
"""
    try:
        completion = await groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
        )
        response_text = completion.choices[0].message.content.strip()
        start = response_text.find("{")
        end = response_text.rfind("}")
        filter_rules = json.loads(response_text[start:end + 1] if start != -1 else response_text)

        owners = await segment_owners(db, filter_rules)
        return {"owners": owners, "count": len(owners), "filter_used": filter_rules}
    except Exception as e:
        logger.error(f"segment_ai error: {e}")
        raise HTTPException(status_code=500, detail="Failed to parse AI segmentation response")


# --- Campaigns ---

@app.post("/api/campaigns")
async def create_campaign(request: CreateCampaignRequest):
    try:
        new_campaign = {
            "name": request.name,
            "goal": request.goal,
            "message_template": request.message_template,
            "channel": request.channel,
            "segment_rule": request.segment_rule,
            "audience_ids": request.audience_ids,
            "status": "draft",
            "created_at": utc_now(),
            "completed_at": None,
            "stats": {
                "total": len(request.audience_ids),
                "sent": 0,
                "delivered": 0,
                "opened": 0,
                "clicked": 0,
                "failed": 0,
            },
        }
        result = await db.campaigns.insert_one(new_campaign)
        new_campaign["_id"] = str(result.inserted_id)
        return new_campaign
    except Exception as e:
        logger.exception("create_campaign error")
        raise HTTPException(status_code=500, detail="Failed to create campaign")


@app.get("/api/campaigns")
async def get_campaigns():
    try:
        campaigns = await db.campaigns.find().sort("created_at", -1).to_list(1000)
        for c in campaigns:
            c["_id"] = str(c["_id"])
        return campaigns
    except Exception as e:
        logger.error(f"get_campaigns error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch campaigns")


@app.get("/api/campaigns/{campaign_id}")
async def get_campaign(campaign_id: str):
    try:
        campaign = await db.campaigns.find_one({"_id": ObjectId(campaign_id)})
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        campaign["_id"] = str(campaign["_id"])

        messages = await db.messages.find({"campaign_id": campaign_id}).sort("updated_at", -1).to_list(1000)
        owner_ids = list({m["owner_id"] for m in messages})
        owner_map = {}
        if owner_ids:
            owners = await db.pet_owners.find(
                {"_id": {"$in": [ObjectId(oid) for oid in owner_ids]}}
            ).to_list(len(owner_ids))
            owner_map = {str(o["_id"]): o["name"] for o in owners}

        for m in messages:
            m["_id"] = str(m["_id"])
            m["owner_name"] = m.get("owner_name") or owner_map.get(m["owner_id"], "Unknown")

        campaign["messages"] = messages
        return campaign
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"get_campaign error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch campaign")


async def send_message_to_channel(msg_doc, owner_data, campaign_id: str, callback_url: str):
    payload = {
        "message_id": str(msg_doc["_id"]),
        "owner_id": str(owner_data["_id"]),
        "phone": owner_data.get("phone", ""),
        "email": owner_data.get("email", ""),
        "personalised_message": msg_doc["personalised_message"],
        "channel": msg_doc["channel"],
        "callback_url": callback_url,
    }
    try:
        async with httpx.AsyncClient() as http_client:
            await http_client.post(f"{CHANNEL_SERVICE_URL}/send", json=payload, timeout=10.0)
        await db.messages.update_one(
            {"_id": msg_doc["_id"]},
            {"$set": {"status": "sent", "sent_at": utc_now(), "updated_at": utc_now()}},
        )
        return True
    except Exception as e:
        logger.error(f"Channel send failed for {msg_doc['_id']}: {e}")
        await db.messages.update_one(
            {"_id": msg_doc["_id"]},
            {"$set": {"status": "failed", "callback_received": True, "updated_at": utc_now()}},
        )
        await db.campaigns.update_one(
            {"_id": ObjectId(campaign_id)},
            {"$inc": {"stats.failed": 1}},
        )
        await check_campaign_completion(campaign_id)
        return False


@app.post("/api/campaigns/{campaign_id}/send")
async def send_campaign(campaign_id: str):
    try:
        campaign = await db.campaigns.find_one({"_id": ObjectId(campaign_id)})
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
        if campaign.get("status") == "sending":
            raise HTTPException(status_code=400, detail="Campaign is already sending")

        await db.campaigns.update_one({"_id": ObjectId(campaign_id)}, {"$set": {"status": "sending"}})

        callback_url = f"{os.getenv('RENDER_EXTERNAL_URL', 'http://localhost:8000')}/api/receipts"
        tasks = []

        for owner_id in campaign["audience_ids"]:
            owner = await db.pet_owners.find_one({"_id": ObjectId(owner_id)})
            if not owner:
                continue

            segment_rule = campaign.get("segment_rule") or {}
            pet_name = format_pet_names(owner, segment_rule)
            msg_text = (
                campaign["message_template"]
                .replace("{owner_name}", owner["name"])
                .replace("{pet_name}", pet_name)
            )

            msg_doc = {
                "campaign_id": campaign_id,
                "owner_id": owner_id,
                "owner_name": owner["name"],
                "pet_name": pet_name,
                "personalised_message": msg_text,
                "channel": campaign["channel"],
                "phone": owner.get("phone", ""),
                "email": owner.get("email", ""),
                "status": "queued",
                "sent_at": None,
                "updated_at": utc_now(),
                "callback_received": False,
            }
            res = await db.messages.insert_one(msg_doc)
            msg_doc["_id"] = res.inserted_id
            tasks.append(send_message_to_channel(msg_doc, owner, campaign_id, callback_url))

        results = await asyncio.gather(*tasks, return_exceptions=True)
        success_count = sum(1 for r in results if r is True)

        await db.campaigns.update_one(
            {"_id": ObjectId(campaign_id)},
            {"$inc": {"stats.sent": success_count}},
        )
        await check_campaign_completion(campaign_id)

        return {"success": True, "total_sent": success_count}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("send_campaign error")
        raise HTTPException(status_code=500, detail="Failed to send campaign")


@app.post("/api/receipts")
async def receipt_callback(request: ReceiptRequest):
    try:
        msg_id = ObjectId(request.message_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid message_id format")

    try:
        msg = await db.messages.find_one({"_id": msg_id})
        if not msg:
            raise HTTPException(status_code=404, detail="Message not found")

        if msg.get("callback_received"):
            return {"success": True}

        valid_statuses = {"delivered", "opened", "clicked", "failed"}
        status = request.status if request.status in valid_statuses else "failed"

        await db.messages.update_one(
            {"_id": msg_id},
            {"$set": {"status": status, "callback_received": True, "updated_at": utc_now()}},
        )

        await db.campaigns.update_one(
            {"_id": ObjectId(msg["campaign_id"])},
            {"$inc": {f"stats.{status}": 1}},
        )

        await check_campaign_completion(msg["campaign_id"])
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"receipt_callback error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process receipt")


# --- AI ---

@app.post("/api/ai/write-message")
async def write_message(request: AIWriteMessageRequest):
    char_limit = 160 if request.channel == "sms" else 300
    prompt = f"""You are an expert WhatsApp/SMS marketing copywriter for PawLife — a premium Indian pet care D2C brand.
Write a short, warm, personalised campaign message.
Use {{owner_name}} and {{pet_name}} as placeholders.
Keep it under {char_limit} characters.
Use 1-2 relevant emojis.
Sound warm and personal — not like a mass broadcast.
Respond with ONLY the message text. Nothing else.

Goal: {request.goal}
Channel: {request.channel}
Sample owner: {request.sample_owner_name}
Sample pet: {request.sample_pet_name} ({request.sample_breed})
Sample Product: {request.sample_product}
"""
    try:
        completion = await groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )
        return {"message": completion.choices[0].message.content.strip().strip('"')}
    except Exception as e:
        logger.error(f"write_message error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate message")


@app.post("/api/ai/dashboard-insight")
async def dashboard_insight():
    try:
        overview = await get_stats_overview()
        last_food = await get_last_orders_map(db, "food")
        now = utc_now()
        overdue_food = sum(1 for dt in last_food.values() if (now - dt).days >= 24)
        total = overview.get("total_customers") or 1
        pct = round(overdue_food / total * 100)
        est_revenue = round(overdue_food * (overview.get("avg_customer_spent_inr", 2500) or 2500) * 0.15)

        prompt = f"""You are a marketing analytics AI for PawLife, a premium Indian pet care D2C brand.
Write ONE proactive insight (2-3 sentences) for the marketer's dashboard today.
Be specific with numbers. Mention a recommended action. Sound like a smart colleague, not a report.

Data:
- Total customers: {overview.get('total_customers')}
- Total pets: {overview.get('total_pets')}
- Food restock overdue (24+ days): {overdue_food} customers ({pct}% of base)
- Top city: {overview.get('top_city')}
- Most common breed: {overview.get('most_common_breed')}
- Avg open rate: {overview.get('avg_open_rate', 0):.1f}%
- Campaigns this week: {overview.get('campaigns_this_week')}
- Estimated recoverable revenue if reorder campaign runs: ~₹{est_revenue:,}

Respond with ONLY the insight text. No bullet points."""
        completion = await groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
        )
        return {"insight": completion.choices[0].message.content.strip()}
    except Exception as e:
        logger.error(f"dashboard_insight error: {e}")
        return {"insight": "Your customer base is ready for engagement — check AI Suggestions for campaigns to launch today."}


@app.post("/api/ai/segment-explain")
async def segment_explain(request: AISegmentExplainRequest):
    try:
        prompt = f"""You are a CRM analyst for PawLife pet care brand.
Explain in ONE sentence (max 25 words) WHY this customer segment was flagged — the human reason behind the data pattern.
Sound insightful, not robotic. No quotes.

Campaign type: {request.type}
Title: {request.title}
Description: {request.description}
Audience size: {request.audience_count}
Filter rules: {json.dumps(request.segment_rule)}

Respond with ONLY the one-line explanation."""
        completion = await groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.6,
        )
        return {"explanation": completion.choices[0].message.content.strip().strip('"')}
    except Exception as e:
        logger.error(f"segment_explain error: {e}")
        return {"explanation": request.description}


@app.post("/api/ai/chat")
async def ai_chat(request: AIChatRequest):
    try:
        summary = await build_data_summary_for_chat(db)
        prompt = f"""You are PawLife CRM assistant — an AI helper for a pet care marketer in India.
Answer the marketer's question using ONLY the data below. Be concise (2-4 sentences). Use ₹ for money.
If the data doesn't have the answer, say so honestly and suggest what they could check.

CRM Data Snapshot:
{json.dumps(summary, indent=2)}

Marketer's question: "{request.query}"

Respond in plain English. No markdown."""
        completion = await groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
        )
        return {"answer": completion.choices[0].message.content.strip()}
    except Exception as e:
        logger.error(f"ai_chat error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get AI answer")


@app.post("/api/ai/campaign-insight")
async def campaign_insight(request: AICampaignInsightRequest):
    try:
        camp_id = ObjectId(request.campaign_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid campaign ID format")

    try:
        campaign = await db.campaigns.find_one({"_id": camp_id})
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")

        stats = campaign.get("stats", {})
        sent = stats.get("sent", 0)
        open_rate = (stats.get("opened", 0) / sent * 100) if sent > 0 else 0
        click_rate = (stats.get("clicked", 0) / sent * 100) if sent > 0 else 0

        prompt = f"""You are a marketing analytics AI for PawLife pet care brand.
Analyse these campaign stats and give a 3-4 line plain English insight.
Tell what worked, what did not, and one specific recommendation.
Be direct and actionable. No fluff.

Campaign Goal: {campaign.get('goal')}
Stats:
Total: {stats.get('total')}
Sent: {sent}
Delivered: {stats.get('delivered')}
Opened: {stats.get('opened')}
Clicked: {stats.get('clicked')}
Failed: {stats.get('failed')}
Open Rate: {open_rate:.1f}%
Click Rate: {click_rate:.1f}%
"""
        completion = await groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
        )
        return {"insight": completion.choices[0].message.content.strip()}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"campaign_insight error: {e}")
        return {"insight": "Unable to generate insights at this time."}


# --- Autopilot & Stats ---

@app.get("/api/autopilot/suggestions")
async def autopilot_suggestions():
    try:
        return await get_autopilot_suggestions(db)
    except Exception as e:
        logger.error(f"autopilot_suggestions error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch autopilot suggestions")


@app.get("/api/stats/overview")
async def get_stats_overview():
    try:
        total_customers = await db.pet_owners.count_documents({})

        pets_res = await db.pet_owners.aggregate([
            {"$project": {"pet_count": {"$size": {"$ifNull": ["$pets", []]}}}},
            {"$group": {"_id": None, "total": {"$sum": "$pet_count"}}},
        ]).to_list(1)
        total_pets = pets_res[0]["total"] if pets_res else 0

        total_campaigns = await db.campaigns.count_documents({})

        camp_res = await db.campaigns.aggregate([
            {"$group": {
                "_id": None,
                "total_sent": {"$sum": "$stats.sent"},
                "total_opened": {"$sum": "$stats.opened"},
                "total_clicked": {"$sum": "$stats.clicked"},
            }},
        ]).to_list(1)

        total_sent = 0
        avg_open_rate = 0.0
        avg_click_rate = 0.0
        if camp_res:
            total_sent = camp_res[0].get("total_sent", 0)
            if total_sent > 0:
                avg_open_rate = (camp_res[0].get("total_opened", 0) / total_sent) * 100
                avg_click_rate = (camp_res[0].get("total_clicked", 0) / total_sent) * 100

        city_res = await db.pet_owners.aggregate([
            {"$group": {"_id": "$city", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 1},
        ]).to_list(1)
        top_city = city_res[0]["_id"] if city_res else "N/A"

        breed_res = await db.pet_owners.aggregate([
            {"$unwind": "$pets"},
            {"$group": {"_id": "$pets.breed", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 1},
        ]).to_list(1)
        most_common_breed = breed_res[0]["_id"] if breed_res else "N/A"

        from datetime import timedelta
        one_week_ago = utc_now() - timedelta(days=7)
        campaigns_this_week = await db.campaigns.count_documents({"created_at": {"$gte": one_week_ago}})

        avg_spent_res = await db.pet_owners.aggregate([
            {"$group": {"_id": None, "avg": {"$avg": "$total_spent"}}},
        ]).to_list(1)
        avg_customer_spent_inr = avg_spent_res[0]["avg"] if avg_spent_res else 0

        return {
            "total_customers": total_customers,
            "total_pets": total_pets,
            "total_campaigns": total_campaigns,
            "total_messages_sent": total_sent,
            "avg_open_rate": avg_open_rate,
            "avg_click_rate": avg_click_rate,
            "top_city": top_city,
            "most_common_breed": most_common_breed,
            "campaigns_this_week": campaigns_this_week,
            "avg_customer_spent_inr": avg_customer_spent_inr,
        }
    except Exception as e:
        logger.error(f"get_stats_overview error: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch stats")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
