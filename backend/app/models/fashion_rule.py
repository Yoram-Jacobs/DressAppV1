"""Fashion Rule data model for Ground-Truth Knowledge Base.

Defines the structure for canonical styling rules across color harmony,
texture/material usage, silhouette proportions, weather/climate,
and cultural/modesty guidelines.
"""
from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


RuleCategory = Literal[
    "color_harmony",
    "texture_material",
    "silhouette_proportion",
    "weather_thermodynamics",
    "occasion_dress_code",
    "cultural_modesty",
]


class RuleActivationCriteria(BaseModel):
    """Conditions under which a fashion rule becomes active."""

    dress_codes: list[str] = Field(default_factory=list)
    min_temp_c: float | None = None
    max_temp_c: float | None = None
    requires_rain: bool | None = None
    modesty_levels: list[str] = Field(default_factory=list)  # e.g. ["conservative", "orthodox", "high"]
    requires_layering: bool | None = None
    tags: list[str] = Field(default_factory=list)
    primary_roles: list[str] = Field(default_factory=list)  # ["outerwear", "footwear", "top", "bottom"]


class FashionRule(BaseModel):
    """A canonical ground-truth fashion axiom."""

    id: str
    category: RuleCategory
    title: str
    rule_statement: str
    negative_constraint: str | None = None
    criteria: RuleActivationCriteria = Field(default_factory=RuleActivationCriteria)
    priority: int = 5  # 1 (lowest) to 10 (highest/hard constraint)
    example: str | None = None


class DesignerNotes(BaseModel):
    """Structured design rationale emitted by the Stylist Brain."""

    color_harmony: str | None = None
    texture_balance: str | None = None
    silhouette: str | None = None
    focal_piece: str | None = None
