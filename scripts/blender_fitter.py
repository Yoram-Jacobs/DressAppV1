"""
Automated 3D Garment & Accessory Fitting Pipeline for Blender (`scripts/blender_fitter.py`)

Implements the 9-Layer Collision Protocol (Complete Body, Footwear & Accessories Hierarchy)
and Specialized Accessory Fitting & Attachment Rules for DressApp's 3D Try-On Studio.

Complete Layer Hierarchy & Radial Offsets:
  - Layer 0 (Avatar Body):                          0.000m
  - Layer 1 (Undergarments / Base Tops / Socks):   +0.003m (3mm)
  - Layer 2 (Footwear - Low Shoes / Sneakers):     +0.004m (4mm)
  - Layer 3 (Bottoms - Trousers / Jeans / Skirts): +0.007m (7mm)
  - Layer 4 (Mid-Layers - Sweaters / Shirts):      +0.010m (10mm)
  - Layer 5 (Waist Accessories - Belts / Sashes):  +0.011m (11mm, or +0.002m over active bottom)
  - Layer 6 (Footwear - Mid & High-Shaft Boots):   +0.013m (13mm above legs/bottoms)
  - Layer 7 (Outerwear - Cardigans / Coats):       +0.016m (16mm)
  - Layer 8 (Outer Accessories - Scarves / Bags):  +0.019m (19mm, draping over jackets & collars)
"""

try:
    import bpy
except ImportError:
    bpy = None


LAYER_OFFSETS = {
    "avatar_body": 0.000,       # Layer 0: Base reference target
    "undergarment": 0.003,      # Layer 1: Undergarments / Base Tops / Socks (+3mm)
    "base_top": 0.003,          # Layer 1: Inner / tucked / base tops (+3mm)
    "socks": 0.003,             # Layer 1: Socks (+3mm)
    "low_shoes": 0.004,         # Layer 2: Footwear - Low Shoes / Sneakers (+4mm)
    "sneakers": 0.004,          # Layer 2: Sneakers (+4mm)
    "bottom": 0.007,            # Layer 3: Bottoms - Trousers / Jeans / Skirts (+7mm)
    "trousers": 0.007,          # Layer 3: Trousers / Jeans (+7mm)
    "skirt": 0.007,             # Layer 3: Skirts (+7mm)
    "mid_layer": 0.010,         # Layer 4: Mid-Layers - Sweaters / Untucked Shirts (+10mm)
    "top": 0.010,               # Layer 4: Standalone / Untucked Top (+10mm)
    "dress": 0.010,             # Layer 4: Dresses / Full-Body Garments (+10mm)
    "belt": 0.011,              # Layer 5: Waist Accessories - Belts / Sashes (+11mm on body, +2mm on bottom)
    "belt_over_bottom": 0.002,  # Layer 5 Dynamic Target: +2mm relative to active bottom_garment_obj
    "boots": 0.013,             # Layer 6: Footwear - Mid & High-Shaft Boots (+13mm)
    "outerwear": 0.016,         # Layer 7: Outerwear - Cardigans / Jackets / Coats (+16mm)
    "outer_accessory": 0.019,   # Layer 8: Outer Accessories - Scarves / Shawls (+19mm)
    "scarf": 0.019,             # Layer 8: Scarves / Shawls (+19mm)
    "bag_strap_delta": 0.003,   # Layer 8 Crossbody/Shoulder Strap: +3mm over outermost active torso layer
}

RIGID_ACCESSORY_CATEGORIES = frozenset({
    "hat",
    "cap",
    "headwear",
    "glasses",
    "sunglasses",
    "eyewear",
    "earrings",
    "rings",
    "handbag",
    "clutch",
})

CONFORMING_ACCESSORY_CATEGORIES = frozenset({
    "belt",
    "sash",
    "scarf",
    "shawl",
    "choker",
    "necklace",
    "necktie",
    "crossbody_bag",
    "shoulder_bag",
    "backpack",
})


