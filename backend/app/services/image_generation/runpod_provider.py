"""RunPod Serverless provider for FLUX.2 Klein 4B image editing and generation.

Includes production-ready features:
- Concurrency limiter (FIFO async semaphore)
- Exponential backoff with randomized jitter on transient 429/500/502/503 errors
- Dual execution path: runsync with cold-start async polling fallback
- Fallback provider support (e.g. Gemini / Mock)
- Strict garment identity conditioning (prompt anchoring + strength clamping)
"""
from __future__ import annotations

import asyncio
import base64
import logging
import random
import time
from typing import Any

import httpx

from app.services.image_generation.base import ImageGenerationProvider, ImageGenerationResult

logger = logging.getLogger(__name__)

# Strict limits to eliminate creative hallucinations and garment drift
MIN_STRENGTH = 0.35
MAX_STRENGTH = 0.65
DEFAULT_STRENGTH = 0.45

RETRYABLE_STATUS_CODES = {408, 429, 500, 502, 503, 504}


def _clamp_strength(strength: float) -> float:
    """Clamps denoising strength to strictly preserve garment identity."""
    if strength < MIN_STRENGTH:
        return MIN_STRENGTH
    if strength > MAX_STRENGTH:
        return MAX_STRENGTH
    return strength


def _build_flux_prompt(prompt: str, garment_metadata: dict[str, Any] | None = None) -> tuple[str, str]:
    """Composes a high-fidelity commercial studio prompt and negative prompt."""
    meta_parts: list[str] = []
    if garment_metadata:
        cat = garment_metadata.get("category") or garment_metadata.get("sub_category")
        color = garment_metadata.get("primary_color") or garment_metadata.get("color")
        pattern = garment_metadata.get("pattern")
        fabric = garment_metadata.get("fabric") or garment_metadata.get("material")
        if cat:
            meta_parts.append(f"Garment category: {cat}.")
        if color:
            meta_parts.append(f"Original primary color: {color}.")
        if pattern and pattern.lower() not in ("plain", "solid", "none"):
            meta_parts.append(f"Pattern: {pattern}.")
        if fabric:
            meta_parts.append(f"Fabric texture: {fabric}.")

    meta_str = " ".join(meta_parts)
    
    positive_prompt = (
        f"Commercial studio product photograph of the exact garment shown. {meta_str} "
        f"Edit instruction: {prompt}. "
        "Preserve exact garment color shade, silhouette, buttons, zippers, seams, and fabric weave. "
        "Seamless solid neutral #F5F2EB studio background, crisp professional catalog lighting, high-end e-commerce."
    ).strip()

    negative_prompt = (
        "blurry, low resolution, deformed, altered garment color, different fabric, "
        "missing buttons, mutated silhouette, noise, watermark, human body parts, mannequin, clutter"
    )

    return positive_prompt, negative_prompt


