"""Shared customer segmentation and filter logic."""
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def days_until_birthday(birthday_str: str) -> int:
    """Days until the pet's next birthday (0 = today)."""
    today = utc_now().date()
    bday = datetime.strptime(birthday_str, "%Y-%m-%d").date()
    next_bday = bday.replace(year=today.year)
    if next_bday < today:
        next_bday = bday.replace(year=today.year + 1)
    return (next_bday - today).days


def build_mongo_query(filter_rules: Dict[str, Any]) -> dict:
    query: dict = {}
    if filter_rules.get("city"):
        query["city"] = {"$regex": f"^{filter_rules['city']}$", "$options": "i"}
    if filter_rules.get("pet_type"):
        query["pets.pet_type"] = filter_rules["pet_type"]
    if filter_rules.get("breed"):
        query["pets.breed"] = filter_rules["breed"]
    if filter_rules.get("min_total_orders") is not None:
        query["total_orders"] = {"$gte": filter_rules["min_total_orders"]}
    elif filter_rules.get("min_orders") is not None:
        query["total_orders"] = {"$gte": filter_rules["min_orders"]}

    if "min_spent" in filter_rules or "max_spent" in filter_rules:
        query["total_spent"] = {}
        if "min_spent" in filter_rules:
            query["total_spent"]["$gte"] = filter_rules["min_spent"]
        if "max_spent" in filter_rules:
            query["total_spent"]["$lte"] = filter_rules["max_spent"]

    return query


def pet_matches_age(pets: list, pet_age_min: Optional[float], pet_age_max: Optional[float]) -> bool:
    if pet_age_min is None and pet_age_max is None:
        return True
    for pet in pets or []:
        age = pet.get("age_years", 0)
        if pet_age_min is not None and age < pet_age_min:
            continue
        if pet_age_max is not None and age > pet_age_max:
            continue
        return True
    return False


def pet_matches_birthday_window(pets: list, days_to_birthday: int) -> bool:
    for pet in pets or []:
        try:
            if 0 <= days_until_birthday(pet["birthday"]) <= days_to_birthday:
                return True
        except (KeyError, ValueError):
            continue
    return False


def pet_matches_life_stage(pets: list) -> bool:
    """Pets turning 1 year old within the next 30 days."""
    for pet in pets or []:
        age = pet.get("age_years", 0)
        if 0.9 <= age <= 1.0:
            return True
        try:
            days = days_until_birthday(pet["birthday"])
            if days <= 30 and pet.get("age_years", 0) < 1.05:
                return True
        except (KeyError, ValueError):
            continue
    return False


async def get_last_orders_map(db, product_category: Optional[str] = None) -> Dict[str, datetime]:
    """Bulk-fetch latest order date per owner in a single aggregation."""
    match_stage = {"$match": {"product_category": product_category}} if product_category else None
    pipeline = []
    if match_stage:
        pipeline.append(match_stage)
    pipeline.extend([
        {"$sort": {"ordered_at": -1}},
        {"$group": {"_id": "$owner_id", "ordered_at": {"$first": "$ordered_at"}}},
    ])
    result = await db.orders.aggregate(pipeline).to_list(None)
    return {r["_id"]: ensure_utc(r["ordered_at"]) for r in result}


async def get_owners_with_category_order(db, category: str) -> set:
    """Set of owner_ids who have ever ordered in a category."""
    pipeline = [
        {"$match": {"product_category": category}},
        {"$group": {"_id": "$owner_id"}},
    ]
    result = await db.orders.aggregate(pipeline).to_list(None)
    return {r["_id"] for r in result}


async def get_last_order(db, owner_id: str, product_category: Optional[str] = None):
    query: dict = {"owner_id": owner_id}
    if product_category:
        query["product_category"] = product_category
    return await db.orders.find_one(query, sort=[("ordered_at", -1)])


