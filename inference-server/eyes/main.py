"""DressApp Eyes — FastAPI proxy in front of a local ``llama-server``.

Why a proxy?
------------
The first iteration of this service used ``llama-cpp-python`` (a
Python binding around llama.cpp). Its bundled C++ library was too
old to load Gemma-4 GGUFs (arch ``gemma4``, merged upstream via
Unsloth's PR #21343, post-April 2026). Rather than wait for a wheel
release that catches up, the Dockerfile now compiles ``llama-server``
from ``llama.cpp`` HEAD. This file orchestrates that binary.

What stays the same
-------------------
The public contract: ``POST /predict`` accepts the same JSON shape
the backend's ``garment_vision._call_gemma_space`` already sends.
``GET /healthz`` still gates traffic on llama-server being warm.
Bearer-token auth on ``/predict`` still uses ``EYES_API_TOKEN``.

What changes inside
-------------------
1. ``lifespan``  spawns ``llama-server`` as a subprocess on
   ``127.0.0.1:8080`` (loopback only — never reachable from the
   docker network), waits for its ``/health`` endpoint to flip
   green, and keeps a process handle so it's reaped on shutdown.

2. ``/predict`` translates our custom JSON to the OpenAI-compatible
   ``/v1/chat/completions`` shape, posts it to the local server,
   then translates the response back. Vision (image_b64) follows
   OpenAI's ``image_url`` content-part convention — works iff the
   GGUF was built with multimodal support and the right mmproj.

GGUF download is unchanged: lazy fetch from HuggingFace on first boot
into the ``/models`` Docker volume, cached forever afterwards.
"""
from __future__ import annotations

import asyncio
import logging
import os
import shutil
import signal
import struct
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("dressapp-eyes")

# ---- Config (env, with defaults set in Dockerfile) ------------------
MODEL_DIR = Path(os.environ.get("EYES_MODEL_DIR", "/models"))
MODEL_REPO = os.environ.get("EYES_MODEL_REPO", "Yoram-Jacobs/dressapp-eyes-gguf")
MODEL_FILE = os.environ.get("EYES_MODEL_FILE", "gemma-4-E4B-it-Q3_K_M.gguf")
MMPROJ_FILE = os.environ.get("EYES_MMPROJ_FILE", "mmproj-BF16.gguf")
HF_TOKEN = os.environ.get("EYES_HF_TOKEN")
API_TOKEN = os.environ.get("EYES_API_TOKEN")

N_THREADS = int(os.environ.get("LLAMA_THREADS", "4"))
N_CTX = int(os.environ.get("LLAMA_CTX_SIZE", "8192"))
N_BATCH = int(os.environ.get("LLAMA_N_BATCH", "2048"))

LLAMA_BIN = os.environ.get("LLAMA_BIN", "/usr/local/bin/llama-server")
LLAMA_INTERNAL_HOST = "127.0.0.1"
LLAMA_INTERNAL_PORT = int(os.environ.get("LLAMA_INTERNAL_PORT", "8080"))
LLAMA_BASE_URL = f"http://{LLAMA_INTERNAL_HOST}:{LLAMA_INTERNAL_PORT}"

# How long we'll wait for llama-server to finish loading the model
# before declaring the boot a failure. Cold-start of Q4_K_M on CPX32
# takes ~12 s; double it generously.
LLAMA_BOOT_TIMEOUT_S = float(os.environ.get("LLAMA_BOOT_TIMEOUT_S", "120"))


# ---- GGUF lazy download (unchanged from the previous iteration) -----
def _ensure_model_present() -> Path:
    """Download the GGUF on first boot, no-op forever afterwards."""
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    target = MODEL_DIR / MODEL_FILE
    if target.is_file() and target.stat().st_size > 100 * 1024 * 1024:
        log.info(
            "model already cached: %s (%.2f GB)",
            target, target.stat().st_size / (1024**3),
        )
        return target
    if not HF_TOKEN:
        raise RuntimeError(
            "EYES_HF_TOKEN is not set; cannot download the private "
            f"model {MODEL_REPO}/{MODEL_FILE}."
        )
    log.info("downloading model: %s/%s", MODEL_REPO, MODEL_FILE)
    from huggingface_hub import hf_hub_download

    t0 = time.time()
    p = hf_hub_download(
        repo_id=MODEL_REPO,
        filename=MODEL_FILE,
        local_dir=str(MODEL_DIR),
        token=HF_TOKEN,
    )
    log.info(
        "downloaded %s (%.2f GB) in %.1fs",
        p, os.path.getsize(p) / (1024**3), time.time() - t0,
    )
    return Path(p)


