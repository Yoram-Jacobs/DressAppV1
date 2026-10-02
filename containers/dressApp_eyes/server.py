"""DressApp Eyes — Dynamic Multi-LoRA Serving Engine for Gemma-4 E4B.

Provides OpenAI-compatible `/v1/chat/completions` and legacy `/predict` endpoints.
Features:
- Single base model in memory (google/gemma-4-E4B-it) with 4-bit / CPU quantization.
- Dynamic Multi-LoRA adapter dispatch based on `model` or `lora_name` payload parameter.
- Supported workflows:
    1. garment_vision (Garment attribute extraction)
    2. trend_scout (Trend analysis & aesthetic classification)
    3. stylist_chat (Conversational personal wardrobe styling)
    4. suitcase (Capsule packing manifest generator)
    5. scheduled_outfit (Weather/calendar outfit scheduling)
- Hot-reload endpoint `/v1/adapters/reload` for zero-downtime weight updates.
"""

from __future__ import annotations

import asyncio
import gc
import json
import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import httpx
from fastapi import FastAPI, Header, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("dressapp-eyes-multilora")

# Configuration
PORT = int(os.environ.get("PORT", "8080"))
BASE_MODEL_NAME = os.environ.get("BASE_MODEL", "google/gemma-4-E4B-it")
ADAPTERS_DIR = Path(os.environ.get("ADAPTERS_DIR", "/app/adapters"))
INFERENCE_BACKEND = os.environ.get("INFERENCE_BACKEND", "auto").lower()  # auto, vllm, llama-server, peft
UPSTREAM_URL = os.environ.get("UPSTREAM_URL", "http://127.0.0.1:8081")
API_TOKEN = os.environ.get("EYES_API_TOKEN")
DEVICE = os.environ.get("TORCH_DEVICE", "cuda" if os.environ.get("CUDA_VISIBLE_DEVICES") else "cpu")
LOAD_IN_4BIT = os.environ.get("LOAD_IN_4BIT", "true").lower() in ("1", "true", "yes")

# Global state
class ServerState:
    base_model = None
    tokenizer = None
    loaded_adapters: Dict[str, Path] = {}
    active_backend: str = "peft"
    lock = asyncio.Lock()
    boot_time: float = 0.0

state = ServerState()


def discover_adapters(base_dir: Path) -> Dict[str, Path]:
    """Scan adapters directory and return available adapter paths."""
    discovered = {}
    if not base_dir.exists():
        return discovered

    for path in base_dir.iterdir():
        if path.is_dir():
            has_safetensors = (path / "adapter_model.safetensors").is_file()
            has_bin = (path / "adapter_model.bin").is_file()
            has_config = (path / "adapter_config.json").is_file()
            has_gguf = any(path.glob("*.gguf"))
            if has_config and (has_safetensors or has_bin or has_gguf):
                discovered[path.name] = path
    return discovered


def load_peft_engine():
    """Load base model and mount all discovered adapters using HuggingFace PEFT."""
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import PeftModel

    logger.info("Initializing HuggingFace PEFT Multi-LoRA backend with base model: %s", BASE_MODEL_NAME)
    
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL_NAME, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model_kwargs = {"device_map": "auto" if torch.cuda.is_available() else None, "trust_remote_code": True}

    if torch.cuda.is_available() and LOAD_IN_4BIT:
        try:
            from transformers import BitsAndBytesConfig
            model_kwargs["quantization_config"] = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_compute_dtype=torch.bfloat16,
                bnb_4bit_use_double_quant=True,
            )
            logger.info("Configured BitsAndBytes 4-bit NF4 quantization for GPU execution.")
        except Exception as e:
            logger.warning("Failed to configure 4-bit quantization: %s. Falling back to bfloat16/float32.", e)
            model_kwargs["torch_dtype"] = torch.bfloat16 if torch.cuda.is_available() else torch.float32
    else:
        model_kwargs["torch_dtype"] = torch.float32

    logger.info("Loading base model into memory...")
    t0 = time.time()
    try:
        base_model = AutoModelForCausalLM.from_pretrained(BASE_MODEL_NAME, **model_kwargs)
    except Exception as e:
        logger.error("Failed loading base model %s: %s", BASE_MODEL_NAME, e)
        raise e

    logger.info("Base model loaded in %.2fs. Initializing adapters...", time.time() - t0)

    discovered = discover_adapters(ADAPTERS_DIR)
    peft_model = None
    loaded = {}

    for name, adapter_path in discovered.items():
        try:
            logger.info("Mounting LoRA adapter: %s from %s", name, adapter_path)
            if peft_model is None:
                peft_model = PeftModel.from_pretrained(base_model, str(adapter_path), adapter_name=name)
            else:
                peft_model.load_adapter(str(adapter_path), adapter_name=name)
            loaded[name] = adapter_path
        except Exception as e:
            logger.error("Failed mounting adapter %s: %s", name, e)

    state.base_model = peft_model if peft_model is not None else base_model
    state.tokenizer = tokenizer
    state.loaded_adapters = loaded
    state.active_backend = "peft"
    logger.info("Multi-LoRA PEFT engine initialized. Loaded adapters: %s", list(loaded.keys()))


