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
    assert "{DEFAULT_GENDER_HINT}" not in sys_prompt
    assert "Never default to 'men'" in sys_prompt or "never default to 'men'" in sys_prompt

    user_p = _user_prompt("en", user_gender="men")
    assert "'men'" in user_p
    assert "never default to 'men'" in user_p

    user_p_fem = _user_prompt("en", user_gender="women")
    assert "'women'" in user_p_fem
    assert "never default to 'men'" in user_p_fem


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


def test_crop_top_floral_coerced_to_women_even_if_user_men():
    """Crop tops and feminine floral tops must resolve to women even if user is a man."""
    crop_top = {
        "name": "Light Blue Floral Print Crop Top",
        "category": "top",
        "sub_category": "t-shirt",
        "item_type": "crop_top",
        "gender": "men",
    }
    res = _coerce_single_garment(crop_top, user_gender="men")
    assert res["gender"] == "women", f"Expected 'women', got '{res['gender']}'"

    hebrew_crop = {
        "name": "חולצת בטן פרחונית",
        "category": "top",
        "sub_category": "חולצת בטן",
        "item_type": "חולצת בטן",
        "gender": "men",
    }
    res_he = _coerce_single_garment(hebrew_crop, user_gender="men")
    assert res_he["gender"] == "women"


def test_athletic_tank_top_coerced_to_unisex():
    """Athletic tank tops and running singlets are unisex activewear."""
    tank_top = {
        "name": "Red Athletic Tank Top",
        "category": "top",
        "sub_category": "tank top",
        "item_type": "athletic_tank",
        "gender": "men",
    }
    res = _coerce_single_garment(tank_top, user_gender="men")
    assert res["gender"] == "unisex", f"Expected 'unisex', got '{res['gender']}'"

    singlet = {
        "name": "Pro Running Singlet",
        "category": "top",
        "sub_category": "singlet",
        "item_type": "running_singlet",
        "gender": "men",
    }
    res_singlet = _coerce_single_garment(singlet, user_gender="men")
    assert res_singlet["gender"] == "unisex"


def test_ai_explicit_women_or_unisex_not_overwritten_by_user_men():
    """When AI explicitly classifies as women or unisex, user_gender='men' must not overwrite it."""
    ai_women_item = {
        "name": "Silky Patterned Tunic",
        "category": "top",
        "sub_category": "tunic",
        "item_type": "patterned_tunic",
        "gender": "women",
    }
    res = _coerce_single_garment(ai_women_item, user_gender="men")
    assert res["gender"] == "women"

    res_enum = _coerce_enums(ai_women_item, user_gender="men")
    assert res_enum["gender"] == "women"


def test_human_model_gender_anchors_all_garments_in_outfit():
    """When a human model's gender is identified, all garments worn by that model anchor to that gender."""
    # 1. Men's model wearing a floral summer shirt (previously misclassified as blouse / women's)
    mens_floral = {
        "name": "Men's Casual Floral Summer Shirt",
        "category": "top",
        "sub_category": "blouse",
        "item_type": "Cap-Sleeve Blouse",
        "gender": "women",
        "title": "Casual Floral Shirt",
    }
    res_men = _coerce_single_garment(mens_floral, user_gender="women", model_gender="men")
    assert res_men["gender"] == "men"
    assert res_men["sub_category"] == "Shirt"
    assert res_men["item_type"] in ("Short-Sleeve Shirt", "Button-Down Shirt")

    # In _coerce_enums as well:
    res_men_enums = _coerce_enums(dict(mens_floral), user_gender="women", model_gender="men")
    assert res_men_enums["gender"] == "men"
    assert res_men_enums["sub_category"] == "Shirt"

    # 2. Women's model wearing an athletic singlet (normally unisex in flat-lay)
    womens_singlet = {
        "name": "Athletic Running Singlet",
        "category": "top",
        "sub_category": "singlet",
        "item_type": "running_singlet",
        "gender": "unisex",
        "title": "Running Singlet",
    }
    res_women = _coerce_single_garment(womens_singlet, user_gender="men", model_gender="women")
    assert res_women["gender"] == "women"

    res_women_enums = _coerce_enums(dict(womens_singlet), user_gender="men", model_gender="women")
    assert res_women_enums["gender"] == "women"