def _ensure_mmproj_present() -> Path | None:
    if not MMPROJ_FILE:
        return None
    target = MODEL_DIR / MMPROJ_FILE
    if target.is_file() and target.stat().st_size > 10 * 1024 * 1024:
        return target
    if not HF_TOKEN:
        raise RuntimeError(
            "EYES_HF_TOKEN is required to download the mmproj file.",
        )
    from huggingface_hub import hf_hub_download

    log.info("downloading mmproj: %s/%s", MODEL_REPO, MMPROJ_FILE)
    p = hf_hub_download(
        repo_id=MODEL_REPO,
        filename=MMPROJ_FILE,
        local_dir=str(MODEL_DIR),
        token=HF_TOKEN,
    )
    return Path(p)


# ---- GGUF metadata sniff (kept — useful diagnostic on load failure) -
def _peek_gguf_arch(path: Path) -> dict[str, Any]:
    """Read the GGUF header and surface ``general.architecture`` etc.

    llama-server's failure modes can be opaque (it just exits non-zero
    if the arch is unsupported); this lets us log the arch BEFORE
    spawning the binary, so the cause is staring you in the face.
    """
    out: dict[str, Any] = {}
    try:
        with open(path, "rb") as f:
            magic = f.read(4)
            if magic != b"GGUF":
                return {"_error": f"not a GGUF file (magic={magic!r})"}
            (version,) = struct.unpack("<I", f.read(4))
            (_tensor_count,) = struct.unpack("<Q", f.read(8))
            (kv_count,) = struct.unpack("<Q", f.read(8))
            out["_gguf_version"] = version
            out["_kv_count"] = kv_count

            def read_str() -> str:
                (n,) = struct.unpack("<Q", f.read(8))
                return f.read(n).decode("utf-8", errors="replace")

            def skip_value(value_type: int) -> None:
                if value_type in (0, 1, 7):
                    f.read(1)
                elif value_type in (2, 3):
                    f.read(2)
                elif value_type in (4, 5, 6):
                    f.read(4)
                elif value_type in (10, 11, 12):
                    f.read(8)
                elif value_type == 8:
                    (n,) = struct.unpack("<Q", f.read(8))
                    f.read(n)
                elif value_type == 9:
                    (inner,) = struct.unpack("<I", f.read(4))
                    (n,) = struct.unpack("<Q", f.read(8))
                    for _ in range(n):
                        skip_value(inner)
                else:
                    raise ValueError(f"unknown gguf value type {value_type}")

            for _ in range(min(kv_count, 200)):
                key = read_str()
                (value_type,) = struct.unpack("<I", f.read(4))
                if key in (
                    "general.architecture",
                    "general.name",
                    "general.basename",
                    "general.quantization_version",
                    "tokenizer.ggml.model",
                ):
                    if value_type == 8:
                        out[key] = read_str()
                    elif value_type in (4, 5):
                        out[key] = struct.unpack(
                            "<i" if value_type == 5 else "<I",
                            f.read(4),
                        )[0]
                    else:
                        skip_value(value_type)
                else:
                    skip_value(value_type)
    except Exception as exc:  # noqa: BLE001
        out["_parse_error"] = str(exc)
    return out


# ---- Config (env, with defaults set in Dockerfile) ------------------
ADAPTERS_DIR = MODEL_DIR / "adapters"
ENABLE_LORA = os.environ.get("EYES_ENABLE_LORA", "false").lower() in ("true", "1", "yes")


