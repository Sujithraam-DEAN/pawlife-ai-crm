"""Autopilot campaign suggestion engine — optimized with bulk order lookups."""
from datetime import timedelta
from typing import Any, Dict, List

from filters import (
    ensure_utc,
    get_last_orders_map,
    pet_matches_birthday_window,
    pet_matches_life_stage,
    utc_now,
)


async def get_autopilot_suggestions(db) -> List[Dict[str, Any]]:
    suggestions: List[Dict[str, Any]] = []
    owners = await db.pet_owners.find().to_list(None)
    if not owners:
        return suggestions

    now = utc_now()
    target_date_24 = now - timedelta(days=24)
    target_date_45 = now - timedelta(days=45)
    target_date_20 = now - timedelta(days=20)

    last_orders_map = await get_last_orders_map(db)
    last_food_map = await get_last_orders_map(db, "food")

    # 1. Reorder — last food order 24+ days ago
    reorder_food_count = sum(
        1 for oid, ordered_at in last_food_map.items() if ordered_at <= target_date_24
    )
    if reorder_food_count > 0:
        suggestions.append({
            "type": "reorder",
            "urgency": "high",
            "title": "Food restock overdue",
            "description": f"{reorder_food_count} pet owners are overdue for food restock",
            "audience_count": reorder_food_count,
            "goal": "Find pet owners whose last food order was more than 24 days ago and send a restock reminder",
            "suggested_message": "Hey {owner_name}! 🐾 Looks like {pet_name} might be running low on their favorite food. Order now and get 10% off your restock! 🍲",
            "suggested_channel": "whatsapp",
            "segment_rule": {"last_order_days_ago": 24, "product_category": "food"},
        })

    # 2. Birthday — pets with birthdays in next 7 days
    birthday_count = sum(
        sum(1 for p in o.get("pets", []) if pet_matches_birthday_window([p], 7))
        for o in owners
    )
    if birthday_count > 0:
        suggestions.append({
            "type": "birthday",
            "urgency": "medium",
            "title": "Pet birthdays this week",
            "description": f"{birthday_count} pets have birthdays in the next 7 days",
            "audience_count": birthday_count,
            "goal": "Find pets with birthdays in the next 7 days and send a birthday treat offer",
            "suggested_message": "Happy birthday to {pet_name}! 🎂 Treat your furry friend with 15% off birthday goodies at PawLife, {owner_name}! 🐾",
            "suggested_channel": "whatsapp",
            "segment_rule": {"days_to_birthday": 7},
        })

    # 3. Life stage — puppies turning 1 soon
    life_stage_count = sum(
        sum(1 for p in o.get("pets", []) if pet_matches_life_stage([p]))
        for o in owners
    )
    if life_stage_count > 0:
        suggestions.append({
            "type": "life_stage",
            "urgency": "medium",
            "title": "Puppies turning 1 — food transition time",
            "description": f"{life_stage_count} puppies are turning 1 soon",
            "audience_count": life_stage_count,
            "goal": "Find puppies turning 1 year old soon and recommend adult food transition",
            "suggested_message": "Hi {owner_name}! {pet_name} is growing up! 🐕 Switch to adult food with our transition guide — 10% off your first adult food order.",
            "suggested_channel": "whatsapp",
            "segment_rule": {"life_stage_transition": "puppy_to_adult"},
        })

    # 4. Win-back — no orders in 45+ days
    winback_count = sum(
        1 for _, ordered_at in last_orders_map.items() if ordered_at <= target_date_45
    )
    if winback_count > 0:
        suggestions.append({
            "type": "winback",
            "urgency": "high",
            "title": "Customers going silent",
            "description": f"{winback_count} customers haven't ordered in 45+ days",
            "audience_count": winback_count,
            "goal": "Find customers who haven't ordered in 45 days and win them back with 20% off",
            "suggested_message": "Hi {owner_name}, we miss you! {pet_name} deserves a treat. Here's 20% off your next PawLife order: MISSYOU20 🎁",
            "suggested_channel": "sms",
            "segment_rule": {"last_order_days_ago": 45},
        })

    # 5. VIP reactivation — top 20% spenders, no order in 20+ days
    sorted_owners = sorted(owners, key=lambda o: o.get("total_spent", 0), reverse=True)
    if sorted_owners:
        threshold_idx = max(0, int(len(sorted_owners) * 0.2) - 1)
        spend_threshold = sorted_owners[threshold_idx].get("total_spent", 0)
        vip_count = 0
        for owner in sorted_owners:
            if owner.get("total_spent", 0) < spend_threshold:
                break
            oid = str(owner["_id"])
            last_at = last_orders_map.get(oid)
            if last_at and last_at <= target_date_20:
                vip_count += 1

        if vip_count > 0:
            suggestions.append({
                "type": "vip_reactivation",
                "urgency": "high",
                "title": "VIP customers going quiet",
                "description": f"{vip_count} high-value customers need attention",
                "audience_count": vip_count,
                "goal": "Find top-spending customers who haven't ordered in 20 days and offer VIP early access",
                "suggested_message": "Hi {owner_name}! As a valued PawLife VIP, {pet_name} gets early access to our new premium range. Exclusive 25% off just for you! ✨",
                "suggested_channel": "whatsapp",
                "segment_rule": {"top_spender": True, "last_order_days_ago": 20},
            })

    urgency_order = {"high": 0, "medium": 1, "low": 2}
    suggestions.sort(key=lambda x: urgency_order.get(x["urgency"], 2))
    return suggestions