def test_batch_prompts_injects_human_model_gender_rule():
    """Verify that _build_batch_prompts injects the strict model gender rule when model_gender is provided."""
    from app.services.vision.llm import _build_batch_prompts

    sys_prompt, user_text = _build_batch_prompts(
        n=3,
        language="en",
        user_gender="unisex",
        model_gender="men",
    )
    assert "HUMAN MODEL OUTFIT GENDER: All garments in this outfit are worn by a visible men model" in sys_prompt
    assert "Do NOT classify any garment from this men's outfit as the opposite gender" in sys_prompt

    sys_prompt_flat, _ = _build_batch_prompts(
        n=3,
        language="en",
        user_gender="men",
        model_gender=None,
    )
    assert "HUMAN MODEL OUTFIT GENDER" not in sys_prompt_flat


def test_floral_print_short_sleeve_top_classified_as_women():
    """Floral print short sleeve top must classify as women's blouse/top, never men's tailored shirt."""
    item = {
        "title": "Floral Print Short Sleeve Top",
        "category": "Top",
        "sub_category": "Tailored Shirts",
        "item_type": "Crew-neck t-shi",
        "gender": "men",
        "caption": "A stylish light blue floral top with delicate blossoms and d)",
        "pattern": "floral",
    }
    coerced = _coerce_single_garment(item, user_gender="men")
    assert coerced["gender"] == "women"
    assert coerced["sub_category"] == "Blouse"
    assert "Tailored" not in coerced["sub_category"]
    assert coerced["item_type"] != "Crew-neck t-shi"
    assert coerced["caption"].endswith(".")
    assert not coerced["caption"].endswith("and d)")
    assert not coerced["caption"].endswith("and d.")

    enums = _coerce_enums(dict(coerced), user_gender="men")
    assert enums["gender"] == "women"
    assert enums["sub_category"] == "Blouse"
    assert enums["caption"].endswith(".")


def test_dress_code_inference():
    """Verify that dress codes are inferred from garment type rather than defaulting to casual."""
    # Button-down shirt -> smart-casual
    btn_shirt = {"category": "Top", "sub_category": "Shirt", "item_type": "Button-Down Shirt", "dress_code": "casual"}
    assert _coerce_enums(btn_shirt)["dress_code"] == "smart-casual"

    # Blazer -> business
    blazer = {"category": "Outerwear", "sub_category": "Jacket", "item_type": "Tailored Blazer"}
    assert _coerce_enums(blazer)["dress_code"] == "business"

    # Athletic tank -> athletic
    gym_tank = {"category": "Top", "sub_category": "tank top", "item_type": "athletic_tank"}
    assert _coerce_enums(gym_tank)["dress_code"] == "athletic"

    # Pajamas -> loungewear
    pajamas = {"category": "Bottom", "sub_category": "Pants", "item_type": "Silk Pajama Pants"}
    assert _coerce_enums(pajamas)["dress_code"] == "loungewear"

    # Tuxedo -> formal
    tux = {"category": "Outerwear", "sub_category": "Jacket", "item_type": "Black Tie Tuxedo"}
    assert _coerce_enums(tux)["dress_code"] == "formal"


def test_water_bottle_rejected_by_is_unidentifiable():
    """Handheld water bottles and non-clothing items must be identified as unidentifiable."""
    from app.services.vision.geometry import _is_unidentifiable
    bottle = {
        "title": "Insulated Stainless Steel Water Bottle",
        "category": "Accessories",
        "sub_category": "Messenger Bag",
        "item_type": "Water bottle",
        "caption": "Handheld insulated water bottle with carry loop.",
    }
    assert _is_unidentifiable(bottle) is True