def _discover_adapters() -> list[Path]:
    """Discover all GGUF LoRA adapters in /models/adapters, /adapter, and /models."""
    if not ENABLE_LORA:
        log.info("Keyed Prompt Injection mode active (EYES_ENABLE_LORA=false): LoRA adapters disabled.")
        return []

    found: list[Path] = []
    seen: set[str] = set()

    search_dirs = [
        ADAPTERS_DIR,
        Path(os.environ.get("EYES_ADAPTERS_DIR", "/models/adapters")),
        Path("/adapter"),
    ]
    for d in search_dirs:
        if d.is_dir():
            for p in sorted(d.glob("*.gguf")):
                if p.is_file() and p.stat().st_size > 1024 and p.name not in seen:
                    if "mmproj" not in p.name.lower() and p.name != MODEL_FILE:
                        found.append(p)
                        seen.add(p.name)

    if MODEL_DIR.is_dir():
        for p in sorted(MODEL_DIR.glob("*lora*.gguf")):
            if p.is_file() and p.stat().st_size > 1024 and p.name not in seen:
                found.append(p)
                seen.add(p.name)

    return found


# ---- llama-server lifecycle ----------------------------------------
def _build_llama_argv(
    model_path: Path,
    mmproj_path: Path | None,
    adapter_paths: list[Path] | None = None,
) -> list[str]:
    """Compose the llama-server command line.

    We bind to loopback only — the proxy is the only thing that talks
    to it. ``--api-key`` is intentionally omitted: traffic never leaves
    the container, and the proxy itself enforces ``EYES_API_TOKEN`` on
    the public ``/predict``.

    Flags chosen:
      --jinja          — use the GGUF's embedded chat template (Gemma 4
                          ships its own template; the right thing here).
      --reasoning-budget 0 — DISABLES the model's thinking phase. The
                          fine-tune is a thinking model that wraps its
                          output in ``<|think|> ... </think>``; on CPU
                          that easily eats 60-120 s before any visible
                          tokens are produced. Setting the budget to 0
                          forces the server to emit the closing think
                          tag immediately, so the model goes straight
                          to producing JSON. ~3-4× speed-up on CPX32.
      --chat-template-kwargs — belt-and-braces for templates that read
                          the ``enable_thinking`` boolean directly from
                          the Jinja env. Older llama.cpp builds without
                          ``--reasoning-budget`` ignore this flag harm-
                          lessly; newer builds honor both.
      -fa              — flash-attention; meaningful speedup on CPU too.
      --no-warmup      — skip the synthetic warmup token; saves ~3 s
                          and the first real request will warm naturally.
      --lora           — attaches one or more fine-tuned LoRA GGUF adapters.
    """
    # Gemma-4 requires thinking mode to process images. The reasoning-budget
    # controls whether the model generates reasoning steps (CoT) before the
    # final answer. Since our pipeline uses JSON schema output directly,
    # we enable thinking mode to ensure the model processes the image content.
    # Note: The <think> tags in the model's output will be stripped by the
    # backend's _extract_json function, so this doesn't affect our JSON parsing.
    argv = [
        LLAMA_BIN,
        "--model", str(model_path),
        "--host", LLAMA_INTERNAL_HOST,
        "--port", str(LLAMA_INTERNAL_PORT),
        "--ctx-size", str(N_CTX),
        "--threads", str(N_THREADS),
        "--threads-batch", str(N_THREADS),
        "--batch-size", str(N_BATCH),
        "--ubatch-size", str(min(N_BATCH, 512)),
        "--n-predict", "-1",
        "--jinja",
        "--reasoning-budget", "0",
        "--chat-template-kwargs", '{"enable_thinking": false}',
        "-fa", "auto",
        "-sps", "0.0",
        "--media-path", "/",
        "--cache-prompt",
        "--parallel", "1",
    ]
    if mmproj_path is not None:
        argv += ["--mmproj", str(mmproj_path)]
    if adapter_paths:
        for ap in adapter_paths:
            argv += ["--lora", str(ap)]
    return argv


