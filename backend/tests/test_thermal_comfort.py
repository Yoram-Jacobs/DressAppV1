"""Unit tests for thermal comfort, garment transition, and layering rules."""
import pytest

from app.services.fashion_rules_rag import retrieve_fashion_axioms
from app.services.gemini_stylist import prepare_stylist_prompt
from app.services.stylist_qa_engine import filter_candidate_closet_by_axioms
from app.services.thermal_comfort import (
    assess_thermal_comfort,
    format_thermal_guidance,
    is_heavy_coat_garment,
)


def test_temperature_bands_and_clo_targets():
    """Verify all 4 temperature bands under neutral conditions."""
    warm = assess_thermal_comfort({"temp_c": 24, "condition": "Partly Cloudy"}, month=7)
    assert warm is not None
    assert warm.band == "warm_shorts"
    assert warm.shorts_allowed is True
    assert warm.heavy_coat_allowed is False
    assert warm.layering_need == "none"
    assert "0.36" in warm.clo_target

    crossover = assess_thermal_comfort({"temp_c": 19, "condition": "Partly Cloudy"}, month=7)
    assert crossover is not None
    assert crossover.band == "crossover"
    assert crossover.shorts_allowed is False
    assert crossover.layering_need == "carryable_light_layer"

    cool = assess_thermal_comfort({"temp_c": 15, "condition": "Partly Cloudy"}, month=7)
    assert cool is not None
    assert cool.band == "cool_layered"
    assert cool.shorts_allowed is False
    assert cool.layering_need == "light_outerwear"
    assert "0.61" in cool.clo_target

    cold = assess_thermal_comfort({"temp_c": 12, "condition": "Partly Cloudy"}, month=7)
    assert cold is not None
    assert cold.band == "cold_full"
    assert cold.shorts_allowed is False
    assert cold.heavy_coat_allowed is True
    assert cold.layering_need == "medium_heavy_coat"


def test_sun_vs_wind_and_shade_shifts_threshold():
    """Direct sun at 18°C makes it feel ~21°C (shorts possible); wind/shade drops 21°C to ~17.5°C."""
    sunny_18 = assess_thermal_comfort({"temp_c": 18, "condition": "Clear", "wind_speed": 1.5}, month=7)
    assert sunny_18 is not None
    assert sunny_18.sun_wind_factor == "sunny_warm"
    assert sunny_18.effective_temp_c == 21.0
    assert sunny_18.shorts_allowed is True

    windy_21 = assess_thermal_comfort({"temp_c": 21, "condition": "Overcast", "wind_speed": 6.0}, month=7)
    assert windy_21 is not None
    assert windy_21.sun_wind_factor == "wind_shade_cool"
    assert windy_21.effective_temp_c <= 18.0
    assert windy_21.shorts_allowed is False


def test_activity_level_lowers_shorts_threshold():
    """Runners/hikers tolerate shorts down to 10-15°C; casual walkers switch to pants."""
    casual_13 = assess_thermal_comfort({"temp_c": 13, "condition": "Partly Cloudy"}, occasion="Coffee walk", month=7)
    assert casual_13 is not None
    assert casual_13.activity_level == "casual"
    assert casual_13.shorts_allowed is False

    runner_13 = assess_thermal_comfort(
        {"temp_c": 13, "condition": "Partly Cloudy"},
        occasion="Morning running",
        user_text="Outfit for a 5k run",
        month=7,
    )
    assert runner_13 is not None
    assert runner_13.activity_level == "high"
    assert runner_13.shorts_allowed is True


def test_seasonal_acclimatization_spring_vs_autumn():
    """Spring tolerates cooler temps in shorts better than Autumn after summer heat."""
    spring_20 = assess_thermal_comfort({"temp_c": 20, "condition": "Partly Cloudy"}, month=4)
    autumn_20 = assess_thermal_comfort({"temp_c": 20, "condition": "Partly Cloudy"}, month=10)
    assert spring_20 is not None and autumn_20 is not None
    assert spring_20.acclimatization == "spring"
    assert autumn_20.acclimatization == "autumn"
    assert spring_20.effective_temp_c > autumn_20.effective_temp_c
    assert spring_20.shorts_allowed is True
    assert autumn_20.shorts_allowed is False


def test_rag_retrieves_full_weather_spectrum():
    """Verify RAG covers cold coats (<=13°C), cool layered (14-17°C), crossover (18-22°C), and warm (>22°C)."""
    cold_ids = [r.id for r in retrieve_fashion_axioms(weather={"temp_c": 11, "condition": "Cloudy"})]
    assert "rule_weather_cold_full_coats" in cold_ids

    cool_ids = [r.id for r in retrieve_fashion_axioms(weather={"temp_c": 16, "condition": "Partly Cloudy"})]
    assert "rule_weather_transitional_layering" in cool_ids

    cross_ids = [r.id for r in retrieve_fashion_axioms(weather={"temp_c": 20, "condition": "Partly Cloudy"})]
    assert "rule_weather_crossover_transition" in cross_ids

    warm_ids = [r.id for r in retrieve_fashion_axioms(weather={"temp_c": 26, "condition": "Sunny"})]
    assert "rule_weather_summer_breathability" in warm_ids


def test_qa_prefilter_enforces_thermal_constraints():
    """Verify candidate pre-filter purges casual shorts in cold weather and heavy coats in warm weather."""
    closet = [
        {"id": "1", "title": "Chino Shorts", "category": "bottom"},
        {"id": "2", "title": "Dark Denim Jeans", "category": "bottom"},
        {"id": "3", "title": "Heavy Down Puffer Coat", "category": "outerwear"},
    ]
    assert is_heavy_coat_garment(closet[2]) is True

    cold_axioms = retrieve_fashion_axioms(weather={"temp_c": 11, "condition": "Cloudy"})
    compliant_cold, purged_cold = filter_candidate_closet_by_axioms(closet, cold_axioms)
    assert {it["id"] for it in compliant_cold} == {"2", "3"}
    assert [it["id"] for it in purged_cold] == ["1"]

    warm_axioms = retrieve_fashion_axioms(weather={"temp_c": 27, "condition": "Sunny"})
    compliant_warm, purged_warm = filter_candidate_closet_by_axioms(closet, warm_axioms)
    assert {it["id"] for it in compliant_warm} == {"1", "2"}
    assert [it["id"] for it in purged_warm] == ["3"]


@pytest.mark.asyncio
async def test_stylist_prompt_includes_thermal_guidance():
    """Verify prepare_stylist_prompt injects thermal comfort & layering guidance."""
    sys_msg, _ = await prepare_stylist_prompt(
        session_id="s1",
        user_text="What should I wear today?",
        weather={"temp_c": 19, "condition": "Partly Cloudy"},
        closet_summary=[
            {"id": "t1", "title": "White Tee", "category": "top"},
            {"id": "b1", "title": "Light Jeans", "category": "bottom"},
            {"id": "s1", "title": "Sneakers", "category": "shoes"},
        ],
    )
    assert "THERMAL COMFORT & LAYERING" in sys_msg
    assert "Shorts allowed: NO" in sys_msg
    assert format_thermal_guidance({"temp_c": 19, "condition": "Windy"}) != ""
