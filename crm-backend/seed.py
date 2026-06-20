import asyncio
import os
import random
from datetime import datetime, timedelta, date
from faker import Faker
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = os.getenv("DB_NAME", "pawlife")

fake = Faker("en_IN")

CITIES = ["Mumbai", "Bangalore", "Delhi", "Chennai", "Hyderabad", "Pune"]
CITY_WEIGHTS = [0.30, 0.25, 0.20, 0.15, 0.10, 0.0]

DOG_BREEDS = ["Labrador", "Golden Retriever", "German Shepherd", "Beagle", "Pug", "Indie", "Husky", "Shih Tzu"]
CAT_BREEDS = ["Persian", "Siamese", "Maine Coon", "Indie", "Bengal", "Ragdoll"]

FOOD_PRODUCTS = [
    "Royal Canin Labrador Adult", "Hills Science Diet", "Drools Chicken and Egg",
    "Whiskas Tuna Cat Food", "Me-O Chicken Cat Food", "Pedigree Adult Dog Food",
    "Farmina N&D Grain Free", "Acana Heritage Chicken",
]
HEALTH_PRODUCTS = [
    "Beaphar Multivitamin", "Himalaya Erina EP", "Drools Absolute Calcium",
    "Petcare Drontal Deworming", "Virbac Renal Support", "NutriVet Joint Support",
]
GROOMING_PRODUCTS = [
    "Wahl Pet Shampoo", "FURminator Deshedding", "Beaphar Ear Cleaner",
    "Pet Head Dry Clean Spray", "Bio-Groom Flea Shampoo",
]
ACCESSORY_PRODUCTS = [
    "Ruffwear Harness", "Heads Up For Tails Collar", "PetSafe Water Fountain",
    "Coastal Pet Leash", "Kong Classic Toy",
]


def generate_birthday(age_years: float, days_until_bday: int) -> str:
    """Generate a birthday string that matches age and days-until-next-birthday."""
    today = date.today()
    birth_year = today.year - int(age_years)
    next_bday = today + timedelta(days=days_until_bday)
    return date(birth_year, next_bday.month, next_bday.day).strftime("%Y-%m-%d")