async def _wait_for_llama_ready(client: httpx.AsyncClient) -> None:
    """Poll llama-server's /health until it returns ``status: ok``.

    llama-server transitions through ``loading model`` → ``ok``. We
    accept anything 2xx with ``status==ok``. Anything else (including
    a connection refused while it's still binding) is treated as
    "not ready yet, keep waiting".
    """
    deadline = time.time() + LLAMA_BOOT_TIMEOUT_S
    last_err: str | None = None
    while time.time() < deadline:
        try:
            r = await client.get(f"{LLAMA_BASE_URL}/health", timeout=3.0)
            if r.status_code == 200:
                body = r.json()
                if body.get("status") == "ok":
                    return
                last_err = f"status={body.get('status')!r}"
            else:
                last_err = f"http={r.status_code}"
        except Exception as exc:  # noqa: BLE001
            last_err = type(exc).__name__
        await asyncio.sleep(1.0)
    raise RuntimeError(
        f"llama-server failed to become ready within "
        f"{LLAMA_BOOT_TIMEOUT_S:.0f}s (last={last_err})",
    )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if not shutil.which(LLAMA_BIN) and not Path(LLAMA_BIN).is_file():
        raise RuntimeError(
            f"llama-server binary not found at {LLAMA_BIN}. The "
            "Dockerfile must build it from llama.cpp source.",
        )

    model_path = _ensure_model_present()
    mmproj_path = _ensure_mmproj_present()
    adapter_paths = _discover_adapters()

    meta = _peek_gguf_arch(model_path)
    log.info("gguf metadata: %s", meta)
    log.info("discovered adapters: %s", [str(p) for p in adapter_paths])

    argv = _build_llama_argv(model_path, mmproj_path, adapter_paths)
    log.info("spawning: %s", " ".join(argv))
    # We deliberately let llama-server inherit stdout/stderr so its
    # log lines (token throughput, KV cache, etc.) show up next to
    # ours in ``docker compose logs``. Easier debugging.
    proc = await asyncio.create_subprocess_exec(
        *argv,
        stdout=None, stderr=None,
        # Run in its own process group so we can SIGTERM the whole
        # group on shutdown (llama-server forks worker threads but
        # they all die with the parent — group is belt-and-braces).
        start_new_session=True,
    )

    client = httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=10.0))
    try:
        await _wait_for_llama_ready(client)
    except Exception:
        # Don't leave a half-loaded llama-server eating 4 GB of RAM
        # if /health never went green.
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        await client.aclose()
        raise

    _app.state.llama_proc = proc
    _app.state.client = client
    _app.state.lock = asyncio.Lock()
    _app.state.vision_enabled = mmproj_path is not None
    _app.state.loaded_at = time.time()
    _app.state.model_basename = model_path.name
    _app.state.gguf_metadata = meta
    _app.state.model_path = model_path
    _app.state.mmproj_path = mmproj_path
    _app.state.adapter_paths = adapter_paths

    lora_adapters = []
    try:
        r_lora = await client.get(f"{LLAMA_BASE_URL}/lora-adapters", timeout=5.0)
        if r_lora.status_code == 200:
            lora_adapters = r_lora.json()
    except Exception as exc:
        log.warning("could not query lora-adapters: %s", exc)
    _app.state.lora_adapters = lora_adapters

    log.info(
        "ready: model=%s vision=%s adapters=%s",
        model_path.name, _app.state.vision_enabled, lora_adapters,
    )

    try:
        yield
    finally:
        log.info("shutdown: stopping llama-server")
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            await asyncio.wait_for(proc.wait(), timeout=10.0)
        except asyncio.TimeoutError:
            log.warning("llama-server did not exit on SIGTERM, sending KILL")
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        await client.aclose()


app = FastAPI(
    title="DressApp Eyes",
    version="phase1-llama-server",
    description="FastAPI proxy in front of llama-server for fine-tuned Gemma-4 E2B.",
    lifespan=lifespan,
)


# ---- Auth -----------------------------------------------------------
def _require_token(authorization: str | None = Header(default=None)) -> None:
    if not API_TOKEN:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    if authorization.split(" ", 1)[1].strip() != API_TOKEN:
        raise HTTPException(status_code=401, detail="bad bearer token")


# ---- Schemas (updated for OpenAI-compatible format) ------------------
class ChatTurn(BaseModel):
    role: str = Field(..., pattern="^(system|user|assistant)$")
    content: str | list[dict[str, Any]]


class PredictIn(BaseModel):
    # Support OpenAI-compatible format with optional custom backward compatibility
    messages: list[ChatTurn] | None = None
    max_tokens: int = Field(default=512, ge=1, le=8192)
    temperature: float = Field(default=0.2, ge=0.0, le=1.5)
    top_p: float = Field(default=0.9, ge=0.0, le=1.0)
    json_mode: bool = False
    json_schema: dict[str, Any] | None = None
    response_format: dict[str, Any] | None = None
    enable_thinking: bool = False
    think: bool = False
    reasoning_budget: int = 0
    chat_template_kwargs: dict[str, Any] | None = None
    # Legacy fields for backward compatibility (unused when messages is provided)
    prompt: str | None = None
    system: str | None = None
    image_b64: str | None = None
    image_mime: str = "image/jpeg"
    id_slot: int | None = None
    # Multi-LoRA adapter selection
    model: str | None = None
    adapter: str | None = None


