#!/usr/bin/env bash
set -eo pipefail

# DressApp Eyes Multi-LoRA Entrypoint
# Discovers mounted LoRA adapters and launches the unified inference server.

PORT="${PORT:-8080}"
BASE_MODEL="${BASE_MODEL:-google/gemma-4-E4B-it}"
ADAPTERS_DIR="${ADAPTERS_DIR:-/app/adapters}"
INFERENCE_BACKEND="${INFERENCE_BACKEND:-auto}"
MAX_LORA_RANK="${MAX_LORA_RANK:-64}"
UPSTREAM_PORT="${UPSTREAM_PORT:-8081}"

echo "=========================================================="
echo " Starting DressApp Eyes Multi-LoRA Serving Engine"
echo " Base Model:        ${BASE_MODEL}"
echo " Adapters Dir:      ${ADAPTERS_DIR}"
echo " Port:              ${PORT}"
echo " Target Backend:    ${INFERENCE_BACKEND}"
echo "=========================================================="

# Discover all adapters mounted in ADAPTERS_DIR
LORA_MODULES=()
LORA_NAMES=()

if [ -d "${ADAPTERS_DIR}" ]; then
  for dir in "${ADAPTERS_DIR}"/*; do
    if [ -d "$dir" ]; then
      adapter_name=$(basename "$dir")
      if [ -f "$dir/adapter_config.json" ] || [ -f "$dir/adapter_model.safetensors" ] || [ -n "$(find "$dir" -maxdepth 1 -name '*.gguf' 2>/dev/null)" ]; then
        echo " [+] Found valid LoRA adapter: ${adapter_name} (${dir})"
        LORA_MODULES+=("${adapter_name}=${dir}")
        LORA_NAMES+=("${adapter_name}")
      fi
    fi
  done
fi

echo " Discovered ${#LORA_NAMES[@]} LoRA adapter(s): ${LORA_NAMES[*]:-None}"

# Determine operational backend
if [ "$INFERENCE_BACKEND" = "vllm" ] || { [ "$INFERENCE_BACKEND" = "auto" ] && command -v vllm >/dev/null 2>&1 && [ -n "${CUDA_VISIBLE_DEVICES:-}" ]; }; then
  echo "[-] Launching vLLM engine with dynamic multi-LoRA routing..."
  
  VLLM_ARGS=(
    "serve" "$BASE_MODEL"
    "--host" "0.0.0.0"
    "--port" "$PORT"
    "--trust-remote-code"
  )

  if [ ${#LORA_MODULES[@]} -gt 0 ]; then
    VLLM_ARGS+=(
      "--enable-lora"
      "--lora-modules" "${LORA_MODULES[@]}"
      "--max-lora-rank" "$MAX_LORA_RANK"
    )
  fi

  exec python3 -m vllm.entrypoints.openai.api_server "${VLLM_ARGS[@]}"

elif [ "$INFERENCE_BACKEND" = "llama-server" ] || { [ "$INFERENCE_BACKEND" = "auto" ] && [ -x "/usr/local/bin/llama-server" ] && [ -f "${EYES_MODEL_DIR:-/models}/${EYES_MODEL_FILE:-gemma-4-E4B-it-Q3_K_M.gguf}" ]; }; then
  echo "[-] Launching llama-server with adapter router & Python proxy on port $PORT..."
  
  MODEL_PATH="${EYES_MODEL_DIR:-/models}/${EYES_MODEL_FILE:-gemma-4-E4B-it-Q3_K_M.gguf}"
  LLAMA_ARGS=(
    "/usr/local/bin/llama-server"
    "--model" "$MODEL_PATH"
    "--host" "127.0.0.1"
    "--port" "$UPSTREAM_PORT"
    "--threads" "${LLAMA_THREADS:-4}"
    "--ctx-size" "${LLAMA_CTX_SIZE:-8192}"
    "--batch-size" "${LLAMA_N_BATCH:-2048}"
    "--jinja"
    "--reasoning-budget" "0"
    "--chat-template-kwargs" '{"enable_thinking": false}'
  )

  # Attach lora adapters if any GGUF loras exist
  for dir in "${ADAPTERS_DIR}"/*; do
    if [ -d "$dir" ]; then
      for f in "$dir"/*.gguf "$dir"/adapter_model.bin; do
        if [ -f "$f" ]; then
          LLAMA_ARGS+=("--lora" "$f")
          break
        fi
      done
    fi
  done

  echo "Spawning backend process: ${LLAMA_ARGS[*]}"
  "${LLAMA_ARGS[@]}" &
  LLAMA_PID=$!

  export INFERENCE_BACKEND="llama-server"
  export UPSTREAM_URL="http://127.0.0.1:${UPSTREAM_PORT}"
  export LLAMA_SERVER_ACTIVE="1"

  # Trap and terminate child process upon container shutdown
  trap 'echo "Stopping llama-server..."; kill -TERM "$LLAMA_PID" 2>/dev/null || true; exit 0' SIGTERM SIGINT

  echo "Launching DressApp Eyes API Proxy on port ${PORT}..."
  exec python3 /app/server.py

else
  echo "[-] Launching native Python / PEFT multi-LoRA server on port ${PORT}..."
  export INFERENCE_BACKEND="peft"
  exec python3 /app/server.py
fi