def setup_accessory_fitting(accessory_obj, target_obj, category, layer_offset):
    """
    Configures Blender modifiers for an accessory based on structural behavior:
      1. Rigid Anchor Accessories (hat, glasses, earrings, handbag):
         Do NOT deform geometry; return early after anchor transform binding.
      2. Conforming Accessories (belts, straps, chokers, scarves):
         Deform along garment/body contours using Shrinkwrap ('NEAREST_SURFACEPOINT')
         with radial layer_offset while protecting rigid sub-parts (buckles, bag bodies,
         metallic charms) via vertex groups, followed by a 2mm Solidify modifier.
    """
    norm_category = str(category or "").strip().lower()
    if norm_category in ["hat", "glasses", "earrings", "handbag"] or norm_category in RIGID_ACCESSORY_CATEGORIES:
        # Rigid objects: do not deform geometry
        return None

    if accessory_obj is None or target_obj is None:
        return None

    # Deformable accessories (belts, straps, chokers, scarves)
    shrink = accessory_obj.modifiers.new(name="AccessoryFit", type='SHRINKWRAP')
    shrink.target = target_obj
    shrink.wrap_method = 'NEAREST_SURFACEPOINT'
    shrink.offset = float(layer_offset)

    # Protect rigid components (e.g. buckles, metallic charms, rigid bag bodies)
    if "Deformable_Band" in accessory_obj.vertex_groups:
        shrink.vertex_group = "Deformable_Band"
    elif "Belt_Strap" in accessory_obj.vertex_groups:
        shrink.vertex_group = "Belt_Strap"
    elif "Strap" in accessory_obj.vertex_groups:
        shrink.vertex_group = "Strap"

    solid = accessory_obj.modifiers.new(name="LeatherMetalThickness", type='SOLIDIFY')
    solid.thickness = 0.002  # 2mm depth
    return shrink


def ensure_belt_vertex_groups(belt_obj, buckle_x_half_width=0.032):
    """
    Ensures a belt mesh maintains:
      - `Belt_Strap` (weight: 1.0) and `Deformable_Band` (weight: 1.0) on strap vertices
      - `Belt_Buckle` (weight: 0.0 in strap group, 1.0 in buckle group) on center-front buckle vertices
    so metal buckles remain completely flat and undeformed during Shrinkwrap.
    """
    if belt_obj is None or getattr(belt_obj, "data", None) is None:
        return

    vg_strap = belt_obj.vertex_groups.get("Belt_Strap") or belt_obj.vertex_groups.new(name="Belt_Strap")
    vg_band = belt_obj.vertex_groups.get("Deformable_Band") or belt_obj.vertex_groups.new(name="Deformable_Band")
    vg_buckle = belt_obj.vertex_groups.get("Belt_Buckle") or belt_obj.vertex_groups.new(name="Belt_Buckle")

    for v in belt_obj.data.vertices:
        is_front_buckle = v.co.z >= 0.0 and abs(v.co.x) <= buckle_x_half_width
        strap_weight = 0.0 if is_front_buckle else 1.0
        buckle_weight = 1.0 if is_front_buckle else 0.0
        vg_strap.add([v.index], strap_weight, 'REPLACE')
        vg_band.add([v.index], strap_weight, 'REPLACE')
        vg_buckle.add([v.index], buckle_weight, 'REPLACE')


def resolve_belt_target(avatar_body, bottom_garment_obj=None):
    """
    Dynamic Parent Target for Layer 5 (Belts & Waistbands):
      - If an active bottom (skirt/pants) exists, targets `bottom_garment_obj` with +0.002m offset.
      - If worn over a bare avatar or dress, targets `avatar_body` with +0.011m offset.
    """
    if bottom_garment_obj is not None:
        return bottom_garment_obj, LAYER_OFFSETS["belt_over_bottom"]
    return avatar_body, LAYER_OFFSETS["belt"]


def setup_belt_fitting(belt_obj, avatar_body, bottom_garment_obj=None):
    """
    Configures dynamic target wrapping and buckle protection for a belt or waistband sash.
    """
    ensure_belt_vertex_groups(belt_obj)
    target_obj, offset = resolve_belt_target(avatar_body, bottom_garment_obj)
    shrink = setup_accessory_fitting(belt_obj, target_obj, "belt", offset)
    if shrink is not None and "Belt_Strap" in belt_obj.vertex_groups:
        shrink.vertex_group = "Belt_Strap"
    return shrink


