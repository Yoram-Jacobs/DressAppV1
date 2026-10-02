# DressApp Eyes — Multi-LoRA Serving Runtime
# Supports dynamic adapter hot-swapping for Gemma-4 E4B across CPU and GPU runtimes.

FROM python:3.11-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080 \
    ADAPTERS_DIR=/app/adapters \
    BASE_MODEL=google/gemma-4-E4B-it \
    HF_HUB_ENABLE_HF_TRANSFER=0

# System runtime dependencies
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      curl ca-certificates tini git \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install PyTorch & HuggingFace PEFT / serving dependencies
RUN pip install --upgrade pip setuptools wheel && \
    pip install --prefer-binary \
      "torch>=2.2.0" \
      "transformers>=4.40.0" \
      "peft>=0.10.0" \
      "accelerate>=0.28.0" \
      "bitsandbytes>=0.43.0" \
      "fastapi>=0.110.0" \
      "uvicorn[standard]>=0.28.0" \
      "httpx>=0.27.0" \
      "pydantic>=2.6.0" \
      "huggingface_hub>=0.22.0" \
      "safetensors>=0.4.2"

# Setup directories for persistent volume mounts
RUN mkdir -p /app/adapters \
    /app/adapters/garment_vision \
    /app/adapters/trend_scout \
    /app/adapters/stylist_chat \
    /app/adapters/suitcase \
    /app/adapters/scheduled_outfit \
    /models

# Copy server application and startup entrypoint
COPY server.py /app/server.py
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
  CMD curl -fsS http://localhost:8080/healthz || exit 1

ENTRYPOINT ["/usr/bin/tini", "--", "/app/entrypoint.sh"]
