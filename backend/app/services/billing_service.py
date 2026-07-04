"""
billing_service.py
==================
Centralized billing and credit management logic.
"""

async def deduct_user_credits(db, user: dict, cost: int = 1) -> None:
    """
    Deducts AI credits from the user's account and updates their monthly usage.
    Only deducts 'current_credits' if the user is on the standard (managed) plan.
    'credits_used_this_month' is always incremented regardless of plan.
    """
    ai_config = user.get("ai_configuration")
    if not ai_config:
        return
        
    provider_mode = ai_config.get("provider_mode", "standard")
    
    update_fields = {}
    if provider_mode == "standard":
        current_credits = max(0, int(ai_config.get("current_credits", 1000)) - cost)
        update_fields["ai_configuration.current_credits"] = current_credits

    credits_used = int(ai_config.get("credits_used_this_month", 0)) + cost
    update_fields["ai_configuration.credits_used_this_month"] = credits_used

    if update_fields:
        await db.users.update_one({"id": user.get("id")}, {"$set": update_fields})
