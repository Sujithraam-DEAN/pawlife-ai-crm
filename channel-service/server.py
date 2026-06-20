import asyncio
import os
import random
from datetime import datetime, timezone
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
from dotenv import load_dotenv

load_dotenv()

CRM_RECEIPT_URL = os.getenv("CRM_RECEIPT_URL", "http://localhost:8000/api/receipts")

app = FastAPI(title="PawLife Channel Service Stub")

# Allow requests from CRM
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "service": "PawLife Channel Service",
        "status": "ok",
        "health": "/health",
        "send": "/send",
    }

class SendRequest(BaseModel):
    message_id: str
    owner_id: str
    phone: str
    email: str
    personalised_message: str
    channel: str
    callback_url: str

async def process_callback(payload: SendRequest):
    # Wait random 2-5 seconds
    delay = random.uniform(2.0, 5.0)
    await asyncio.sleep(delay)
    
    # Pick random outcome
    r = random.random()
    if r < 0.55:
        status = "delivered"
    elif r < 0.80: # 55 + 25 = 80
        status = "opened"
    elif r < 0.92: # 80 + 12 = 92
        status = "clicked"
    else:
        status = "failed"
        
    callback_data = {
        "message_id": payload.message_id,
        "status": status,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    target_url = payload.callback_url or CRM_RECEIPT_URL
    
    print(f"[{datetime.now().isoformat()}] Sending callback for msg {payload.message_id} -> {status} to {target_url}")
    
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(target_url, json=callback_data, timeout=10.0)
            res.raise_for_status()
        except Exception as e:
            print(f"[{datetime.now().isoformat()}] Callback failed for msg {payload.message_id}. Retrying in 3 seconds...")
            await asyncio.sleep(3.0)
            try:
                res = await client.post(target_url, json=callback_data, timeout=10.0)
                res.raise_for_status()
                print(f"[{datetime.now().isoformat()}] Retry successful for msg {payload.message_id}")
            except Exception as e2:
                print(f"[{datetime.now().isoformat()}] Callback failed permanently for msg {payload.message_id}. Error: {e2}")

@app.post("/send")
async def send_message(request: SendRequest, background_tasks: BackgroundTasks):
    print(f"[{datetime.now().isoformat()}] Received request to send msg {request.message_id} via {request.channel}")
    
    background_tasks.add_task(process_callback, request)
    
    return {"received": True, "message_id": request.message_id}

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "PawLife Channel Service"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