@asynccontextmanager
async def lifespan(app: FastAPI):
    state.boot_time = time.time()
    logger.info("Booting DressApp Eyes Multi-LoRA Service on port %d...", PORT)

    # Inspect environment to determine backend
    if INFERENCE_BACKEND == "vllm" or (INFERENCE_BACKEND == "auto" and os.environ.get("VLLM_ACTIVE") == "1"):
        logger.info("Operating in vLLM proxy mode forwarding to %s", UPSTREAM_URL)
        state.active_backend = "vllm"
        state.loaded_adapters = discover_adapters(ADAPTERS_DIR)
    elif INFERENCE_BACKEND == "llama-server" or (INFERENCE_BACKEND == "auto" and os.environ.get("LLAMA_SERVER_ACTIVE") == "1"):
        logger.info("Operating in llama-server proxy mode forwarding to %s", UPSTREAM_URL)
        state.active_backend = "llama-server"
        state.loaded_adapters = discover_adapters(ADAPTERS_DIR)
    else:
        try:
            load_peft_engine()
        except Exception as e:
            logger.warning("Could not initialize local PEFT engine: %s. Falling back to proxy/stub mode.", e)
            state.active_backend = "proxy"
            state.loaded_adapters = discover_adapters(ADAPTERS_DIR)

    yield

    logger.info("Shutting down DressApp Eyes Multi-LoRA Service...")
    if state.base_model is not None:
        del state.base_model
        del state.tokenizer
        gc.collect()


