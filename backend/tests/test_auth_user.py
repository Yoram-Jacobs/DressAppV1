import pytest
from app.services.auth import AuthenticatedUser
from app.models.schemas import User


def test_authenticated_user_dict_and_model_compatibility():
    raw_doc = {
        "id": "usr_999",
        "email": "fashionista@dressapp.co",
        "display_name": "Fashion Pro",
        "roles": ["user", "stylist"],
        "preferred_language": "fr",
        "ai_configuration": {
            "selected_model": "gemini-3.5-flash",
            "custom_keys": {"google_ai": "AIzaSyFakeKey1234567890"},
        },
        "custom_unmodeled_field": "experimental_value",
    }

    user = AuthenticatedUser.from_doc(raw_doc)
    assert user is not None

    # 1. isinstance checks
    assert isinstance(user, dict)
    assert isinstance(user, AuthenticatedUser)

    # 2. Dict access patterns
    assert user["id"] == "usr_999"
    assert user["email"] == "fashionista@dressapp.co"
    assert user.get("roles") == ["user", "stylist"]
    assert user.get("nonexistent", "fallback") == "fallback"
    assert "display_name" in user
    assert "ai_configuration" in user
    assert user["custom_unmodeled_field"] == "experimental_value"

    # 3. Typed attribute access patterns
    assert user.id == "usr_999"
    assert user.email == "fashionista@dressapp.co"
    assert user.display_name == "Fashion Pro"
    assert user.roles == ["user", "stylist"]
    assert user.preferred_language == "fr"
    assert user.ai_configuration["selected_model"] == "gemini-3.5-flash"
    assert user.custom_unmodeled_field == "experimental_value"

    # 4. Pydantic model backing
    assert user.model is not None
    assert isinstance(user.model, User)
    assert user.model.id == "usr_999"
    assert user.model.email == "fashionista@dressapp.co"
    assert user.model.roles == ["user", "stylist"]
    assert user.model.ai_configuration["selected_model"] == "gemini-3.5-flash"


def test_authenticated_user_none_handling():
    assert AuthenticatedUser.from_doc(None) is None


def test_authenticated_user_missing_attr_raises_attribute_error():
    user = AuthenticatedUser.from_doc({"id": "u1", "email": "a@b.com"})
    with pytest.raises(AttributeError):
        _ = user.completely_nonexistent_attribute
