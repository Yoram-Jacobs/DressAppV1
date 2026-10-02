#!/usr/bin/env bash
set -eo pipefail

# ==============================================================================
# deploy/reload_eyes_adapters.sh
# VPS Zero-Downtime Multi-LoRA Adapter Sync & Reload Script for DressApp Eyes
# ==============================================================================

ADAPTER_NAME=""
HF_REPO=""
ADAPTERS_DIR="${ADAPTERS_DIR:-/srv/AI-Stylist/eyes_v4_adapter}"
EYES_GGUF_ADAPTERS_DIR="${EYES_GGUF_ADAPTERS_DIR:-/srv/AI-Stylist/eyes_gguf/adapters}"
CONTAINER_NAME="${CONTAINER_NAME:-dressapp-eyes}"
PORT="${PORT:-7860}"
HF_TOKEN="${HF_TOKEN:-}"

print_usage() {
  cat <<EOF
Usage: $0 --adapter <adapter_name> [--repo <hf_repo_id>] [--adapters-dir <dir>] [--token <hf_token>]

Options:
  --adapter <name>       Target workflow: garment_vision, trend_scout, stylist_chat, suitcase, scheduled_outfit (or 'all')
  --repo <id>            Hugging Face repository ID (default: Yoram-Jacobs/dressapp-<name>-adapter)
  --adapters-dir <dir>   Path to persistent adapters host directory (default: /srv/AI-Stylist/eyes_v4_adapter)
  --token <token>        Hugging Face Hub access token (optional if public or cached)
  --help                 Show this help message
EOF
}

# Parse command line options
while [[ $# -gt 0 ]]; do
  case "$1" in
    --adapter)
      ADAPTER_NAME="$2"
      shift 2
      ;;
    --repo)
      HF_REPO="$2"
      shift 2
      ;;
    --adapters-dir)
      ADAPTERS_DIR="$2"
      shift 2
      ;;
    --token)
      HF_TOKEN="$2"
      shift 2
      ;;
    --help)
      print_usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      print_usage
      exit 1
      ;;
  esac
done

if [[ -z "$ADAPTER_NAME" ]]; then
  echo "Error: --adapter parameter is required."
  print_usage
  exit 1
fi

echo "=================================================================="
echo " DressApp Eyes Multi-LoRA VPS Adapter Sync & Reload"
echo " Target Adapter:   ${ADAPTER_NAME}"
echo " Adapters Dir:     ${ADAPTERS_DIR}"
echo " Container Name:   ${CONTAINER_NAME}"
echo "=================================================================="

# Ensure base adapters directory exists
mkdir -p "${ADAPTERS_DIR}"

sync_single_adapter() {
  local name="$1"
  local repo="$2"
  local target="${ADAPTERS_DIR}/${name}"
  
  if [[ -z "$repo" ]]; then
    repo="Yoram-Jacobs/dressapp-${name}-adapter"
  fi

  echo "[-] Syncing adapter '${name}' from '${repo}' into '${target}'..."
  mkdir -p "${target}"

  # Option 1: Use huggingface-cli if installed
  if command -v huggingface-cli >/dev/null 2>&1; then
    echo "Using huggingface-cli for atomic download..."
    TOKEN_ARG=""
    if [[ -n "$HF_TOKEN" ]]; then
      TOKEN_ARG="--token ${HF_TOKEN}"
    fi
    huggingface-cli download "${repo}" --local-dir "${target}" --local-dir-use-symlinks False ${TOKEN_ARG}
  # Option 2: Fallback to python huggingface_hub
  elif python3 -c "import huggingface_hub" >/dev/null 2>&1; then
    echo "Using Python huggingface_hub snapshot_download..."
    python3 -c "
import os
from huggingface_hub import snapshot_download
token = os.environ.get('HF_TOKEN') or None
snapshot_download(repo_id='${repo}', local_dir='${target}', token=token)
"
  # Option 3: Fallback using curl for core safetensors + config files
  else
    echo "Falling back to direct HTTPS fetch from Hugging Face..."
    AUTH_HEADER=""
    if [[ -n "$HF_TOKEN" ]]; then
      AUTH_HEADER="Authorization: Bearer ${HF_TOKEN}"
    fi

    for file in "adapter_config.json" "adapter_model.safetensors"; do
      url="https://huggingface.co/${repo}/resolve/main/${file}"
      echo "Fetching ${file} from ${url}..."
      if [[ -n "$AUTH_HEADER" ]]; then
        curl -fsSL -H "${AUTH_HEADER}" "${url}" -o "${target}/${file}.tmp" && mv "${target}/${file}.tmp" "${target}/${file}" || true
      else
        curl -fsSL "${url}" -o "${target}/${file}.tmp" && mv "${target}/${file}.tmp" "${target}/${file}" || true
      fi
    done
  fi

  # Validate downloaded files
  if [[ ! -f "${target}/adapter_config.json" ]]; then
    echo "Warning: ${target}/adapter_config.json is missing."
  else
    echo " [OK] Verified adapter_config.json"
  fi

  if [[ ! -f "${target}/adapter_model.safetensors" ]] && [[ ! -f "${target}/adapter_model.bin" ]] && [[ -z "$(find "${target}" -maxdepth 1 -name '*.gguf' 2>/dev/null)" ]]; then
    echo "Warning: No adapter weights found in ${target}!"
  else
    echo " [OK] Verified adapter weights in ${target}"
  fi

  # Stage GGUF adapter into EYES_GGUF_ADAPTERS_DIR
  mkdir -p "${EYES_GGUF_ADAPTERS_DIR}"
  local gguf_file="$(find "${target}" -maxdepth 1 -name '*.gguf' 2>/dev/null | head -n 1)"
  if [[ -n "${gguf_file}" && -f "${gguf_file}" ]]; then
    echo "Staging GGUF adapter ${gguf_file} -> ${EYES_GGUF_ADAPTERS_DIR}/${name}.gguf"
    cp -f "${gguf_file}" "${EYES_GGUF_ADAPTERS_DIR}/${name}.gguf"
  elif [[ -f "${target}/adapter_model.safetensors" ]]; then
    echo "Adapter in ${target} is in PEFT safetensors format. Converting to GGUF format..."
    if docker ps --format '{{.Names}}' | grep -q 'dressapp-backend'; then
      docker exec -w /app/backend/app/converter dressapp-backend python convert_lora_to_gguf.py --outtype bf16 --outfile "/srv/AI-Stylist/eyes_gguf/adapters/${name}.gguf" "${target}" || true
    fi
  fi
  chmod -R 755 "${EYES_GGUF_ADAPTERS_DIR}" 2>/dev/null || true
}

