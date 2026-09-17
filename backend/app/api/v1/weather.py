"""Weather API router for real-time and forecast conditions."""
from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.services.auth import get_current_user_optional
from app.services.weather_service import weather_service

logger = logging.getLogger("dressapp.weather")

router = APIRouter(prefix="/weather", tags=["weather"])


@router.get("")
@router.get("/")
async def get_weather(
    lat: float | None = Query(default=None, description="Latitude"),
    lng: float | None = Query(default=None, description="Longitude"),
    units: str = Query(default="metric", description="Units (metric/imperial)"),
    lang: str | None = Query(default=None, description="Language code (e.g. en, he, es, fr)"),
    user: dict | None = Depends(get_current_user_optional),
) -> dict[str, Any]:
    """Fetch current and tomorrow's localized weather forecast."""
    if not weather_service:
        return {
            "city": "Local",
            "country": "",
            "temp_c": 20,
            "condition": "Clear",
            "description": "Clear Sky",
            "tomorrow": {
                "temp_c": 21,
                "temp_max_c": 23,
                "temp_min_c": 16,
                "condition": "Clear",
                "description": "Clear Sky",
                "icon": "01d",
            },
        }

    resolved_lat = lat
    resolved_lng = lng

    if (resolved_lat is None or resolved_lng is None) and user:
        home_loc = user.get("home_location") or user.get("location")
        if isinstance(home_loc, dict):
            resolved_lat = home_loc.get("lat") or home_loc.get("latitude")
            resolved_lng = home_loc.get("lng") or home_loc.get("lon") or home_loc.get("longitude")

    if resolved_lat is None or resolved_lng is None:
        resolved_lat = 32.0853
        resolved_lng = 34.7818

    resolved_lang = lang
    if not resolved_lang and user:
        resolved_lang = user.get("preferred_language") or user.get("language")

    try:
        data = await weather_service.fetch(
            lat=float(resolved_lat),
            lng=float(resolved_lng),
            units=units,
            lang=resolved_lang,
        )
        return data
    except Exception as exc:
        logger.warning("Failed to fetch weather for lat=%s lng=%s: %s", resolved_lat, resolved_lng, exc)
        return {
            "city": "Local",
            "country": "",
            "temp_c": 20,
            "condition": "Clear",
            "description": "Clear Sky",
            "tomorrow": {
                "temp_c": 21,
                "temp_max_c": 23,
                "temp_min_c": 16,
                "condition": "Clear",
                "description": "Clear Sky",
                "icon": "01d",
            },
        }