class RunpodFluxProvider(ImageGenerationProvider):
    """Production-hardened RunPod Serverless GPU implementation for FLUX.2 Klein 4B."""

    def __init__(
        self,
        api_key: str,
        endpoint_id: str,
        model_name: str = "flux.2-klein-4b",
        timeout: int = 60,
        runsync_timeout: int = 25,
        poll_timeout: int = 120,
        max_concurrency: int = 4,
        max_retries: int = 3,
        fallback_provider: ImageGenerationProvider | None = None,
    ) -> None:
        if not api_key:
            raise ValueError("api_key is required for RunpodFluxProvider")
        if not endpoint_id:
            raise ValueError("endpoint_id is required for RunpodFluxProvider")

        self.api_key = api_key
        self.endpoint_id = endpoint_id
        self.model_name = model_name
        self.timeout = timeout
        self.runsync_timeout = runsync_timeout
        self.poll_timeout = poll_timeout
        self.max_concurrency = max_concurrency
        self.max_retries = max_retries
        self.fallback_provider = fallback_provider
        self.base_url = f"https://api.runpod.ai/v2/{self.endpoint_id}"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        self._semaphore: asyncio.Semaphore | None = None

    def _get_semaphore(self) -> asyncio.Semaphore:
        """Lazily instantiates the semaphore bound to the current running event loop."""
        if self._semaphore is None:
            self._semaphore = asyncio.Semaphore(self.max_concurrency)
        return self._semaphore

    async def edit_image(
        self,
        image_bytes: bytes,
        prompt: str,
        *,
        mask_bytes: bytes | None = None,
        strength: float = DEFAULT_STRENGTH,
        garment_metadata: dict[str, Any] | None = None,
    ) -> ImageGenerationResult:
        """Edit or repair a garment image using FLUX.2 Klein 4B via RunPod Serverless."""
        clamped_strength = _clamp_strength(strength)
        positive_prompt, negative_prompt = _build_flux_prompt(prompt, garment_metadata)
        
        image_b64 = base64.b64encode(image_bytes).decode("ascii")
        mask_b64 = base64.b64encode(mask_bytes).decode("ascii") if mask_bytes else None

        payload: dict[str, Any] = {
            "input": {
                "route": "/v1/images/edits",
                "body": {
                    "prompt": positive_prompt,
                    "image_b64": image_b64,
                    "size": "1024x1024",
                },
                "task": "image_to_image" if not mask_b64 else "inpainting",
                "prompt": positive_prompt,
                "negative_prompt": negative_prompt,
                "image": image_b64,
                "image_b64": image_b64,
                "strength": clamped_strength,
                "guidance_scale": 3.5,
                "num_inference_steps": 25,
            }
        }
        if mask_b64:
            payload["input"]["mask_image"] = mask_b64
            payload["input"]["body"]["mask_b64"] = mask_b64

        t0 = time.time()
        try:
            async with self._get_semaphore():
                result_bytes, metadata = await self._execute_with_retry(payload)
        except Exception as exc:
            if self.fallback_provider:
                logger.warning(
                    "RunpodFluxProvider failed (%s); invoking fallback provider %s",
                    exc,
                    type(self.fallback_provider).__name__,
                )
                return await self.fallback_provider.edit_image(
                    image_bytes=image_bytes,
                    prompt=prompt,
                    mask_bytes=mask_bytes,
                    strength=strength,
                    garment_metadata=garment_metadata,
                )
            raise

        latency_ms = int((time.time() - t0) * 1000)

        metadata.update({
            "strength": clamped_strength,
            "prompt": prompt,
            "positive_prompt": positive_prompt,
            "has_mask": bool(mask_bytes),
        })

        return ImageGenerationResult(
            image_bytes=result_bytes,
            mime_type="image/png",
            provider="runpod",
            model_name=self.model_name,
            latency_ms=latency_ms,
            metadata=metadata,
        )

    async def generate_image(
        self,
        prompt: str,
        *,
        aspect_ratio: str = "1:1",
    ) -> ImageGenerationResult:
        """Generate a commercial product photo from text using FLUX.2 Klein 4B."""
        positive_prompt = (
            f"Commercial studio product photograph of a fashion garment. {prompt}. "
            "Seamless solid neutral #F5F2EB studio background, crisp professional catalog lighting, high-end e-commerce."
        )
        negative_prompt = (
            "blurry, low resolution, deformed, altered garment color, different fabric, "
            "missing buttons, mutated silhouette, noise, watermark, human body parts, mannequin, clutter"
        )

        width = 1024
        height = 1024
        if aspect_ratio == "3:4":
            width, height = 896, 1152
        elif aspect_ratio == "4:3":
            width, height = 1152, 896

        payload: dict[str, Any] = {
            "input": {
                "route": "/v1/images/generations",
                "body": {
                    "prompt": positive_prompt,
                    "size": f"{width}x{height}",
                },
                "task": "text_to_image",
                "prompt": positive_prompt,
                "negative_prompt": negative_prompt,
                "width": width,
                "height": height,
                "num_inference_steps": 25,
                "guidance_scale": 3.5,
            }
        }

        t0 = time.time()
        try:
            async with self._get_semaphore():
                result_bytes, metadata = await self._execute_with_retry(payload)
        except Exception as exc:
            if self.fallback_provider:
                logger.warning(
                    "RunpodFluxProvider text-to-image failed (%s); invoking fallback provider %s",
                    exc,
                    type(self.fallback_provider).__name__,
                )
                return await self.fallback_provider.generate_image(
                    prompt=prompt,
                    aspect_ratio=aspect_ratio,
                )
            raise

        latency_ms = int((time.time() - t0) * 1000)

        return ImageGenerationResult(
            image_bytes=result_bytes,
            mime_type="image/png",
            provider="runpod",
            model_name=self.model_name,
            latency_ms=latency_ms,
            metadata=metadata,
        )

    async def health_check(self) -> bool:
        """Check if RunPod Serverless endpoint is reachable and responsive."""
        url = f"{self.base_url}/health"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.get(url, headers=self.headers)
                return res.status_code == 200
        except Exception as exc:  # noqa: BLE001
            logger.warning("Runpod health check failed: %s", exc)
            return False

    async def _execute_with_retry(self, payload: dict[str, Any]) -> tuple[bytes, dict[str, Any]]:
        """Executes the request with exponential backoff and randomized jitter on transient errors."""
        last_exception: Exception | None = None

        for attempt in range(1, self.max_retries + 1):
            try:
                return await self._execute_runpod_call(payload)
            except Exception as exc:
                last_exception = exc
                is_retryable = self._is_retryable_error(exc)
                if not is_retryable or attempt >= self.max_retries:
                    logger.error(
                        "RunPod call failed on attempt %d/%d (retryable=%s): %s",
                        attempt,
                        self.max_retries,
                        is_retryable,
                        exc,
                    )
                    raise

                backoff_delay = min(6.0, 1.0 * (2 ** (attempt - 1))) + random.uniform(0.1, 0.4)
                logger.warning(
                    "RunPod transient failure on attempt %d/%d: %s. Retrying in %.2fs...",
                    attempt,
                    self.max_retries,
                    exc,
                    backoff_delay,
                )
                await asyncio.sleep(backoff_delay)

        raise last_exception or RuntimeError("RunPod execution failed after retries")

    def _is_retryable_error(self, exc: Exception) -> bool:
        """Determines if an error is transient and safe to retry."""
        if isinstance(exc, (httpx.ConnectError, httpx.RemoteProtocolError, httpx.ReadTimeout, httpx.ConnectTimeout)):
            return True
        if isinstance(exc, RuntimeError):
            err_msg = str(exc)
            for code in RETRYABLE_STATUS_CODES:
                if f"status: {code}" in err_msg or f"error {code}" in err_msg:
                    return True
        return False

    async def _execute_runpod_call(self, payload: dict[str, Any]) -> tuple[bytes, dict[str, Any]]:
        """Executes runsync with fallback to async polling on longer jobs or cold starts."""
        sync_url = f"{self.base_url}/runsync"
        limits = httpx.Limits(max_keepalive_connections=10, max_connections=20)
        
        async with httpx.AsyncClient(timeout=self.runsync_timeout, limits=limits) as client:
            try:
                res = await client.post(sync_url, json=payload, headers=self.headers)
            except httpx.TimeoutException:
                logger.warning(
                    "RunPod runsync timed out after %ds; falling back to async polling...",
                    self.runsync_timeout,
                )
                return await self._execute_async_polling(client, payload)

            if res.status_code == 200:
                data = res.json()
                status = data.get("status")
                if status == "COMPLETED":
                    return self._extract_output_bytes(data)
                elif status in ("IN_QUEUE", "IN_PROGRESS"):
                    job_id = data.get("id")
                    if job_id:
                        return await self._poll_job(client, job_id)
                raise RuntimeError(f"RunPod execution failed with status: {status} ({data.get('error')})")
            elif res.status_code in (504, 408):
                logger.info("RunPod returned gateway timeout (%d); polling asynchronously...", res.status_code)
                return await self._execute_async_polling(client, payload)
            else:
                error_body = res.text[:250]
                raise RuntimeError(f"RunPod API error {res.status_code}: {error_body}")

    async def _execute_async_polling(self, client: httpx.AsyncClient, payload: dict[str, Any]) -> tuple[bytes, dict[str, Any]]:
        """Starts an async job via /run and polls /status/{id}."""
        run_url = f"{self.base_url}/run"
        res = await client.post(run_url, json=payload, headers=self.headers)
        if res.status_code != 200:
            raise RuntimeError(f"RunPod async launch error {res.status_code}: {res.text[:250]}")
        data = res.json()
        job_id = data.get("id")
        if not job_id:
            raise RuntimeError(f"RunPod async launch returned no job id: {data}")
        return await self._poll_job(client, job_id)

    async def _poll_job(self, client: httpx.AsyncClient, job_id: str) -> tuple[bytes, dict[str, Any]]:
        """Polls a job status until completion or cold-start poll timeout."""
        status_url = f"{self.base_url}/status/{job_id}"
        poll_interval = 1.0
        deadline = time.time() + self.poll_timeout

        while time.time() < deadline:
            res = await client.get(status_url, headers=self.headers)
            if res.status_code == 200:
                data = res.json()
                status = data.get("status")
                if status == "COMPLETED":
                    return self._extract_output_bytes(data)
                elif status in ("FAILED", "CANCELLED"):
                    raise RuntimeError(f"RunPod job {job_id} {status}: {data.get('error')}")
            await asyncio.sleep(poll_interval)
            poll_interval = min(poll_interval * 1.5, 3.0)

        raise TimeoutError(f"RunPod job {job_id} exceeded poll timeout of {self.poll_timeout}s")

    def _extract_output_bytes(self, data: dict[str, Any]) -> tuple[bytes, dict[str, Any]]:
        """Extracts and decodes image bytes from the RunPod response dictionary."""
        output = data.get("output")
        if not output:
            raise RuntimeError("RunPod completed response contains no 'output' field")

        image_raw: Any = None
        if isinstance(output, dict):
            if "data" in output and isinstance(output["data"], list) and output["data"]:
                item = output["data"][0]
                if isinstance(item, dict):
                    image_raw = item.get("b64_json") or item.get("url") or item.get("image")
                elif isinstance(item, str):
                    image_raw = item
            if not image_raw:
                image_raw = (
                    output.get("image")
                    or output.get("images")
                    or output.get("output")
                    or output.get("image_b64")
                    or output.get("b64_json")
                )
            if isinstance(image_raw, list) and image_raw:
                image_raw = image_raw[0]
        elif isinstance(output, str):
            image_raw = output
        elif isinstance(output, list) and output:
            item = output[0]
            if isinstance(item, dict):
                image_raw = item.get("b64_json") or item.get("image") or item.get("url")
            else:
                image_raw = item

        if isinstance(image_raw, str) and (image_raw.startswith("http://") or image_raw.startswith("https://")):
            try:
                with httpx.Client(timeout=30.0) as dl_client:
                    r = dl_client.get(image_raw)
                    r.raise_for_status()
                    image_bytes = r.content
            except Exception as exc:
                raise RuntimeError(f"Failed to download image from RunPod output URL: {exc}") from exc
        else:
            if not image_raw or not isinstance(image_raw, str):
                raise RuntimeError(f"RunPod response has invalid image output format: {type(image_raw)}")

            # Check if output is base64 data URI
            if image_raw.startswith("data:image/"):
                image_raw = image_raw.split(",", 1)[-1]

            try:
                image_bytes = base64.b64decode(image_raw)
            except Exception as exc:
                raise RuntimeError(f"Failed to decode base64 output from RunPod: {exc}") from exc

        metadata = {
            "runpod_job_id": data.get("id"),
            "execution_time_ms": data.get("executionTime"),
            "delay_time_ms": data.get("delayTime"),
        }
        return image_bytes, metadata
