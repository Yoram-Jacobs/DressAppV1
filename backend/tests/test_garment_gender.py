import pytest
from app.services.vision.validation import (
    resolve_garment_gender,
    _coerce_single_garment,
    _coerce_enums,
)
from app.services.vision.llm import (
    _build_system_prompt,
    _user_prompt,
)
from app.services.vision.service import (
    GarmentVisionService,
    get_garment_vision_service,
)


def test_resolve_garment_gender_tokens():
    """Verify alias mapping and standardisation of gender tokens."""
    assert resolve_garment_gender("male") == "men"
    assert resolve_garment_gender("man") == "men"
    assert resolve_garment_gender("men") == "men"
    assert resolve_garment_gender("גבר") == "men"
    assert resolve_garment_gender("זכר") == "men"

    assert resolve_garment_gender("female") == "women"
    assert resolve_garment_gender("woman") == "women"
    assert resolve_garment_gender("women") == "women"
    assert resolve_garment_gender("אישה") == "women"
    assert resolve_garment_gender("נקבה") == "women"

    assert resolve_garment_gender("unisex") == "unisex"
    assert resolve_garment_gender("kids") == "kids"
    assert resolve_garment_gender("boy") == "kids"
    assert resolve_garment_gender("girl") == "kids"
    assert resolve_garment_gender("children") == "kids"
    assert resolve_garment_gender("ילדים") == "kids"
    assert resolve_garment_gender("ילדה") == "kids"

    # Invalid / empty
    assert resolve_garment_gender("") is None
    assert resolve_garment_gender(None) is None
    assert resolve_garment_gender("alien") is None


def test_resolve_garment_gender_from_user_dict():
    """Verify extracting gender from user dictionary."""
    assert resolve_garment_gender({"gender": "male"}) == "men"
    assert resolve_garment_gender({"sex": "female"}) == "women"
    assert resolve_garment_gender({"profile": {"gender": "men"}}) == "men"
    assert resolve_garment_gender({"gender": "זכר"}) == "men"
    assert resolve_garment_gender({}) is None


def test_size_s_graphic_tee_not_coerced_to_women():
    """A graphic tee with size 'S' or 'XS' must NOT be forcibly coerced to 'women'."""
    parsed = {
        "category": "top",
        "sub_category": "t-shirt",
        "size": "S",
        "gender": "men",
        "title": "Cat Yin-Yang Graphic Tee",
    }
    result = _coerce_single_garment(parsed, user_gender="men")
    assert result["gender"] == "men"

    parsed_unisex = {
        "category": "top",
        "sub_category": "t-shirt",
        "size": "XS",
        "gender": "unisex",
        "title": "Minimalist Tee",
    }
    result_unisex = _coerce_single_garment(parsed_unisex, user_gender="men")
    assert result_unisex["gender"] == "unisex"


def test_pastel_or_light_blue_not_forced_to_women():
    """Non-gendered pastel or light blue colors must not coerce a men's top to 'women'."""
    parsed = {
        "category": "top",
        "sub_category": "t-shirt",
        "colors": [{"name": "light blue"}],
        "gender": "men",
        "title": "Sky Blue Tee",
    }
    result = _coerce_single_garment(parsed, user_gender="men")
    assert result["gender"] == "men"


def test_inherently_gendered_items_coerced_correctly():
    """Dresses/skirts/blouses must coerce to women; tuxedos/boxers coerce to men."""
    dress = {
        "category": "one-piece",
        "sub_category": "summer dress",
        "gender": "unisex",
    }
    res_dress = _coerce_single_garment(dress, user_gender="men")
    assert res_dress["gender"] == "women"

    tux = {
        "category": "outerwear",
        "sub_category": "tuxedo jacket",
        "gender": "unisex",
    }
    res_tux = _coerce_single_garment(tux, user_gender="women")
    assert res_tux["gender"] == "men"


def test_unrecognized_gender_defaults_to_user_gender():
    """Unrecognized gender defaults to the user's profile gender, or unisex if absent."""
    item_unknown = {
        "category": "top",
        "sub_category": "hoodie",
        "gender": "unknown_value",
    }
    # User is male
    res_male = _coerce_single_garment(item_unknown, user_gender="men")
    assert res_male["gender"] == "men"

    # User is female
    res_female = _coerce_single_garment(item_unknown, user_gender="women")
    assert res_female["gender"] == "women"

    # No user gender
    res_none = _coerce_single_garment(item_unknown, user_gender=None)
    assert res_none["gender"] == "unisex"


def test_system_prompt_and_user_prompt_gender_hints():
    """Verify that system and user prompts include the user's gender hint."""
    sys_prompt = _build_system_prompt(user_gender="men")
    assert "default to 'men'" in sys_prompt or "default to men" in sys_prompt or "{DEFAULT_GENDER_HINT}" not in sys_prompt

    user_p = _user_prompt("en", user_gender="men")
    assert "default to 'men'" in user_p

    user_p_fem = _user_prompt("en", user_gender="women")
    assert "default to 'women'" in user_p_fem


def test_get_garment_vision_service_scopes_user_gender():
    """Verify get_garment_vision_service passes user gender to the service instance."""
    male_user = {"id": "u1", "gender": "male"}
    svc_male = get_garment_vision_service(user=male_user)
    assert svc_male is not None
    assert svc_male.user_gender == "men"

    fem_user = {"id": "u2", "sex": "female"}
    svc_fem = get_garment_vision_service(user=fem_user)
    assert svc_fem is not None
    assert svc_fem.user_gender == "women"
