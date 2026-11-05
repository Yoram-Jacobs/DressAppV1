"""Re-export of the Enterprise 3D Virtual Dressing Room router."""
from app.api.v1.dressing_room import (
    AvatarMeasurementsRequest,
    FitOutfitRequest,
    LAYER_RADIAL_OFFSETS,
    OutfitGarmentItem,
    create_morphed_avatar,
    fit_outfit_layers,
    get_dressing_room_model,
    router,
)

__all__ = [
    "AvatarMeasurementsRequest",
    "FitOutfitRequest",
    "LAYER_RADIAL_OFFSETS",
    "OutfitGarmentItem",
    "create_morphed_avatar",
    "fit_outfit_layers",
    "get_dressing_room_model",
    "router",
]