class PredictOut(BaseModel):
    output: str
    finish_reason: str | None = None
    tokens_prompt: int = 0
    tokens_completion: int = 0
    elapsed_ms: int = 0
    vision_used: bool = False
    vision_disabled: bool = False
    adapter_used: str | None = None


# ---- Public endpoints ----------------------------------------------
@app.get("/")
async def root() -> dict[str, Any]:
    return {
        "service": "dressapp-eyes",
        "phase": "2-keyed-prompt-injection" if not ENABLE_LORA else "2-lora-gguf",
        "mode": "keyed_prompt_injection" if not ENABLE_LORA else "lora",
        "engine": "llama-server (built from llama.cpp HEAD)",
        "model": getattr(app.state, "model_basename", MODEL_FILE),
        "adapters": getattr(app.state, "lora_adapters", []),
        "gguf_metadata": getattr(app.state, "gguf_metadata", {}),
        "vision_enabled": getattr(app.state, "vision_enabled", False),
        "auth_required": bool(API_TOKEN),
        "endpoints": [
            "GET /",
            "GET /healthz",
            "POST /predict",
            "GET /v1/adapters",
            "POST /v1/adapters/reload",
            "GET /lora-adapters",
            "POST /lora-adapters",
        ],
    }


async def _ensure_llama_ready(force_respawn: bool = False) -> None:
    proc = getattr(app.state, "llama_proc", None)
    is_dead = proc is None or proc.returncode is not None or force_respawn
    client: httpx.AsyncClient | None = getattr(app.state, "client", None)
    if not is_dead and client is not None:
        try:
            r = await client.get(f"{LLAMA_BASE_URL}/health", timeout=2.0)
            if r.status_code == 200 and r.json().get("status") == "ok":
                return
        except Exception:
            is_dead = True

    if is_dead:
        log.warning("llama-server is dead, unresponsive, or respawn requested — spawning...")
        lock = getattr(app.state, "lock", None)
        if lock is None:
            lock = asyncio.Lock()
            app.state.lock = lock

        async with lock:
            proc = getattr(app.state, "llama_proc", None)
            client = getattr(app.state, "client", None)
            if client is None:
                client = httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=10.0))
                app.state.client = client
            if proc is not None and proc.returncode is None:
                if not force_respawn:
                    try:
                        r = await client.get(f"{LLAMA_BASE_URL}/health", timeout=2.0)
                        if r.status_code == 200 and r.json().get("status") == "ok":
                            return
                    except Exception:
                        pass
                try:
                    os.killpg(proc.pid, signal.SIGKILL)
                    await asyncio.wait_for(proc.wait(), timeout=3.0)
                except Exception:
                    pass
                await asyncio.sleep(1.0)

            model_path = getattr(app.state, "model_path", None) or _ensure_model_present()
            mmproj_path = getattr(app.state, "mmproj_path", None)
            if mmproj_path is None:
                mmproj_path = _ensure_mmproj_present()
            adapter_paths = _discover_adapters()
            argv = _build_llama_argv(model_path, mmproj_path, adapter_paths)
            log.info("Respawning llama-server: %s", " ".join(argv))
            new_proc = await asyncio.create_subprocess_exec(
                *argv,
                stdout=None, stderr=None,
                start_new_session=True,
            )
            app.state.llama_proc = new_proc
            app.state.loaded_at = time.time()
            app.state.adapter_paths = adapter_paths
            await _wait_for_llama_ready(client)
            # Update lora_adapters
            try:
                r_lora = await client.get(f"{LLAMA_BASE_URL}/lora-adapters", timeout=5.0)
                if r_lora.status_code == 200:
                    app.state.lora_adapters = r_lora.json()
            except Exception:
                pass
            log.info("llama-server respawned and verified healthy! Adapters: %s", getattr(app.state, "lora_adapters", []))