async def seed_data():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print("Clearing existing data...")
    await db.pet_owners.delete_many({})
    await db.orders.delete_many({})
    await db.campaigns.delete_many({})
    await db.messages.delete_many({})

    print("Generating Pet Owners...")
    owners = []

    for i in range(150):
        num_pets = random.choices([1, 2], weights=[0.8, 0.2])[0]
        pets = []
        for _ in range(num_pets):
            pet_type = random.choices(["dog", "cat"], weights=[0.6, 0.4])[0]
            breed = random.choice(DOG_BREEDS) if pet_type == "dog" else random.choice(CAT_BREEDS)

            age_years = round(random.uniform(0.5, 10.0), 1)
            days_to_bday = random.randint(8, 300)

            # Edge cases for autopilot demos
            if i < 8:
                days_to_bday = random.randint(1, 7)  # birthday campaign
            elif i < 14:
                age_years = round(random.uniform(0.92, 0.99), 2)  # life stage
                days_to_bday = random.randint(1, 30)
            elif random.random() < 0.05:
                age_years = 0.95
                days_to_bday = random.randint(1, 30)
            elif random.random() < 0.08:
                days_to_bday = random.randint(1, 7)

            pets.append({
                "pet_id": fake.uuid4(),
                "pet_name": fake.first_name(),
                "pet_type": pet_type,
                "breed": breed,
                "age_years": age_years,
                "birthday": generate_birthday(age_years, days_to_bday),
                "weight_kg": round(random.uniform(3.0, 30.0), 1),
            })

        owner = {
            "name": fake.name(),
            "email": fake.email(),
            "phone": "+91" + "".join(str(random.randint(0, 9)) for _ in range(10)),
            "city": random.choices(CITIES, weights=CITY_WEIGHTS)[0],
            "total_orders": 0,
            "total_spent": 0.0,
            "created_at": datetime.utcnow() - timedelta(days=random.randint(30, 365)),
            "pets": pets,
        }
        owners.append(owner)

    result = await db.pet_owners.insert_many(owners)
    owner_ids = result.inserted_ids
    print(f"Inserted {len(owner_ids)} owners.")

    print("Generating Orders...")
    orders = []
    orders_per_owner = {str(oid): 0 for oid in owner_ids}

    while len(orders) < 400:
        owner_id = random.choice(owner_ids)
        owner_key = str(owner_id)
        if orders_per_owner[owner_key] >= 6:
            continue

        owner_idx = owner_ids.index(owner_id)
        owner_doc = owners[owner_idx]
        pet = random.choice(owner_doc["pets"])

        cat = random.choices(["food", "health", "grooming", "accessories"], weights=[0.40, 0.25, 0.20, 0.15])[0]
        if cat == "food":
            prod, restock = random.choice(FOOD_PRODUCTS), 30
        elif cat == "health":
            prod, restock = random.choice(HEALTH_PRODUCTS), 45
        elif cat == "grooming":
            prod, restock = random.choice(GROOMING_PRODUCTS), 60
        else:
            prod, restock = random.choice(ACCESSORY_PRODUCTS), None

        days_ago = random.randint(1, 90)
        if cat == "food" and random.random() < 0.15:
            days_ago = random.randint(25, 35)

        amount = round(random.uniform(500, 5000), 2)
        qty = random.randint(1, 3)

        orders.append({
            "owner_id": owner_key,
            "pet_id": pet["pet_id"],
            "product_name": prod,
            "product_category": cat,
            "amount": amount * qty,
            "quantity": qty,
            "ordered_at": datetime.utcnow() - timedelta(days=days_ago),
            "expected_restock_days": restock,
        })
        orders_per_owner[owner_key] += 1

    # Ensure every owner has at least 1 order
    for oid in owner_ids:
        if orders_per_owner[str(oid)] == 0:
            owner_doc = owners[owner_ids.index(oid)]
            pet = owner_doc["pets"][0]
            orders.append({
                "owner_id": str(oid),
                "pet_id": pet["pet_id"],
                "product_name": random.choice(FOOD_PRODUCTS),
                "product_category": "food",
                "amount": round(random.uniform(800, 2000), 2),
                "quantity": 1,
                "ordered_at": datetime.utcnow() - timedelta(days=random.randint(1, 90)),
                "expected_restock_days": 30,
            })

    # Win-back: first 15 owners get all orders pushed to 46-90 days ago
    for i in range(15):
        owner_key = str(owner_ids[i])
        for o in orders:
            if o["owner_id"] == owner_key:
                o["ordered_at"] = datetime.utcnow() - timedelta(days=random.randint(46, 90))

    # VIP reactivation: top spenders with stale last orders (21-35 days ago)
    spend_by_owner = {
        str(oid): sum(o["amount"] for o in orders if o["owner_id"] == str(oid))
        for oid in owner_ids
    }
    top_spenders = sorted(spend_by_owner.keys(), key=lambda k: spend_by_owner[k], reverse=True)
    top_20_cutoff = max(1, int(len(top_spenders) * 0.2))
    winback_keys = {str(owner_ids[i]) for i in range(15)}
    for owner_key in top_spenders[:top_20_cutoff]:
        if owner_key in winback_keys:
            continue
        owner_orders = [o for o in orders if o["owner_id"] == owner_key]
        if not owner_orders:
            continue
        latest = max(owner_orders, key=lambda o: o["ordered_at"])
        latest["ordered_at"] = datetime.utcnow() - timedelta(days=random.randint(21, 35))
        if spend_by_owner[owner_key] < 8000:
            owner_idx = next(i for i, oid in enumerate(owner_ids) if str(oid) == owner_key)
            orders.append({
                "owner_id": owner_key,
                "pet_id": owners[owner_idx]["pets"][0]["pet_id"],
                "product_name": random.choice(FOOD_PRODUCTS),
                "product_category": "food",
                "amount": round(random.uniform(3000, 8000), 2),
                "quantity": 1,
                "ordered_at": datetime.utcnow() - timedelta(days=random.randint(21, 35)),
                "expected_restock_days": 30,
            })

    await db.orders.insert_many(orders)
    print(f"Inserted {len(orders)} orders.")

    for oid in owner_ids:
        owner_orders = [o for o in orders if o["owner_id"] == str(oid)]
        await db.pet_owners.update_one(
            {"_id": oid},
            {"$set": {
                "total_orders": len(owner_orders),
                "total_spent": sum(o["amount"] for o in owner_orders),
            }},
        )

    print("Seed complete!")


if __name__ == "__main__":
    asyncio.run(seed_data())