# Sync adapter(s)
if [[ "$ADAPTER_NAME" == "all" ]]; then
  for wf in garment_vision trend_scout stylist_chat suitcase scheduled_outfit; do
    sync_single_adapter "$wf" ""
  done
else
  sync_single_adapter "$ADAPTER_NAME" "$HF_REPO"
fi

# Zero-Downtime Reload Execution
echo "[-] Initiating reload on ${CONTAINER_NAME}..."

RELOADED=0

# Attempt 1: Dynamic in-memory hot-reload via docker exec inside the container
if docker ps --format '{{.Names}}' | grep -Eq "^(${CONTAINER_NAME}|eyes)$"; then
  echo "Attempting zero-downtime hot reload via docker exec ${CONTAINER_NAME}..."
  if docker exec "${CONTAINER_NAME}" curl -fsS -X POST "http://127.0.0.1:7860/v1/adapters/reload" -H "Content-Type: application/json" -m 25 >/dev/null 2>&1; then
    echo " [SUCCESS] Hot-reload API accepted! Adapters registered in-memory without downtime."
    RELOADED=1
  fi
fi

# Attempt 2: Direct localhost curl if exposed
if [[ $RELOADED -eq 0 ]]; then
  echo "Attempting hot reload via http://127.0.0.1:${PORT}/v1/adapters/reload..."
  if curl -fsS -X POST "http://127.0.0.1:${PORT}/v1/adapters/reload" -H "Content-Type: application/json" -m 25 >/dev/null 2>&1; then
    echo " [SUCCESS] Hot-reload API accepted! Adapters registered in-memory without downtime."
    RELOADED=1
  fi
fi

# Fallback: Graceful docker container restart
if [[ $RELOADED -eq 0 ]]; then
  if docker ps --format '{{.Names}}' | grep -Eq "^(${CONTAINER_NAME}|eyes)$"; then
    echo "Gracefully restarting container ${CONTAINER_NAME}..."
    docker restart "${CONTAINER_NAME}" || docker compose restart eyes
    
    # Wait for health check to pass
    echo "Waiting for healthz probe..."
    for i in {1..30}; do
      if docker exec "${CONTAINER_NAME}" curl -fsS "http://127.0.0.1:7860/healthz" >/dev/null 2>&1 || curl -fsS "http://127.0.0.1:${PORT}/healthz" >/dev/null 2>&1; then
        echo " [SUCCESS] Service ${CONTAINER_NAME} is healthy and serving multi-LoRA requests!"
        RELOADED=1
        break
      fi
      sleep 2
    done
  else
    echo "Container ${CONTAINER_NAME} is not currently running. Weights staged for next boot."
  fi
fi

echo "=================================================================="
echo " Multi-LoRA adapter deployment complete for: ${ADAPTER_NAME}"
echo "=================================================================="
