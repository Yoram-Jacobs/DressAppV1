"""Unified thermal comfort, garment transition, and layering rules for DressApp.

Implements evidence-based thermoregulation and ASHRAE 55 clo-value transitions
used across both the daily Outfit Scheduler and the AI Stylist chat / QA engine.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any


_HIGH_EXERTION_KEYWORDS = (
    "run", "running", "jog", "jogging", "marathon", "sprint",
    "hike", "hiking", "trail", "trek", "trekking", "brisk walk",
    "gym", "workout", "exercise", "training", "cardio", "cycling",
    "bike", "biking", "sport", "sports", "athletic", "tennis", "soccer",
    "basketball", "fitness",
    "ריצה", "לרוץ", "אימון", "ספורט", "כושר", "טיול", "הליכה מהירה",
)

_WIND_SHADE_KEYWORDS = (
    "wind", "windy", "breeze", "breezy", "gust", "gusty", "gale",
    "overcast", "shade", "shady", "fog", "mist",
    "rain", "drizzle", "shower", "storm", "thunderstorm",
    "רוח", "מעונן", "גשם", "צל",
)

_SUNNY_KEYWORDS = (
    "clear", "sunny", "sun", "sunshine", "bright",
    "בהיר", "שמש", "שמשי",
)

_HEAVY_COAT_KEYWORDS = (
    "puffer", "parka", "overcoat", "wool coat", "down coat", "down jacket",
    "heavy coat", "winter coat", "shearling", "fur coat", "trench coat",
    "peacoat", "duffle coat", "anorak",
    "מעיל פוך", "מעיל צמר", "מעיל חורף", "מעיל כבד", "פארקה",
)

_LIGHT_LAYER_KEYWORDS = (
    "hoodie", "cardigan", "light jacket", "denim jacket", "bomber",
    "windbreaker", "blazer", "overshirt", "shacket", "zip-up", "pullover",
    "sweater", "knit", "vest", "gilet",
    "קפוצ'ון", "קרדיגן", "ג'קט קל", "בלייזר", "סוודר",
)


@dataclass(frozen=True)
class ThermalAssessment:
    raw_temp_c: float
    effective_temp_c: float
    band: str  # "warm_shorts" | "crossover" | "cool_layered" | "cold_full"
    clo_target: str
    shorts_allowed: bool
    heavy_coat_allowed: bool
    layering_need: str  # "none" | "carryable_light_layer" | "light_outerwear" | "medium_heavy_coat"
    target_season: str  # "summer" | "spring" | "autumn" | "winter"
    activity_level: str  # "high" | "casual"
    acclimatization: str  # "spring" | "autumn" | "neutral"
    sun_wind_factor: str  # "sunny_warm" | "wind_shade_cool" | "neutral"
    guidance_summary: str
    prompt_directive: str


def _extract_temp_c(weather: dict[str, Any] | None) -> float | None:
    if not weather or not isinstance(weather, dict):
        return None
    temp = weather.get("temp_c")
    if temp is None:
        temp = weather.get("temperature")
    if temp is None and isinstance(weather.get("main"), dict):
        temp = weather["main"].get("temp")
    if temp is None:
        return None
    try:
        return float(temp)
    except (ValueError, TypeError):
        return None


def _detect_activity_level(occasion: str = "", user_text: str = "") -> str:
    corpus = f"{occasion} {user_text}".lower()
    if any(kw in corpus for kw in _HIGH_EXERTION_KEYWORDS):
        return "high"
    return "casual"


def _detect_acclimatization(month: int | None = None) -> str:
    m = month or datetime.now().month
    if m in (3, 4, 5):
        return "spring"
    if m in (9, 10, 11):
        return "autumn"
    return "neutral"


def _detect_sun_wind_factor(weather: dict[str, Any], raw_temp_c: float) -> tuple[str, float]:
    """Return (factor_label, temp_shift_c) for sun vs wind/shade."""
    cond_text = " ".join([
        str(weather.get("condition") or ""),
        str(weather.get("description") or ""),
    ]).lower()

    wind_speed = weather.get("wind_speed")
    has_steady_wind = False
    if wind_speed is not None:
        try:
            # OpenWeatherMap metric wind_speed is m/s; >= 4.5 m/s (~16 km/h) is a steady breeze
            has_steady_wind = float(wind_speed) >= 4.5
        except (ValueError, TypeError):
            has_steady_wind = False

    if has_steady_wind or any(kw in cond_text for kw in _WIND_SHADE_KEYWORDS):
        # Shade or steady breeze lowers perceived temperature by 3°C to 4°C
        shift = -3.5
        feels = weather.get("feels_like_c")
        if feels is not None:
            try:
                feels_val = float(feels)
                if feels_val < raw_temp_c:
                    # Respect real feels_like_c if already colder, capped at -4°C to -3°C band
                    shift = max(-4.5, min(-3.0, feels_val - raw_temp_c))
            except (ValueError, TypeError):
                pass
        return "wind_shade_cool", shift

    if any(kw in cond_text for kw in _SUNNY_KEYWORDS):
        # Direct sunlight makes 18°C feel closer to 21–22°C
        return "sunny_warm", 3.0

    return "neutral", 0.0


def assess_thermal_comfort(
    weather: dict[str, Any] | None,
    *,
    occasion: str = "",
    user_text: str = "",
    month: int | None = None,
) -> ThermalAssessment | None:
    """Compute thermal comfort band, shorts threshold, and layering directive."""
    raw_temp_c = _extract_temp_c(weather)
    if raw_temp_c is None:
        return None

    weather = weather or {}
    activity_level = _detect_activity_level(occasion, user_text)
    acclimatization = _detect_acclimatization(month)
    sun_wind_factor, sun_wind_shift = _detect_sun_wind_factor(weather, raw_temp_c)

    # Seasonal acclimatization shift:
    # Spring tolerates cooler temps better (+1.5°C); Autumn feels brisk after summer (-1.5°C)
    season_shift = 1.5 if acclimatization == "spring" else (-1.5 if acclimatization == "autumn" else 0.0)

    effective_temp_c = round(raw_temp_c + sun_wind_shift + season_shift, 1)

    # Determine band based on effective temperature
    if effective_temp_c > 22.0:
        band = "warm_shorts"
        clo_target = "~0.36 clo"
        layering_need = "none"
        target_season = "summer"
        heavy_coat_allowed = False
    elif effective_temp_c >= 18.0:
        band = "crossover"
        clo_target = "~0.45-0.55 clo"
        layering_need = "carryable_light_layer"
        target_season = "autumn" if acclimatization == "autumn" else "spring"
        heavy_coat_allowed = False
    elif effective_temp_c >= 14.0:
        band = "cool_layered"
        clo_target = "~0.61 clo"
        layering_need = "light_outerwear"
        target_season = "autumn" if acclimatization == "autumn" else "spring"
        heavy_coat_allowed = False
    else:
        band = "cold_full"
        clo_target = ">=0.61-1.0+ clo"
        layering_need = "medium_heavy_coat"
        target_season = "winter"
        heavy_coat_allowed = True

    # Shorts threshold:
    # - Casual/stationary: switch to long pants near 18-20°C; shorts allowed when effective_temp_c > 20.5°C
    #   (or >= 18°C raw when direct sun pushes perceived temp >= 21°C).
    # - High physical exertion (running/hiking/workout): shorts remain comfortable down to 10-15°C.
    if activity_level == "high":
        shorts_allowed = raw_temp_c >= 10.0 and effective_temp_c >= 10.0
    else:
        shorts_allowed = effective_temp_c >= 21.0

    # Build human-readable summary and LLM prompt directive
    factor_notes: list[str] = []
    if sun_wind_factor == "sunny_warm":
        factor_notes.append("direct sunlight (+3°C perceived warmth)")
    elif sun_wind_factor == "wind_shade_cool":
        factor_notes.append("wind/shade (-3°C to -4°C perceived cooling)")
    if acclimatization == "spring":
        factor_notes.append("spring acclimatization (higher cool tolerance)")
    elif acclimatization == "autumn":
        factor_notes.append("autumn acclimatization (18°C feels brisker after summer)")
    if activity_level == "high":
        factor_notes.append("high physical exertion (metabolic heat lowers shorts threshold to 10-15°C)")

    factors_str = "; ".join(factor_notes) if factor_notes else "standard conditions"

    if band == "warm_shorts":
        guidance_summary = (
            f"Above 22°C ({raw_temp_c:.0f}°C, effective {effective_temp_c:.0f}°C): "
            f"Shorts and short sleeves (~0.36 clo minimal insulation for heat dissipation)."
        )
    elif band == "crossover":
        if shorts_allowed:
            guidance_summary = (
                f"Crossover Zone ({raw_temp_c:.0f}°C, effective {effective_temp_c:.0f}°C): "
                f"Shorts remain viable due to {factors_str}, or pair light trousers/jeans with a T-shirt + carryable light layer."
            )
        else:
            guidance_summary = (
                f"Crossover Zone ({raw_temp_c:.0f}°C, effective {effective_temp_c:.0f}°C): "
                f"Replace shorts with light trousers or jeans, paired with a T-shirt and a carryable light layer."
            )
    elif band == "cool_layered":
        if activity_level == "high" and shorts_allowed:
            guidance_summary = (
                f"Cool Band 14-17°C ({raw_temp_c:.0f}°C, effective {effective_temp_c:.0f}°C): "
                f"Active/exertion allows athletic shorts (10-15°C+); otherwise pair long pants with light outerwear (hoodie, cardigan, light jacket)."
            )
        else:
            guidance_summary = (
                f"Cool Band 14-17°C ({raw_temp_c:.0f}°C, effective {effective_temp_c:.0f}°C): "
                f"Long pants + light outerwear (hoodie, cardigan, or light jacket; ~0.61 clo). Avoid shorts."
            )
    else:
        guidance_summary = (
            f"Cold Band <=13°C ({raw_temp_c:.0f}°C, effective {effective_temp_c:.0f}°C): "
            f"Full long outfit required: long trousers, long-sleeve shirt, and medium-to-heavy coat ({clo_target})."
        )

    prompt_directive = (
        f"THERMAL COMFORT & LAYERING ({clo_target} | {factors_str}):\n"
        f"- {guidance_summary}\n"
        f"- Shorts allowed: {'YES' if shorts_allowed else 'NO (use long trousers/jeans)'}. "
        f"Heavy winter coats allowed: {'YES' if heavy_coat_allowed else 'NO'}."
    )

    return ThermalAssessment(
        raw_temp_c=raw_temp_c,
        effective_temp_c=effective_temp_c,
        band=band,
        clo_target=clo_target,
        shorts_allowed=shorts_allowed,
        heavy_coat_allowed=heavy_coat_allowed,
        layering_need=layering_need,
        target_season=target_season,
        activity_level=activity_level,
        acclimatization=acclimatization,
        sun_wind_factor=sun_wind_factor,
        guidance_summary=guidance_summary,
        prompt_directive=prompt_directive,
    )


def format_thermal_guidance(
    weather: dict[str, Any] | None,
    *,
    occasion: str = "",
    user_text: str = "",
    month: int | None = None,
) -> str:
    """Return formatted thermal comfort & layering guidance for LLM prompts, or ''."""
    assessment = assess_thermal_comfort(
        weather, occasion=occasion, user_text=user_text, month=month
    )
    return assessment.prompt_directive if assessment else ""


def is_heavy_coat_garment(item: dict[str, Any]) -> bool:
    """Detect medium-to-heavy winter coats/puffers/parkas unsuitable for warm weather."""
    text = " ".join([
        str(item.get("title") or ""),
        str(item.get("name") or ""),
        str(item.get("description") or ""),
        str(item.get("category") or ""),
        str(item.get("sub_category") or ""),
        str(item.get("material") or ""),
        " ".join(str(t) for t in (item.get("tags") or [])),
    ]).lower()
    if any(kw in text for kw in _HEAVY_COAT_KEYWORDS):
        return True
    if "coat" in text and not any(lt in text for lt in ("raincoat", "light", "linen")):
        return True
    return False
