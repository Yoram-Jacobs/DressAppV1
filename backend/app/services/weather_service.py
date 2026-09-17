"""OpenWeatherMap client — fetch current conditions and a short forecast.

We use the free `data/2.5/weather` endpoint (current) and `data/2.5/forecast`
(3-hour steps) because the OneCall 3.0 endpoint requires a different plan.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

OWM_BASE = "https://api.openweathermap.org/data/2.5"


class WeatherService:
    def __init__(self) -> None:
        if not settings.OPENWEATHER_API_KEY:
            raise RuntimeError("OPENWEATHER_API_KEY is not configured.")
        self.api_key = settings.OPENWEATHER_API_KEY

    async def fetch(
        self,
        lat: float,
        lng: float,
        units: str = "metric",
        lang: str | None = None,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {
            "lat": lat,
            "lon": lng,
            "units": units,
            "appid": self.api_key,
        }
        # OpenWeather returns localized `description` strings when `lang` is
        # passed. It accepts BCP-47-style 2-letter codes (en, he, ar, es, …)
        # which is exactly the shape of our `preferred_language`.
        if lang:
            params["lang"] = lang.lower()[:2]
        async with httpx.AsyncClient(timeout=15.0) as client:
            from app.services import provider_activity

            async with provider_activity.Track("openweather", {"lat": lat, "lng": lng}):
                cur_resp = await client.get(f"{OWM_BASE}/weather", params=params)
                fc_resp = await client.get(f"{OWM_BASE}/forecast", params=params)

        cur_resp.raise_for_status()
        fc_resp.raise_for_status()
        current = cur_resp.json()
        forecast = fc_resp.json()

        summary = {
            "temp_c": _safe_get(current, ["main", "temp"]),
            "feels_like_c": _safe_get(current, ["main", "feels_like"]),
            "humidity": _safe_get(current, ["main", "humidity"]),
            "condition": _safe_get(current, ["weather", 0, "main"]),
            "description": _safe_get(current, ["weather", 0, "description"]),
            "wind_speed": _safe_get(current, ["wind", "speed"]),
            "city": current.get("name"),
            "country": _safe_get(current, ["sys", "country"]),
            "forecast_next_24h": _summarize_forecast(forecast.get("list", [])[:8]),
            "tomorrow": _extract_tomorrow_forecast(forecast.get("list", [])),
        }
        logger.info(
            "Weather fetched city=%s temp=%s cond=%s tomorrow=%s",
            summary["city"],
            summary["temp_c"],
            summary["condition"],
            summary.get("tomorrow"),
        )
        return summary


def _safe_get(d: Any, path: list[Any]) -> Any:
    cur = d
    for key in path:
        try:
            cur = cur[key]
        except (KeyError, IndexError, TypeError):
            return None
    return cur


def _summarize_forecast(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for e in entries:
        out.append(
            {
                "at": e.get("dt_txt"),
                "temp_c": _safe_get(e, ["main", "temp"]),
                "condition": _safe_get(e, ["weather", 0, "main"]),
                "pop": e.get("pop"),
            }
        )
    return out


def _extract_tomorrow_forecast(entries: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not entries:
        return None
    from datetime import datetime, timezone, timedelta
    now_utc = datetime.now(timezone.utc)
    tomorrow_date_str = (now_utc + timedelta(days=1)).strftime("%Y-%m-%d")
    
    tomorrow_entries = [e for e in entries if str(e.get("dt_txt", "")).startswith(tomorrow_date_str)]
    if not tomorrow_entries:
        tomorrow_entries = entries[8:16] if len(entries) >= 16 else entries[4:]
        
    if not tomorrow_entries:
        return None
        
    midday_entry = next(
        (e for e in tomorrow_entries if "12:00" in str(e.get("dt_txt", "")) or "15:00" in str(e.get("dt_txt", ""))),
        tomorrow_entries[len(tomorrow_entries) // 2],
    )
    
    temps = [float(e.get("main", {}).get("temp")) for e in tomorrow_entries if _safe_get(e, ["main", "temp"]) is not None]
    max_temp = round(max(temps)) if temps else round(float(_safe_get(midday_entry, ["main", "temp"]) or 20))
    min_temp = round(min(temps)) if temps else round(float(_safe_get(midday_entry, ["main", "temp"]) or 15))
    avg_temp = round(sum(temps) / len(temps)) if temps else round(float(_safe_get(midday_entry, ["main", "temp"]) or 18))
    
    weather_obj = _safe_get(midday_entry, ["weather", 0]) or {}
    condition = weather_obj.get("main") or "Clear"
    description = weather_obj.get("description") or condition
    icon = weather_obj.get("icon") or "01d"
    
    return {
        "temp_c": round(float(_safe_get(midday_entry, ["main", "temp"]) or avg_temp)),
        "temp_max_c": max_temp,
        "temp_min_c": min_temp,
        "condition": condition,
        "description": description.title() if description else "Clear Sky",
        "icon": icon,
        "date": tomorrow_date_str,
    }


weather_service = WeatherService() if settings.OPENWEATHER_API_KEY else None