@app.get("/healthz")
async def healthz() -> dict[str, Any]:
    try:
        await _ensure_llama_ready()
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"llama-server not healthy: {exc}")
    return {
        "status": "ok",
        "mode": "keyed_prompt_injection" if not ENABLE_LORA else "lora",
        "model": getattr(app.state, "model_basename", MODEL_FILE),
        "adapters": getattr(app.state, "lora_adapters", []),
        "vision_enabled": getattr(app.state, "vision_enabled", False),
        "uptime_s": int(time.time() - getattr(app.state, "loaded_at", time.time())),
    }


# ---- Inference (auth required) -------------------------------------
def _build_openai_messages(req: PredictIn) -> list[dict[str, Any]]:
    """Translate our custom shape -> OpenAI /v1/chat/completions."""
    if req.messages:
        msgs: list[dict[str, Any]] = [
            {"role": m.role, "content": m.content} for m in req.messages
        ]
    else:
        if not req.prompt:
            raise HTTPException(
                status_code=400,
                detail="send either 'messages' or 'prompt'",
            )
        msgs = []
        if req.system:
            msgs.append({"role": "system", "content": req.system})
        msgs.append({"role": "user", "content": req.prompt})

    if app.state.vision_enabled and req.image_b64:
        # Find the LAST user message and convert its content to the
        # OpenAI multimodal "list of parts" form. llama-server with
        # ``--mmproj`` understands ``image_url`` parts identically.
        target = None
        for i in range(len(msgs) - 1, -1, -1):
            if msgs[i]["role"] == "user":
                target = i
                break
        if target is None:
            msgs.append({"role": "user", "content": []})
            target = len(msgs) - 1
        existing = msgs[target]["content"]
        text_blob = existing if isinstance(existing, str) else ""
        data_url = f"data:{req.image_mime};base64,{req.image_b64}"
        msgs[target]["content"] = [
            {"type": "image_url", "image_url": {"url": data_url}},
            {"type": "text", "text": text_blob},
        ]
    return msgs


