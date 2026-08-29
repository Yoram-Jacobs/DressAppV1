"""backend/app/services/styling_context.py

Deep module: AI Stylist Context Synthesis Engine.

Consolidates all wardrobe retrieval, slot classification, user profile & sizing,
weather/calendar resolution, and i18next multilingual prompt grounding behind
a clean, single-seam interface.

Interface:
  - StylingContext.build(user_id, *, intent, lat, lng, occasion, event_date, language, include_calendar) -> GroundedStylingContext
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from app.db.database import get_db
from app.services import repos
from app.services.calendar_service import calendar_service
from app.services.weather_service import weather_service

logger = logging.getLogger(__name__)

LANGUAGE_NAMES = {
    "en": "English",
    "he": "Hebrew (עברית)",
    "ar": "Arabic (العربية)",
    "es": "Spanish (Español)",
    "fr": "French (Français)",
    "de": "German (Deutsch)",
    "it": "Italian (Italiano)",
    "pt": "Portuguese (Português)",
    "ru": "Russian (Русский)",
    "ja": "Japanese (日本語)",
    "ko": "Korean (한국어)",
    "zh": "Chinese (中文)",
    "hi": "Hindi (हिन्दी)",
}


@dataclass(frozen=True)
class CategorizedWardrobe:
    """Structured slots for user wardrobe garments."""
    tops: list[dict[str, Any]] = field(default_factory=list)
    bottoms: list[dict[str, Any]] = field(default_factory=list)
    shoes: list[dict[str, Any]] = field(default_factory=list)
    dresses: list[dict[str, Any]] = field(default_factory=list)
    outerwear: list[dict[str, Any]] = field(default_factory=list)
    accessories: list[dict[str, Any]] = field(default_factory=list)
    all_items: list[dict[str, Any]] = field(default_factory=list)


@dataclass(frozen=True)
class GroundedStylingContext:
    """Complete, normalized styling context ready for LLM consumption."""
    user_id: str
    language: str
    user_profile: dict[str, Any]
    wardrobe: CategorizedWardrobe
    weather_summary: str | None
    calendar_summary: str | None
    system_prompt: str
    occasion: str | None


class StylingContext:
    """Deep module synthesizing grounding context for all AI Stylist workflows."""

    @staticmethod
    def _normalize_category(cat: Any) -> str:
        """Classify a garment category into one of the 6 canonical slots."""
        s = str(cat or "").strip().lower().replace(" ", "_").replace("-", "_")
        if s in (
            "top", "tops", "shirt", "shirts", "t_shirt", "tshirt", "tshirts",
            "polo", "sweater", "sweaters", "blouse", "blouses", "hoodie",
            "hoodies", "tank", "tank_top", "tanktop", "crop_top", "sweatshirt",
            "cardigan", "knitwear", "topwear"
        ):
            return "tops"
        if s in (
            "bottom", "bottoms", "pants", "shorts", "jeans", "skirt", "skirts",
            "trousers", "joggers", "leggings", "sweatpants", "chinos", "slacks",
            "bottomwear"
        ):
            return "bottoms"
        if s in (
            "footwear", "shoes", "shoe", "sneakers", "sneaker", "boots", "boot",
            "sandals", "sandal", "heels", "heel", "loafers", "loafer", "slides",
            "slippers", "flats"
        ):
            return "shoes"
        if s in (
            "dress", "dresses", "jumpsuit", "jumpsuits", "suit", "suits", "overall",
            "overalls", "dungaree", "dungarees", "full_body", "full_body_suit",
            "romper", "gown", "tracksuit", "bodysuit", "unitard"
        ):
            return "dresses"
        if s in (
            "outerwear", "jacket", "jackets", "coat", "coats", "blazer",
            "blazers", "parka", "trench", "vest", "overcoat"
        ):
            return "outerwear"
        return "accessories"

    @classmethod
    def _categorize_closet(cls, items: list[dict[str, Any]]) -> CategorizedWardrobe:
        """Bucket items into clean slots and attach transparent cutout URLs."""
        buckets: dict[str, list[dict[str, Any]]] = {
            "tops": [],
            "bottoms": [],
            "shoes": [],
            "dresses": [],
            "outerwear": [],
            "accessories": [],
        }
        clean_items: list[dict[str, Any]] = []

        for it in items:
            item_id = str(it.get("id") or it.get("_id") or "")
            if not item_id:
                continue
            cat_slot = cls._normalize_category(it.get("category"))
            clean_photo = (
                it.get("clean_image_url")
                or it.get("reconstructed_image_url")
                or it.get("thumbnail_data_url")
                or it.get("image_url")
                or it.get("photo_url")
            )
            item_doc = {
                "id": item_id,
                "title": it.get("title") or it.get("name") or "Garment",
                "category": it.get("category") or "top",
                "sub_category": it.get("sub_category") or it.get("item_type"),
                "color": it.get("color") or it.get("dominant_color"),
                "material": it.get("material"),
                "pattern": it.get("pattern"),
                "season": it.get("season"),
                "dress_code": it.get("dress_code") or it.get("formality"),
                "clean_image_url": clean_photo,
                "slot": cat_slot,
            }
            buckets[cat_slot].append(item_doc)
            clean_items.append(item_doc)

        return CategorizedWardrobe(
            tops=buckets["tops"],
            bottoms=buckets["bottoms"],
            shoes=buckets["shoes"],
            dresses=buckets["dresses"],
            outerwear=buckets["outerwear"],
            accessories=buckets["accessories"],
            all_items=clean_items,
        )

    @classmethod
    def _build_system_prompt(
        cls,
        *,
        language: str,
        user_profile: dict[str, Any],
        wardrobe: CategorizedWardrobe,
        weather: str | None,
        calendar: str | None,
        occasion: str | None,
        intent: str,
    ) -> str:
        """Construct a high-fidelity, multilingual fashion stylist prompt."""
        lang_label = LANGUAGE_NAMES.get(language, "English")
        name = user_profile.get("first_name") or user_profile.get("display_name") or "User"
        gender = user_profile.get("gender") or user_profile.get("avatar_gender") or "unspecified"
        aesthetics = ", ".join(user_profile.get("style_profile", {}).get("aesthetics") or ["Modern Chic"])
        colors_avoid = ", ".join(user_profile.get("style_profile", {}).get("avoid") or [])
        bm = user_profile.get("body_measurements") or {}

        measurements_str = f"Top: {bm.get('shirt_size', 'M')}, Bottom: {bm.get('pants_size', '30')}, Shoe: {bm.get('shoe_size', 'N/A')}"

        prompt = f"""You are the DressApp AI Senior Fashion Stylist & Atelier Director.
