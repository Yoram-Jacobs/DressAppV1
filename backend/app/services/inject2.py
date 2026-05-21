import os
target_path = r'C:\DressApp_AG\backend\app\api\v1\closet.py'
content = open(target_path, 'r', encoding='utf-8').read()

# 1. Update AnalyzeIn
content = content.replace(
    '    image_base64: str | None = None\n    image_url: str | None = None',
    '    image_base64: str | None = None\n    images_base64: list[str] | None = None\n    image_url: str | None = None'
)

# 2. Update analyze_item_image logic
old_raw_logic = """    if not payload.image_base64 and not payload.image_url:
        raise HTTPException(400, "image_base64 or image_url is required")

    raw: bytes | None = None
    if payload.image_base64:
        try:
            raw = base64.b64decode(payload.image_base64, validate=True)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(400, f"Invalid image_base64: {exc}") from exc
    elif payload.image_url:
        import httpx
        async with httpx.AsyncClient(timeout=30.0) as c:
            resp = await c.get(payload.image_url, follow_redirects=True)
            resp.raise_for_status()
            raw = resp.content
    if not raw:
        raise HTTPException(400, "Could not load image bytes")"""

new_raw_logic = """    if not payload.image_base64 and not payload.image_url and not payload.images_base64:
        raise HTTPException(400, "image_base64, images_base64, or image_url is required")

    raw_list: list[bytes] = []
    if payload.images_base64:
        for b64 in payload.images_base64:
            try:
                raw_list.append(base64.b64decode(b64, validate=True))
            except Exception as exc:
                raise HTTPException(400, f"Invalid image_base64 in array: {exc}") from exc
    elif payload.image_base64:
        try:
            raw_list.append(base64.b64decode(payload.image_base64, validate=True))
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(400, f"Invalid image_base64: {exc}") from exc
    elif payload.image_url:
        import httpx
        async with httpx.AsyncClient(timeout=30.0) as c:
            resp = await c.get(payload.image_url, follow_redirects=True)
            resp.raise_for_status()
            raw_list.append(resp.content)
            
    if not raw_list:
        raise HTTPException(400, "Could not load image bytes")"""

content = content.replace(old_raw_logic, new_raw_logic)

# 3. Update streamer
old_streamer = """                async with _ANALYZE_LOCK:
                    saw_detect = False
                    items_meta: list[dict[str, Any]] = []
                    async for frame in garment_vision_service.analyze_outfit_stream(
                        raw, language=user_lang,
                    ):"""

new_streamer = """                async with _ANALYZE_LOCK:
                    saw_detect = False
                    items_meta: list[dict[str, Any]] = []
                    
                    if payload.images_base64:
                        streamer = garment_vision_service.analyze_outfits_stream(
                            raw_list, language=user_lang,
                        )
                    else:
                        streamer = garment_vision_service.analyze_outfit_stream(
                            raw_list[0], language=user_lang,
                        )
                        
                    async for frame in streamer:"""

content = content.replace(old_streamer, new_streamer)

# 4. Update item skip output
content = content.replace(
"""                                out_frame = {
                                    "type": "item_skip",
                                    "index": idx,
                                    "reason": "unidentifiable",
                                }""",
"""                                out_frame = {
                                    "type": "item_skip",
                                    "index": idx,
                                    "image_index": frame.get("image_index"),
                                    "reason": "unidentifiable",
                                }"""
)

# 5. Update item output
content = content.replace(
"""                                out_frame = {
                                    "type": "item",
                                    "index": idx,
                                    "label": meta.get("label"),""",
"""                                out_frame = {
                                    "type": "item",
                                    "index": idx,
                                    "image_index": frame.get("image_index"),
                                    "label": meta.get("label"),"""
)

# 6. Legacy fallback check for `raw`
old_legacy = """    # 2) Sync fallback (JSON response without keepalive chunking)
    # -----------------------------------------------------------
    try:
        async with _ANALYZE_LOCK:
            if payload.multi:
                items = await garment_vision_service.analyze_outfit(
                    raw, language=user_lang,
                )
            else:
                single = await garment_vision_service.analyze(
                    raw, language=user_lang,
                )"""

new_legacy = """    # 2) Sync fallback (JSON response without keepalive chunking)
    # -----------------------------------------------------------
    try:
        async with _ANALYZE_LOCK:
            if payload.multi:
                # Sync fallback doesn't support images_base64 batch yet. Fallback to first image.
                items = await garment_vision_service.analyze_outfit(
                    raw_list[0], language=user_lang,
                )
            else:
                single = await garment_vision_service.analyze(
                    raw_list[0], language=user_lang,
                )"""

content = content.replace(old_legacy, new_legacy)

open(target_path, 'w', encoding='utf-8').write(content)
print("Done")