def owner_matches_filters_sync(
    owner: dict,
    filter_rules: Dict[str, Any],
    top_spender_threshold: Optional[float],
    last_orders_map: Dict[str, datetime],
    last_food_orders_map: Optional[Dict[str, datetime]] = None,
    category_owners: Optional[set] = None,
) -> bool:
    """Synchronous filter check using pre-fetched order maps."""
    owner_id = str(owner["_id"])
    pets = owner.get("pets", [])

    if filter_rules.get("top_spender") and top_spender_threshold is not None:
        if owner.get("total_spent", 0) < top_spender_threshold:
            return False

    if not pet_matches_age(pets, filter_rules.get("pet_age_min"), filter_rules.get("pet_age_max")):
        return False

    if filter_rules.get("days_to_birthday") is not None:
        if not pet_matches_birthday_window(pets, filter_rules["days_to_birthday"]):
            return False

    if filter_rules.get("life_stage_transition") == "puppy_to_adult":
        if not pet_matches_life_stage(pets):
            return False

    if "last_order_days_ago" in filter_rules:
        days = filter_rules["last_order_days_ago"]
        category = filter_rules.get("product_category")
        order_map = last_food_orders_map if category == "food" else last_orders_map
        last_at = order_map.get(owner_id)
        if not last_at:
            return False
        diff = (utc_now() - last_at).days
        if diff < days:
            return False
    elif filter_rules.get("product_category") and category_owners is not None:
        if owner_id not in category_owners:
            return False

    return True


async def owner_matches_filters(db, owner: dict, filter_rules: Dict[str, Any], top_spender_threshold: Optional[float] = None) -> bool:
    owner_id = str(owner["_id"])
    pets = owner.get("pets", [])

    if filter_rules.get("top_spender") and top_spender_threshold is not None:
        if owner.get("total_spent", 0) < top_spender_threshold:
            return False

    if not pet_matches_age(pets, filter_rules.get("pet_age_min"), filter_rules.get("pet_age_max")):
        return False

    if filter_rules.get("days_to_birthday") is not None:
        if not pet_matches_birthday_window(pets, filter_rules["days_to_birthday"]):
            return False

    if filter_rules.get("life_stage_transition") == "puppy_to_adult":
        if not pet_matches_life_stage(pets):
            return False

    if "last_order_days_ago" in filter_rules:
        days = filter_rules["last_order_days_ago"]
        category = filter_rules.get("product_category")
        last_order = await get_last_order(db, owner_id, category)
        if not last_order:
            return False
        diff = (utc_now() - ensure_utc(last_order["ordered_at"])).days
        if diff < days:
            return False
    elif filter_rules.get("product_category"):
        has_cat = await db.orders.find_one(
            {"owner_id": owner_id, "product_category": filter_rules["product_category"]}
        )
        if not has_cat:
            return False

    return True


async def segment_owners(db, filter_rules: Dict[str, Any]) -> List[dict]:
    mongo_query = build_mongo_query(filter_rules)
    owners = await db.pet_owners.find(mongo_query).to_list(1000)

    top_spender_threshold = None
    if filter_rules.get("top_spender"):
        all_spent = await db.pet_owners.find({}, {"total_spent": 1}).sort("total_spent", -1).to_list(1000)
        if all_spent:
            idx = max(0, int(len(all_spent) * 0.2) - 1)
            top_spender_threshold = all_spent[idx].get("total_spent", 0)

    needs_orders = "last_order_days_ago" in filter_rules or filter_rules.get("product_category")
    last_orders_map = await get_last_orders_map(db) if needs_orders else {}
    last_food_map = await get_last_orders_map(db, "food") if filter_rules.get("product_category") == "food" else None
    category_owners = await get_owners_with_category_order(db, filter_rules["product_category"]) if filter_rules.get("product_category") and "last_order_days_ago" not in filter_rules else None

    result = []
    for owner in owners:
        if needs_orders:
            match = owner_matches_filters_sync(
                owner, filter_rules, top_spender_threshold,
                last_orders_map, last_food_map, category_owners,
            )
        else:
            match = await owner_matches_filters(db, owner, filter_rules, top_spender_threshold)
        if match:
            owner["_id"] = str(owner["_id"])
            result.append(owner)
    return result


async def enrich_owners_with_last_order(db, owners: List[dict]) -> List[dict]:
    """Add last_order fields using one aggregation instead of N queries."""
    if not owners:
        return owners

    last_orders_map = await get_last_orders_map(db)
    enriched = []
    for owner in owners:
        owner_id = owner["_id"] if isinstance(owner["_id"], str) else str(owner["_id"])
        last_at = last_orders_map.get(owner_id)
        if last_at:
            owner["last_order_date"] = last_at.isoformat()
            owner["last_order_days_ago"] = (utc_now() - last_at).days
        else:
            owner["last_order_date"] = None
            owner["last_order_days_ago"] = None
        enriched.append(owner)
    return enriched