def apply_hat_hair_collision_mask(avatar_hair_obj, hat_obj, brim_y_world=1.58, depression_m=0.012):
    """
    Applies a subtle downward and inward crown collision mask on avatar hair geometry
    above `brim_y_world` when a hat/cap is worn so hair never punches through the hat crown.
    """
    if avatar_hair_obj is None or getattr(avatar_hair_obj, "data", None) is None:
        return

    vg_crown = (
        avatar_hair_obj.vertex_groups.get("Hat_Crown_Suppression")
        or avatar_hair_obj.vertex_groups.new(name="Hat_Crown_Suppression")
    )

    for v in avatar_hair_obj.data.vertices:
        if v.co.y > brim_y_world:
            t = min(1.0, (v.co.y - brim_y_world) / 0.12)
            vg_crown.add([v.index], t, 'REPLACE')
            v.co.y -= depression_m * t
            v.co.x *= (1.0 - 0.08 * t)
            v.co.z *= (1.0 - 0.08 * t)
        else:
            vg_crown.add([v.index], 0.0, 'REPLACE')


def setup_headwear_and_eyewear(accessory_obj, armature_obj, category, avatar_hair_obj=None):
    """
    Headwear & Eyewear (Rigid Anchor Transformation):
      - Hats & Caps: Parented to the avatar `Head` bone with fixed scale offset (zero Shrinkwrap),
        plus downward crown collision mask on avatar hair geometry.
      - Eyewear: Parented to `Head` bone at nose bridge & temples with zero vertex deformation.
    """
    if accessory_obj is None:
        return
    norm_category = str(category or "").strip().lower()
    if armature_obj is not None:
        accessory_obj.parent = armature_obj
        accessory_obj.parent_type = 'BONE'
        accessory_obj.parent_bone = "Head"

    if norm_category in ("hat", "cap", "headwear") and avatar_hair_obj is not None:
        apply_hat_hair_collision_mask(avatar_hair_obj, accessory_obj)

    setup_accessory_fitting(accessory_obj, armature_obj, norm_category, 0.0)


def resolve_bag_strap_target(avatar_body, top_obj=None, mid_layer_obj=None, outerwear_obj=None):
    """
    Resolves the outermost active torso layer for Crossbody & Shoulder Bag straps
    (Outerwear if active, else Mid-Layer, else Top, else Avatar Body) with +0.003m offset.
    """
    if outerwear_obj is not None:
        return outerwear_obj, LAYER_OFFSETS["bag_strap_delta"]
    if mid_layer_obj is not None:
        return mid_layer_obj, LAYER_OFFSETS["bag_strap_delta"]
    if top_obj is not None:
        return top_obj, LAYER_OFFSETS["bag_strap_delta"]
    return avatar_body, LAYER_OFFSETS["outer_accessory"]


def setup_bag_fitting(
    bag_obj,
    bag_type="handbag",
    armature_obj=None,
    avatar_body=None,
    top_obj=None,
    mid_layer_obj=None,
    outerwear_obj=None,
    hand_bone="Hand.R",
):
    """
    Bags (Crossbody, Shoulder, Handbags):
      - Handheld Bags / Clutches: Static child to `Hand.R` or `Hand.L` bone (rigid).
      - Crossbody & Shoulder Straps: Strap vertex group (`Strap` = 1.0, `Bag_Body` = 0.0)
        shrinkwraps against the outermost active torso layer with +0.003m offset, while
        the bag body remains completely rigid.
    """
    if bag_obj is None:
        return None

    norm_type = str(bag_type or "handbag").strip().lower()
    if norm_type in ("handbag", "clutch", "purse"):
        if armature_obj is not None:
            bag_obj.parent = armature_obj
            bag_obj.parent_type = 'BONE'
            bag_obj.parent_bone = hand_bone
        return setup_accessory_fitting(bag_obj, avatar_body, "handbag", 0.0)

    # Crossbody, Shoulder Bag, or Backpack: protect Bag_Body (weight 0.0) and wrap Strap (weight 1.0)
    target_obj, strap_offset = resolve_bag_strap_target(
        avatar_body,
        top_obj=top_obj,
        mid_layer_obj=mid_layer_obj,
        outerwear_obj=outerwear_obj,
    )
    shrink = setup_accessory_fitting(bag_obj, target_obj, norm_type, strap_offset)
    if shrink is not None and "Strap" in bag_obj.vertex_groups:
        shrink.vertex_group = "Strap"
    return shrink
