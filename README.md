# PawLife - AI-Native Mini CRM

**[🔗 Live Demo (Hosted URL)](#)** | **[🎥 Walkthrough Video](https://drive.google.com/file/d/1zjTreSmUsHou0ygBGxFaT-oTRAdCTUsK/view?usp=drive_link)**

A marketing CRM for **PawLife**, an Indian D2C pet care brand. Helps marketers decide **who to reach**, **what to say**, and **which channel** to use - with AI woven into every step.

## Product POV

**AI campaign copilot** - autopilot surfaces opportunities from customer data, AI finds audiences and writes copy, marketer reviews and launches, system tracks live delivery via a callback-driven channel stub.

## Architecture

```text
React (Vite) -> FastAPI CRM (:8000) -> MongoDB Atlas
                    | asyncio.gather
                    v
             Channel Stub (:8001) -> POST /api/receipts (callbacks)
                    |
                    v
                 Groq AI (segmentation, copy, insights)
```

## Features

- **Customer data** - 150 pet owners, ~400 orders (seed script)
- **Segmentation** - manual filters + Groq natural-language audience finding
- **Campaigns** - personalised messages with `{owner_name}` / `{pet_name}` placeholders
- **Autopilot** - 5 proactive suggestions (reorder, birthday, life-stage, win-back, VIP)
- **Live tracking** - campaign detail polls stats as channel callbacks arrive
- **AI insights** - post-campaign performance analysis via Groq

## Local setup

### 1. MongoDB + env

Copy `.env.example` -> `.env` in each service and fill in values.

### 2. CRM backend

```bash
cd crm-backend
pip install -r requirements.txt
python seed.py          # load demo data
uvicorn server:app --reload --port 8000
```

### 3. Channel service

```bash
cd channel-service
pip install -r requirements.txt
uvicorn server:app --reload --port 8001
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Demo flow

1. **Dashboard** -> view stats + AI autopilot suggestions
2. Click **Launch Campaign** on "Food restock overdue"
3. Audience auto-loaded -> generate AI message -> select WhatsApp -> launch
4. **Campaign detail** -> watch live stats update -> read AI insight
5. **Customers** -> filter, search, view profile + restock prediction

## Tradeoffs (conscious choices)

| At scale | For this scope |
|----------|----------------|
| Job queue (Celery/SQS) for sends | `asyncio.gather()` - sufficient for ~150 recipients |
| Webhook signature verification | Trust stub channel in demo |
| Redis caching for autopilot | Full scan on each request - simple, correct |
| Microservices + routers | Modular helpers (`filters.py`, `autopilot.py`) in one deployable app |
| Real WhatsApp/SMS/Email | Separate stub service with probabilistic callbacks |

## Project structure

```text
pawlife/
|-- frontend/          React + Vite + Tailwind
|-- crm-backend/       FastAPI + Motor + Groq
|   |-- server.py
|   |-- filters.py     Shared segmentation logic
|   |-- autopilot.py   Proactive campaign suggestions
|   `-- seed.py
`-- channel-service/   Message delivery stub
```

## API health

- CRM: `GET /api/health`
- Channel: `GET /health`