def compute_restock_prediction(orders: list) -> dict:
    """Predict food restock timing from order history."""
    food_orders = [o for o in orders if o.get("product_category") == "food"]
    if not food_orders:
        return {"status": "unknown", "message": "No food orders on record yet."}

    latest = max(food_orders, key=lambda o: ensure_utc(o["ordered_at"]))
    days_since = (utc_now() - ensure_utc(latest["ordered_at"])).days
    restock_days = latest.get("expected_restock_days") or 30
    days_until = restock_days - days_since

    if days_until < 0:
        return {
            "status": "overdue",
            "message": f"Food restock overdue by {abs(days_until)} days based on last order.",
            "days_until_restock": days_until,
        }
    if days_until == 0:
        return {"status": "due", "message": "Food restock due today.", "days_until_restock": 0}
    return {
        "status": "upcoming",
        "message": f"Expected food restock in ~{days_until} days.",
        "days_until_restock": days_until,
    }


def format_pet_names(owner: dict, segment_rule: Optional[Dict[str, Any]] = None) -> str:
    """Pick relevant pet name(s) for message personalization."""
    pets = owner.get("pets") or []
    if not pets:
        return "your pet"

    rule = segment_rule or {}
    pet_type = rule.get("pet_type")

    if rule.get("product_category") == "food" and not pet_type:
        dogs = [p for p in pets if p.get("pet_type") == "dog"]
        cats = [p for p in pets if p.get("pet_type") == "cat"]
        relevant = dogs or cats or pets
    elif pet_type:
        relevant = [p for p in pets if p.get("pet_type") == pet_type] or pets
    elif rule.get("days_to_birthday"):
        relevant = [p for p in pets if pet_matches_birthday_window([p], rule["days_to_birthday"])] or pets
    elif rule.get("life_stage_transition"):
        relevant = [p for p in pets if pet_matches_life_stage([p])] or pets
    else:
        relevant = pets

    names = [p["pet_name"] for p in relevant[:2]]
    if len(names) == 1:
        return names[0]
    if len(names) == 2:
        return f"{names[0]} and {names[1]}"
    return names[0] if names else "your pet"


async def build_data_summary_for_chat(db) -> dict:
    """Compact CRM snapshot for AI chat context."""
    total_customers = await db.pet_owners.count_documents({})
    pets_res = await db.pet_owners.aggregate([
        {"$project": {"pet_count": {"$size": {"$ifNull": ["$pets", []]}}}},
        {"$group": {"_id": None, "total": {"$sum": "$pet_count"}}},
    ]).to_list(1)
    total_pets = pets_res[0]["total"] if pets_res else 0

    city_breakdown = await db.pet_owners.aggregate([
        {"$group": {"_id": "$city", "count": {"$sum": 1}, "total_spent": {"$sum": "$total_spent"}}},
        {"$sort": {"count": -1}},
    ]).to_list(10)

    dog_count = await db.pet_owners.count_documents({"pets.pet_type": "dog"})
    cat_count = await db.pet_owners.count_documents({"pets.pet_type": "cat"})

    last_orders = await get_last_orders_map(db)
    now = utc_now()
    overdue_food = 0
    inactive_45 = 0
    food_map = await get_last_orders_map(db, "food")
    for oid, ordered_at in food_map.items():
        if (now - ordered_at).days >= 24:
            overdue_food += 1
    for _, ordered_at in last_orders.items():
        if (now - ordered_at).days >= 45:
            inactive_45 += 1

    avg_spent_res = await db.pet_owners.aggregate([
        {"$group": {"_id": None, "avg": {"$avg": "$total_spent"}}},
    ]).to_list(1)
    avg_spent = avg_spent_res[0]["avg"] if avg_spent_res else 0

    return {
        "total_customers": total_customers,
        "total_pets": total_pets,
        "dog_owners": dog_count,
        "cat_owners": cat_count,
        "cities": [{"city": c["_id"], "customers": c["count"], "total_spent_inr": round(c["total_spent"], 0)} for c in city_breakdown],
        "food_restock_overdue_24d": overdue_food,
        "inactive_45d": inactive_45,
        "avg_customer_spent_inr": round(avg_spent, 0),
    }
