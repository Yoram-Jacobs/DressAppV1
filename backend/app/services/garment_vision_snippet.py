    async def analyze_outfits_stream(
        self,
        images_bytes_list: list[bytes],
        *,
        max_items: int | None = None,
        language: str | None = None,
    ) -> "AsyncIterator[dict[str, Any]]":
        """Streaming end-to-end variant that accepts multiple photos.
        
        Runs detection and cropping on each photo concurrently, flattening all valid
        crops into a single batched Gemini call for maximum throughput.
        
        Yields the same NDJSON frame structure as ``analyze_outfit_stream``, but each
        crop in ``items_meta`` and each ``item`` frame includes an ``image_index`` field
        so the frontend can route the analysis back to the correct original photo.
        """
        if not images_bytes_list:
            yield {"type": "done", "count": 0}
            return

        cap = max_items if max_items is not None else self.max_items

        # 1. Detect on all photos concurrently
        async def _detect_and_crop(idx: int, img_bytes: bytes) -> tuple[int, list[tuple[dict[str, Any], bytes, str]]]:
            try:
                detections = await self.detect_items(img_bytes)
            except Exception as exc:
                logger.warning("analyze_outfits_stream: detect_items failed for idx %d: %s", idx, repr(exc)[:160])
                return idx, []

            if _looks_already_cropped(detections):
                # Fallback to single-item analysis for already-cropped product photos
                # We do this inline here to keep the crop structure uniform for the batched stream.
                return idx, [({"label": "garment", "kind": "garment", "bbox": [0,0,1000,1000]}, img_bytes, "image/jpeg")]
                
            useful = self._filter_useful_detections(detections, cap)
            if not useful:
                return idx, []

            raw_crops = await asyncio.to_thread(self._bbox_crop_useful, img_bytes, useful)
            defer_matte = (settings.DEFER_REMBG_ON_ANALYZE and settings.AUTO_MATTE_CROPS and bool(raw_crops))
            
            if settings.AUTO_MATTE_CROPS and raw_crops and not defer_matte:
                crops = await self._matte_crops(raw_crops)
            else:
                crops = raw_crops
                if defer_matte:
                    for det, _, _ in crops:
                        det["defer_matte"] = True
            return idx, crops

        results = await asyncio.gather(*[_detect_and_crop(i, b) for i, b in enumerate(images_bytes_list)])

        # Flatten crops and keep track of image indices
        flat_crops: list[tuple[int, dict[str, Any], bytes, str]] = []
        for idx, crops in results:
            for det, c_bytes, c_mime in crops:
                flat_crops.append((idx, det, c_bytes, c_mime))

        if not flat_crops:
            yield {
                "type": "error",
                "status": 422,
                "message": (
                    "We couldn't identify any garments in the provided photos. "
                    "Please try clearer, well-lit shots."
                ),
            }
            return

        # Emit the detect frame FIRST
        items_meta = []
        for idx, d, crop_b, crop_m in flat_crops:
            fitted_b, fitted_m = _fit_crop_to_card(crop_b, crop_mime=crop_m)
            items_meta.append({
                "image_index": idx,
                "label": d.get("label") or "garment",
                "kind": d.get("kind") or "garment",
                "bbox": d.get("bbox"),
                "crop_base64": base64.b64encode(fitted_b).decode("ascii"),
                "crop_mime": fitted_m,
                "defer_matte": d.get("defer_matte", False),
            })
        yield {"type": "detect", "count": len(flat_crops), "items_meta": items_meta}

        # Stream-analyse the crops via batched Gemini stream
        crops_bytes = [b for _, _, b, _ in flat_crops]
        kind_hints = [
            (d.get("kind") if isinstance(d, dict) else None)
            for _, d, _b, _m in flat_crops
        ]
        
        from app.config import settings as _settings
        try:
            from app.services.reconstruction import should_reconstruct
        except Exception:
            should_reconstruct = None  # type: ignore[assignment]

        emitted = 0
        try:
            async for slot_idx, analysis in self.analyze_batch_stream(
                crops_bytes, language=language, kind_hints=kind_hints,
            ):
                image_idx = flat_crops[slot_idx][0] if slot_idx < len(flat_crops) else -1
                
                if not isinstance(analysis, dict) or not analysis:
                    yield {
                        "type": "item",
                        "index": slot_idx,
                        "image_index": image_idx,
                        "analysis": {},
                        "needs_reconstruction": False,
                        "reconstruction_reasons": [],
                    }
                    emitted += 1
                    continue

                needs_reconstruction = False
                reasons: list[str] = []
                if should_reconstruct is not None and slot_idx < len(flat_crops):
                    try:
                        det = flat_crops[slot_idx][1]
                        needs, raw_reasons = should_reconstruct(analysis, det.get("bbox"))
                        if needs and _settings.DEFER_RECONSTRUCTION_ON_ANALYZE:
                            needs_reconstruction = True
                            reasons = list(raw_reasons)
                    except Exception as exc:
                        logger.warning(
                            "reconstruction gate failed (streamed) slot=%d: %s",
                            slot_idx, repr(exc)[:160],
                        )

                yield {
                    "type": "item",
                    "index": slot_idx,
                    "image_index": image_idx,
                    "analysis": analysis,
                    "needs_reconstruction": needs_reconstruction,
                    "reconstruction_reasons": reasons,
                }
                emitted += 1
        except Exception as exc:
            err_text = repr(exc)
            logger.error(
                "analyze_outfits_stream: batch stream FAILED after %d emit(s): %s",
                emitted, err_text[:400],
            )
            low = err_text.lower()
            if "permission_denied" in low or " 403" in low or "permission denied" in low:
                msg = "Garment analyzer: Gemini API rejected the request (403 PERMISSION_DENIED)."
                status = 403
            elif "unauthenticated" in low or " 401" in low:
                msg = "Garment analyzer: Gemini API rejected the key (401 UNAUTHENTICATED)."
                status = 401
            elif "resource_exhausted" in low or " 429" in low or "quota" in low:
                msg = "Garment analyzer: Gemini quota exhausted (429). Wait a minute and retry."
                status = 429
            elif "not_found" in low or " 404" in low or "model not found" in low:
                msg = "Garment analyzer: requested Gemini model is not available to this key (404 NOT_FOUND)."
                status = 404
            elif "deadline" in low or "timeout" in low or "timed out" in low:
                msg = "Garment analyzer: Gemini API timed out. Retry in a moment."
                status = 504
            elif " 500" in low or " 502" in low or " 503" in low or "internal" in low:
                msg = "Garment analyzer: Gemini API returned a server error."
                status = 503
            else:
                msg = "Garment analyzer hit a transient error. (debug: " + err_text[:160].replace("\n", " ") + ")"
                status = 503

            yield {
                "type": "error",
                "status": status,
                "message": msg,
            }
            return

        yield {"type": "done", "count": emitted}