@app.post(
    "/predict",
    response_model=PredictOut,
    dependencies=[Depends(_require_token)],
)
async def predict(req: PredictIn) -> PredictOut:
    await _ensure_llama_ready()
    msgs = _build_openai_messages(req)

    import base64
    import os
    import hashlib

    async def delete_after_delay(path: str, delay: float):
        await asyncio.sleep(delay)
        try:
            if os.path.exists(path):
                os.remove(path)
                log.info(f"Cleaned up temp file: {path}")
        except Exception as e:
            log.warning(f"Failed to delete temp file {path}: {e}")

    # Process messages to convert base64 data URLs to file URLs
    for msg in msgs:
        content = msg.get("content")
        if isinstance(content, list):
            for part in content:
                if part.get("type") == "image_url":
                    img_url_obj = part.get("image_url") or {}
                    url_str = img_url_obj.get("url") or ""
                    if url_str.startswith("data:image/") and ";base64," in url_str:
                        try:
                            header, base64_str = url_str.split(";base64,", 1)
                            img_bytes = base64.b64decode(base64_str)
                            img_hash = hashlib.sha256(base64_str.encode("ascii")).hexdigest()
                            temp_path = f"/tmp/{img_hash}.jpg"
                            if not os.path.exists(temp_path):
                                with open(temp_path, "wb") as f:
                                    f.write(img_bytes)
                                asyncio.create_task(delete_after_delay(temp_path, 3600.0))
                            img_url_obj["url"] = f"file://{temp_path}"
                        except Exception as e:
                            log.warning(f"Failed to convert base64 image: {e}")

    payload: dict[str, Any] = {
        "model": "local",  # llama-server ignores model name; field required.
        "messages": msgs,
        "max_tokens": min(req.max_tokens, 4096),
        "temperature": req.temperature,
        "top_p": req.top_p,
        "stream": False,
        "chat_template_kwargs": req.chat_template_kwargs or {"enable_thinking": False},
        "reasoning_budget": req.reasoning_budget if (req.enable_thinking or req.think) else 0,
        "reasoning_format": "none",
    }
    if req.response_format:
        payload["response_format"] = req.response_format
    elif req.json_mode:
        payload["response_format"] = {"type": "json_object"}

    if req.id_slot is not None:
        payload["id_slot"] = req.id_slot

    preview_msgs = []
    for m in msgs:
        content_prev = m["content"]
        if isinstance(content_prev, list):
            parts = []
            for part in content_prev:
                p = {}
                for k, v in part.items():
                    if k == "image_url" and isinstance(v, dict) and "url" in v:
                        p[k] = {"url": v["url"][:60] + "..."}
                    else:
                        p[k] = v
                parts.append(p)
            content_prev = parts
        elif isinstance(content_prev, str):
            content_prev = content_prev[:120] + "..." if len(content_prev) > 120 else content_prev
        preview_msgs.append({"role": m["role"], "content": content_prev})
    log.info(f"llama-server request messages payload: {preview_msgs}")

    client: httpx.AsyncClient = app.state.client
    t0 = time.time()
    active_adapter_name: str | None = None
    if ENABLE_LORA:
        async with app.state.lock:
            target_adapter = (req.adapter or req.model or "").strip()
            loaded = getattr(app.state, "lora_adapters", [])
            if loaded:
                new_scales = []
                target_lower = target_adapter.lower()
                for item in loaded:
                    item_id = item.get("id")
                    item_path = item.get("path", "")
                    base_name = Path(item_path).stem.lower()
                    if target_lower in ("base", "none", "raw"):
                        scale = 0.0
                    elif (
                        target_lower in ("garment_vision", "default", "local", "")
                        or "gemini" in target_lower
                        or target_lower == base_name
                        or target_lower in base_name
                        or base_name in target_lower
                    ):
                        scale = 1.0
                        active_adapter_name = Path(item_path).stem
                    else:
                        scale = 0.0
                    new_scales.append({"id": item_id, "scale": scale})

                try:
                    await client.post(
                        f"{LLAMA_BASE_URL}/lora-adapters",
                        json=new_scales,
                        timeout=5.0,
                    )
                    r_refreshed = await client.get(f"{LLAMA_BASE_URL}/lora-adapters", timeout=5.0)
                    if r_refreshed.status_code == 200:
                        app.state.lora_adapters = r_refreshed.json()
                    log.info("LoRA adapter scales updated for request (%s): %s", target_adapter, app.state.lora_adapters)
                except Exception as exc:
                    log.warning("Failed to update LoRA scales: %s", exc)

            try:
                r = await client.post(
                    f"{LLAMA_BASE_URL}/v1/chat/completions",
                    json=payload,
                    timeout=httpx.Timeout(300.0, connect=10.0),
                )
            except httpx.HTTPError as exc:
                log.exception("llama-server request failed")
                raise HTTPException(
                    status_code=502, detail=f"llama-server error: {exc}",
                ) from exc
    else:
        # Keyed Prompt Injection mode: Direct call with prompt prefix caching (no LoRA overhead/lock)
        try:
            r = await client.post(
                f"{LLAMA_BASE_URL}/v1/chat/completions",
                json=payload,
                timeout=httpx.Timeout(300.0, connect=10.0),
            )
        except httpx.HTTPError as exc:
            log.exception("llama-server request failed")
            raise HTTPException(
                status_code=502, detail=f"llama-server error: {exc}",
            ) from exc

    if r.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"llama-server returned {r.status_code}: {r.text[:300]}",
        )

    res = r.json()
    elapsed_ms = int((time.time() - t0) * 1000)
    choice = (res.get("choices") or [{}])[0]
    msg = choice.get("message") or {}
    usage = res.get("usage") or {}
    # Models trained with ``thinking = 1`` (the Gemma-4 fine-tune is one)
    # split their output between ``reasoning_content`` (the deliberation
    # inside ``<|think|> ... </think>``) and ``content`` (the answer
    # after the closing think tag). When the model runs out of token
    # budget inside the think block — common for verbose JSON schemas —
    # ``content`` arrives empty even though ``tokens_completion`` shows
    # the full max. Fall back to ``reasoning_content`` so the backend
    # always gets *something* and can decide whether the JSON inside
    # is parseable. The backend's ``_extract_json`` already handles
    # JSON embedded in free-form text, so this is safe.
    content = msg.get("content") or ""
    if not content:
        content = msg.get("reasoning_content") or ""

    # Strip conversational prefixes/preambles if present (e.g., "Here is the clothing item:")
    cleaned_str = str(content).strip()
    first_brace = cleaned_str.find("{")
    first_bracket = cleaned_str.find("[")
    first_json = -1
    if first_brace != -1 and first_bracket != -1:
        first_json = min(first_brace, first_bracket)
    elif first_brace != -1:
        first_json = first_brace
    elif first_bracket != -1:
        first_json = first_bracket

    if first_json > 0:
        preamble = cleaned_str[:first_json].strip()
        if any(preamble.lower().startswith(p) for p in ("here is", "here are", "certainly", "in this photo", "i see", "below is", "the clothing")):
            cleaned_str = cleaned_str[first_json:].strip()
            content = cleaned_str
    has_image = bool(req.image_b64)
    if not has_image and req.messages:
        for m in req.messages:
            if isinstance(m.content, list):
                for part in m.content:
                    if isinstance(part, dict) and part.get("type") == "image_url":
                        has_image = True
                        break
            if has_image:
                break

    return PredictOut(
        output=str(content),
        finish_reason=choice.get("finish_reason"),
        tokens_prompt=int(usage.get("prompt_tokens") or 0),
        tokens_completion=int(usage.get("completion_tokens") or 0),
        elapsed_ms=elapsed_ms,
        vision_used=bool(app.state.vision_enabled and has_image),
        vision_disabled=bool(has_image and not app.state.vision_enabled),
        adapter_used=active_adapter_name,
    )