Your client is {name} (Gender: {gender}, Style Aesthetics: {aesthetics}).
Client Measurements: {measurements_str}.
Colors to avoid: {colors_avoid or 'None'}.

Active Weather Context: {weather or 'Moderate indoor/outdoor conditions'}.
Active Calendar Context: {calendar or 'Regular schedule'}.
Target Occasion / Intent: {occasion or intent}.

LANGUAGE CONTRACT:
- The user is conversing in {lang_label} (Language code: {language}).
- YOU MUST RESPOND EXCLUSIVELY IN {lang_label}.
- Use natural, culturally fluent fashion vocabulary suitable for {lang_label}.

WARDROBE INVENTORY (Available Items):
- Tops ({len(wardrobe.tops)} available): {[t['title'] + ' (ID: ' + t['id'] + ')' for t in wardrobe.tops[:20]]}
- Bottoms ({len(wardrobe.bottoms)} available): {[b['title'] + ' (ID: ' + b['id'] + ')' for b in wardrobe.bottoms[:20]]}
- Footwear ({len(wardrobe.shoes)} available): {[s['title'] + ' (ID: ' + s['id'] + ')' for s in wardrobe.shoes[:20]]}
- Dresses ({len(wardrobe.dresses)} available): {[d['title'] + ' (ID: ' + d['id'] + ')' for d in wardrobe.dresses[:10]]}
- Outerwear ({len(wardrobe.outerwear)} available): {[o['title'] + ' (ID: ' + o['id'] + ')' for o in wardrobe.outerwear[:10]]}

STYLING RULES:
1. Always prioritize complete, wearable outfits composed from the client's actual wardrobe items.
2. Pair a top + bottom + footwear, OR a dress + footwear, plus optional outerwear/accessories as weather demands.
3. Every recommendation must cite the exact item ID and explain why the color palette, silhouette, and fabric suit the client and weather.
"""
        return prompt

    @classmethod
    async def build(
        cls,
        user_id: str,
        *,
        intent: str = "chat",
        lat: float | None = None,
        lng: float | None = None,
        occasion: str | None = None,
        event_date: str | None = None,
        language: str | None = None,
        include_calendar: bool = True,
    ) -> GroundedStylingContext:
        """Synthesize the full grounded context for any stylist workflow."""
        db = get_db()
        
        # 1. Fetch User Profile
        user = await repos.find_one(db.users, {"id": user_id}) or {}
        active_lang = (language or user.get("preferred_language") or "en").lower().split("-")[0]

        # 2. Fetch Wardrobe with Projection (excluding raw base64)
        _PROJECTION = {
            "id": 1, "title": 1, "name": 1, "category": 1, "sub_category": 1,
            "color": 1, "material": 1, "pattern": 1, "season": 1, "dress_code": 1,
            "clean_image_url": 1, "reconstructed_image_url": 1, "thumbnail_data_url": 1, "image_url": 1
        }
        items = await repos.find_many(
            db.closet_items,
            {"user_id": user_id},
            sort=[("created_at", -1)],
            limit=200,
            projection=_PROJECTION,
        )
        wardrobe = cls._categorize_closet(items)

        # 3. Resolve Weather
        weather_summary: str | None = None
        user_lat = lat or user.get("home_location", {}).get("lat")
        user_lng = lng or user.get("home_location", {}).get("lng")
        if user_lat is not None and user_lng is not None:
            try:
                w_data = await weather_service.get_current_weather(float(user_lat), float(user_lng))
                if w_data:
                    temp_c = w_data.get("temperature_c") or w_data.get("temp")
                    desc = w_data.get("condition") or w_data.get("description") or "clear"
                    weather_summary = f"{temp_c}°C, {desc}"
            except Exception as w_exc:
                logger.debug("Weather resolution skipped: %s", w_exc)

        # 4. Resolve Calendar
        calendar_summary: str | None = None
        if include_calendar:
            try:
                events = await calendar_service.list_upcoming_events(user_id, limit=3)
                if events:
                    ev_titles = [f"{e.get('summary', 'Event')} at {e.get('start_time', '')}" for e in events]
                    calendar_summary = "; ".join(ev_titles)
            except Exception as c_exc:
                logger.debug("Calendar resolution skipped: %s", c_exc)

        # 5. Build Unified System Prompt
        sys_prompt = cls._build_system_prompt(
            language=active_lang,
            user_profile=user,
            wardrobe=wardrobe,
            weather=weather_summary,
            calendar=calendar_summary,
            occasion=occasion,
            intent=intent,
        )

        return GroundedStylingContext(
            user_id=user_id,
            language=active_lang,
            user_profile=user,
            wardrobe=wardrobe,
            weather_summary=weather_summary,
            calendar_summary=calendar_summary,
            system_prompt=sys_prompt,
            occasion=occasion,
        )