app = FastAPI(title="DressApp Eyes Multi-LoRA Serving API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Schemas
class ChatMessage(BaseModel):
    role: str
    content: Union[str, List[Dict[str, Any]]]


class ChatCompletionRequest(BaseModel):
    model: Optional[str] = "google/gemma-4-E4B-it"
    lora_name: Optional[str] = None
    messages: List[ChatMessage]
    temperature: Optional[float] = 0.2
    max_tokens: Optional[int] = 1024
    top_p: Optional[float] = 0.95
    stream: Optional[bool] = False
    json_mode: Optional[bool] = False


class LegacyPredictRequest(BaseModel):
    model: Optional[str] = "garment_vision"
    lora_name: Optional[str] = None
    system_prompt: Optional[str] = None
    user_text: Optional[str] = ""
    image_b64: Optional[str] = None
    max_tokens: Optional[int] = 512
    temperature: Optional[float] = 0.1
    messages: Optional[List[Dict[str, Any]]] = None


def verify_auth(authorization: Optional[str] = Header(None)):
    if API_TOKEN:
        if not authorization or authorization.replace("Bearer ", "").strip() != API_TOKEN.strip():
            raise HTTPException(status_code=401, detail="Unauthorized: Invalid or missing EYES_API_TOKEN")


@app.get("/health")
@app.get("/healthz")
async def health():
    return {
        "status": "ok",
        "service": "dressapp-eyes",
        "backend": state.active_backend,
        "base_model": BASE_MODEL_NAME,
        "adapters": list(state.loaded_adapters.keys()),
        "uptime_seconds": time.time() - state.boot_time,
    }


@app.get("/v1/models")
async def list_models():
    models = [{"id": BASE_MODEL_NAME, "object": "model", "type": "base"}]
    for adapter_name in state.loaded_adapters:
        models.append({"id": adapter_name, "object": "model", "type": "lora_adapter"})
    return {"object": "list", "data": models}


@app.post("/v1/adapters/reload")
async def reload_adapters(request: Request, authorization: Optional[str] = Header(None)):
    """Dynamically scan and register updated adapters without restarting the process."""
    verify_auth(authorization)
    async with state.lock:
        discovered = discover_adapters(ADAPTERS_DIR)
        logger.info("Hot-reloading adapters from %s. Found: %s", ADAPTERS_DIR, list(discovered.keys()))

        if state.active_backend == "peft" and state.base_model is not None:
            try:
                for name, path in discovered.items():
                    if name not in state.loaded_adapters:
                        logger.info("Loading new adapter dynamically: %s", name)
                        state.base_model.load_adapter(str(path), adapter_name=name)
                    else:
                        # Reload updated weights
                        logger.info("Refreshing existing adapter: %s", name)
                        try:
                            state.base_model.load_adapter(str(path), adapter_name=name)
                        except Exception:
                            pass
                state.loaded_adapters = discovered
            except Exception as e:
                logger.error("Error during PEFT adapter hot-reload: %s", e)
                raise HTTPException(status_code=500, detail=f"Hot reload failed: {e}")
        else:
            state.loaded_adapters = discovered

        return {
            "status": "success",
            "message": "Adapters synchronized",
            "active_adapters": list(state.loaded_adapters.keys()),
        }


@app.post("/v1/chat/completions")
async def chat_completions(req: ChatCompletionRequest, authorization: Optional[str] = Header(None)):
    """OpenAI-compatible chat completions endpoint with dynamic multi-LoRA routing."""
    verify_auth(authorization)

    target_adapter = req.lora_name or req.model
    if target_adapter == BASE_MODEL_NAME:
        target_adapter = None

    # Forward to upstream (vLLM or llama-server) if operating in proxy mode
    if state.active_backend in ("vllm", "llama-server", "proxy"):
        async with httpx.AsyncClient(timeout=120.0) as client:
            payload = req.model_dump(exclude_none=True)
            if target_adapter and target_adapter in state.loaded_adapters:
                payload["model"] = target_adapter
            try:
                resp = await client.post(f"{UPSTREAM_URL}/v1/chat/completions", json=payload)
                return Response(
                    content=resp.content,
                    status_code=resp.status_code,
                    media_type="application/json",
                )
            except Exception as e:
                logger.error("Error forwarding request to upstream (%s): %s", UPSTREAM_URL, e)
                raise HTTPException(status_code=502, detail=f"Inference backend unavailable: {e}")

    # Local PEFT Multi-LoRA execution
    async with state.lock:
        if state.base_model is None or state.tokenizer is None:
            raise HTTPException(status_code=503, detail="Local model not loaded")

        import torch
        tokenizer = state.tokenizer
        model = state.base_model

        # Route adapter
        if target_adapter and target_adapter in state.loaded_adapters:
            try:
                model.set_adapter(target_adapter)
                logger.debug("Switched active LoRA adapter to '%s'", target_adapter)
            except Exception as e:
                logger.warning("Failed setting adapter '%s': %s. Using base.", target_adapter, e)
        else:
            if hasattr(model, "disable_adapter"):
                model.disable_adapter()

        # Format conversation messages
        messages_dict = [m.model_dump() for m in req.messages]
        try:
            prompt = tokenizer.apply_chat_template(messages_dict, tokenize=False, add_generation_prompt=True)
        except Exception:
            prompt = "\n".join([f"{m.role}: {m.content}" for m in req.messages]) + "\nassistant:"

        inputs = tokenizer(prompt, return_tensors="pt")
        if torch.cuda.is_available():
            inputs = {k: v.to("cuda") for k, v in inputs.items()}

        gen_kwargs = {
            "max_new_tokens": req.max_tokens or 1024,
            "temperature": max(req.temperature or 0.2, 0.01),
            "top_p": req.top_p or 0.95,
            "do_sample": (req.temperature or 0.2) > 0.01,
            "pad_token_id": tokenizer.pad_token_id or tokenizer.eos_token_id,
        }

        try:
            with torch.no_grad():
                output_tokens = model.generate(**inputs, **gen_kwargs)
            
            input_len = inputs["input_ids"].shape[1]
            generated_tokens = output_tokens[0][input_len:]
            response_text = tokenizer.decode(generated_tokens, skip_special_tokens=True).strip()

            return {
                "id": f"chatcmpl-{int(time.time()*1000)}",
                "object": "chat.completion",
                "created": int(time.time()),
                "model": target_adapter or BASE_MODEL_NAME,
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": response_text},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {
                    "prompt_tokens": input_len,
                    "completion_tokens": len(generated_tokens),
                    "total_tokens": input_len + len(generated_tokens),
                },
            }
        except Exception as e:
            logger.error("Generation error: %s", e)
            raise HTTPException(status_code=500, detail=f"Generation failed: {e}")


@app.post("/predict")
async def legacy_predict(req: LegacyPredictRequest, authorization: Optional[str] = Header(None)):
    """Legacy DressApp Eyes endpoint compatibility adapter."""
    verify_auth(authorization)

    target_adapter = req.lora_name or req.model or "garment_vision"
    messages: List[ChatMessage] = []

    if req.messages:
        for m in req.messages:
            messages.append(ChatMessage(role=m.get("role", "user"), content=m.get("content", "")))
    else:
        if req.system_prompt:
            messages.append(ChatMessage(role="system", content=req.system_prompt))
        
        user_content: List[Dict[str, Any]] = []
        if req.image_b64:
            user_content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{req.image_b64}"}})
        if req.user_text:
            user_content.append({"type": "text", "text": req.user_text})

        messages.append(ChatMessage(role="user", content=user_content if req.image_b64 else (req.user_text or "")))

    chat_req = ChatCompletionRequest(
        model=target_adapter,
        lora_name=target_adapter,
        messages=messages,
        max_tokens=req.max_tokens or 512,
        temperature=req.temperature or 0.1,
    )
    res = await chat_completions(chat_req, authorization)
    if isinstance(res, dict):
        content = res.get("choices", [{}])[0].get("message", {}).get("content", "")
        return {"result": content, "raw": res, "model": target_adapter}
    return res


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=PORT, log_level="info")