# ---- Multi-LoRA Management Endpoints --------------------------------
@app.get("/v1/adapters")
async def get_adapters() -> dict[str, Any]:
    await _ensure_llama_ready()
    client: httpx.AsyncClient = app.state.client
    try:
        r = await client.get(f"{LLAMA_BASE_URL}/lora-adapters", timeout=5.0)
        adapters = r.json() if r.status_code == 200 else getattr(app.state, "lora_adapters", [])
    except Exception:
        adapters = getattr(app.state, "lora_adapters", [])
    return {"adapters": adapters, "count": len(adapters)}


@app.post("/v1/adapters/reload")
async def reload_adapters() -> dict[str, Any]:
    log.info("Hot-reloading adapters requested via /v1/adapters/reload")
    await _ensure_llama_ready(force_respawn=True)
    return {
        "status": "reloaded",
        "adapters": getattr(app.state, "lora_adapters", []),
        "count": len(getattr(app.state, "lora_adapters", [])),
    }


@app.get("/lora-adapters")
async def proxy_get_lora_adapters() -> Any:
    await _ensure_llama_ready()
    client: httpx.AsyncClient = app.state.client
    r = await client.get(f"{LLAMA_BASE_URL}/lora-adapters", timeout=5.0)
    return r.json()


@app.post("/lora-adapters")
async def proxy_post_lora_adapters(data: list[dict[str, Any]]) -> Any:
    await _ensure_llama_ready()
    client: httpx.AsyncClient = app.state.client
    r = await client.post(f"{LLAMA_BASE_URL}/lora-adapters", json=data, timeout=5.0)
    return r.json()


@app.post(
    "/transcribe",
    dependencies=[Depends(_require_token)],
)
async def transcribe(
    file: UploadFile = File(...),
    language: str | None = Form(None),
) -> dict[str, Any]:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        raise HTTPException(
            status_code=501,
            detail="Speech-to-Text is not supported directly by llama-server GGUF. "
                   "Provide GEMINI_API_KEY in the environment of dressapp-eyes to enable Gemini fallback transcription.",
        )
    
    audio_data = await file.read()
    import base64
    b64_audio = base64.b64encode(audio_data).decode("utf-8")
    
    prompt = "Transcribe this audio precisely. Output ONLY the raw transcription text in the language it was spoken. Do not add any introductory or concluding text, formatting, or commentary."
    if language and language != "auto":
        prompt += f" The audio is expected to be in {language}."

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inlineData": {
                            "mimeType": file.content_type or "audio/webm",
                            "data": b64_audio
                        }
                    }
                ]
            }
        ]
    }
    
    t0 = time.time()
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30.0
        )
        if r.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Gemini API fallback transcription failed: {r.status_code} {r.text}"
            )
        res = r.json()
        text = ""
        try:
            parts = res["candidates"][0]["content"]["parts"]
            text = parts[0]["text"].strip()
        except (KeyError, IndexError) as e:
            raise HTTPException(502, f"Failed to parse Gemini response: {e}")
            
        elapsed_ms = int((time.time() - t0) * 1000)
        return {
            "text": text,
            "language": language or "en",
            "duration_s": 0.0,
            "elapsed_ms": elapsed_ms
        }

