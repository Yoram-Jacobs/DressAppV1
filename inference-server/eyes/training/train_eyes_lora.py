#!/usr/bin/env python3
"""
inference-server/eyes/training/train_eyes_lora.py

Headless QLoRA SFT fine-tuning for DressApp Eyes (Gemma-4 multimodal vision-language model).
Supports:
  1. Modal Labs serverless GPU execution (modal run train_eyes_lora.py)
  2. Local GPU execution (NVIDIA CUDA / ROCm)
  3. CPU dry-run / smoke-test mode (--dry-run) for headless CI/CD testing
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("train_eyes_lora")


def load_env_credentials() -> None:
    """Loads environment variables from local .env files if present and normalizes token aliases."""
    candidates = [
        Path(".env"),
        Path("deploy/.env"),
        Path("backend/.env"),
        Path(__file__).resolve().parent / ".env",
        Path(__file__).resolve().parents[3] / ".env",
    ]
    for c in candidates:
        if c.exists():
            try:
                for line in c.read_text(encoding="utf-8", errors="ignore").splitlines():
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip("'\"")
                        if k and k not in os.environ:
                            os.environ[k] = v
            except Exception:
                pass

    # Normalize Modal Token aliases (supports both MODAL_API_TOKEN_* and MODAL_TOKEN_*)
    if "MODAL_API_TOKEN_ID" in os.environ and "MODAL_TOKEN_ID" not in os.environ:
        os.environ["MODAL_TOKEN_ID"] = os.environ["MODAL_API_TOKEN_ID"]
    if "MODAL_API_TOKEN_SECRET" in os.environ and "MODAL_TOKEN_SECRET" not in os.environ:
        os.environ["MODAL_TOKEN_SECRET"] = os.environ["MODAL_API_TOKEN_SECRET"]

    # Normalize HF Token aliases (supports EYES_HF_TOKEN, HF_WRITE, HF-WRITE, HF_TOKEN)
    hf_val = (
        os.environ.get("EYES_HF_TOKEN")
        or os.environ.get("HF_TOKEN")
        or os.environ.get("HF_WRITE")
        or os.environ.get("HF-WRITE")
    )
    if hf_val and "HF_TOKEN" not in os.environ:
        os.environ["HF_TOKEN"] = hf_val


# Initialize environment credentials
load_env_credentials()


def create_dry_run_adapter(output_dir: Path, base_model: str) -> dict[str, Any]:
    """Generates a valid dummy PEFT LoRA adapter for smoke testing CI/CD pipelines without GPU."""
    logger.info("Running in DRY-RUN mode. Emulating QLoRA training and producing mock adapter...")
    output_dir.mkdir(parents=True, exist_ok=True)

    adapter_config = {
        "auto_mapping": None,
        "base_model_name_or_path": base_model,
        "bias": "none",
        "fan_in_fan_out": False,
        "inference_mode": True,
        "init_lora_weights": True,
        "layers_pattern": None,
        "layers_to_transform": None,
        "lora_alpha": 32,
        "lora_dropout": 0.05,
        "modules_to_save": None,
        "peft_type": "LORA",
        "r": 16,
        "revision": None,
        "target_modules": ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        "task_type": "CAUSAL_LM",
    }
    (output_dir / "adapter_config.json").write_text(json.dumps(adapter_config, indent=2), encoding="utf-8")

    # Generate a lightweight dummy safetensors file for CI artifact tracking
    try:
        from safetensors.torch import save_file
        import torch
        dummy_tensors = {
            "base_model.model.model.layers.0.self_attn.q_proj.lora_A.weight": torch.zeros((16, 64)),
            "base_model.model.model.layers.0.self_attn.q_proj.lora_B.weight": torch.zeros((64, 16)),
        }
        save_file(dummy_tensors, str(output_dir / "adapter_model.safetensors"))
    except ImportError:
        # Fallback if safetensors not installed in dry-run environment
        (output_dir / "adapter_model.safetensors").write_bytes(b"DUMMY_SAFETENSORS_DATA")

    train_stats = {
        "status": "dry_run_success",
        "base_model": base_model,
        "epochs": 1,
        "final_loss": 0.042,
        "train_runtime_seconds": 1.25,
        "samples_per_second": 8.0,
        "timestamp": time.time(),
    }
    (output_dir / "train_stats.json").write_text(json.dumps(train_stats, indent=2), encoding="utf-8")
    logger.info("Mock adapter successfully created at %s", output_dir)
    return train_stats


def train_lora_native(
    dataset_path: Path,
    base_model: str,
    output_dir: Path,
    epochs: int = 3,
    batch_size: int = 2,
    gradient_accumulation_steps: int = 4,
    learning_rate: float = 2e-4,
    lora_r: int = 16,
    lora_alpha: int = 32,
    lora_dropout: float = 0.05,
    max_seq_length: int = 2048,
    warmup_ratio: float = 0.05,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Executes native QLoRA fine-tuning using Hugging Face PEFT + TRL SFTTrainer."""
    if dry_run:
        return create_dry_run_adapter(output_dir, base_model)

    import torch
    from datasets import load_dataset
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    from transformers import (
        AutoModelForVision2Seq,
        AutoProcessor,
        BitsAndBytesConfig,
        TrainingArguments,
    )
    from trl import SFTTrainer

    if not torch.cuda.is_available():
        logger.warning("CUDA is not available on this machine! Fallback to CPU dry run or expect slow execution.")

    logger.info("Loading SFT dataset from %s", dataset_path)
    dataset = load_dataset("json", data_files=str(dataset_path), split="train")

    logger.info("Configuring 4-bit BitsAndBytes quantization...")
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16,
        bnb_4bit_use_double_quant=True,
    )

    logger.info("Loading base model: %s", base_model)
    processor = AutoProcessor.from_pretrained(base_model, trust_remote_code=True)
    model = AutoModelForVision2Seq.from_pretrained(
        base_model,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
    )

    model = prepare_model_for_kbit_training(model)

    # Freeze vision encoder to preserve pre-trained fashion representations
    if hasattr(model, "vision_tower"):
        for param in model.vision_tower.parameters():
            param.requires_grad = False
        logger.info("Froze vision encoder parameters.")

    peft_config = LoraConfig(
        r=lora_r,
        lora_alpha=lora_alpha,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=lora_dropout,
        bias="none",
        task_type="CAUSAL_LM",
    )

    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()

    output_dir.mkdir(parents=True, exist_ok=True)
    training_args = TrainingArguments(
        output_dir=str(output_dir),
        num_train_epochs=epochs,
        per_device_train_batch_size=batch_size,
        gradient_accumulation_steps=gradient_accumulation_steps,
        learning_rate=learning_rate,
        weight_decay=0.01,
        warmup_ratio=warmup_ratio,
        lr_scheduler_type="cosine",
        logging_steps=10,
        save_strategy="epoch",
        fp16=not torch.cuda.is_bf16_supported() and torch.cuda.is_available(),
        bf16=torch.cuda.is_bf16_supported(),
        report_to="none",
    )

    trainer = SFTTrainer(
        model=model,
        train_dataset=dataset,
        peft_config=peft_config,
        dataset_text_field="messages",
        max_seq_length=max_seq_length,
        tokenizer=processor.tokenizer if hasattr(processor, "tokenizer") else processor,
        args=training_args,
    )

    logger.info("Commencing QLoRA training for %d epochs...", epochs)
    start_time = time.time()
    train_result = trainer.train()
    total_time = time.time() - start_time

    logger.info("Training completed in %.2f seconds. Saving adapter to %s", total_time, output_dir)
    trainer.model.save_pretrained(str(output_dir))
    processor.save_pretrained(str(output_dir))

    stats = {
        "status": "success",
        "base_model": base_model,
        "epochs": epochs,
        "final_loss": train_result.training_loss,
        "train_runtime_seconds": total_time,
        "timestamp": time.time(),
    }
    (output_dir / "train_stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")
    return stats


# ---------------------------------------------------------------------------
# Modal Labs Serverless Compute Integration
# ---------------------------------------------------------------------------
try:
    import modal

    app = modal.App("dressapp-eyes-trainer")
    image = (
        modal.Image.debian_slim(python_version="3.11")
        .pip_install_from_requirements(
            str(Path(__file__).parent / "requirements-train.txt")
            if (Path(__file__).parent / "requirements-train.txt").exists()
            else "torch>=2.2.0"
        )
    )

    @app.function(
        image=image,
        gpu="A10G",
        timeout=3600,
        secrets=[
            modal.Secret.from_name("huggingface-secret", required=False),
        ],
    )
    def modal_train_entrypoint(
        dataset_content: str,
        base_model: str,
        epochs: int,
        batch_size: int,
        learning_rate: float,
    ) -> dict[str, Any]:
        """Runs inside Modal cloud GPU container."""
        work_dir = Path("/tmp/eyes_train")
        work_dir.mkdir(parents=True, exist_ok=True)
        dataset_file = work_dir / "train.jsonl"
        dataset_file.write_text(dataset_content, encoding="utf-8")

        adapter_out = work_dir / "adapter"
        return train_lora_native(
            dataset_path=dataset_file,
            base_model=base_model,
            output_dir=adapter_out,
            epochs=epochs,
            batch_size=batch_size,
            learning_rate=learning_rate,
        )

except Exception:
    # Modal not installed or not in Modal environment
    app = None


def main() -> None:
    parser = argparse.ArgumentParser(description="DressApp Eyes LoRA SFT Trainer")
    parser.add_argument("--dataset", type=Path, default=Path("build/dataset/train.jsonl"))
    parser.add_argument("--base-model", type=str, default="google/gemma-4-e4b-it")
    parser.add_argument("--output-dir", type=Path, default=Path("output/adapter"))
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=2)
    parser.add_argument("--lr", type=float, default=2e-4)
    parser.add_argument("--backend", choices=["local", "modal", "cpu_dry_run"], default="local")
    parser.add_argument("--dry-run", action="store_true", help="Smoke test without GPU compute")
    args = parser.parse_args()

    if args.dry_run or args.backend == "cpu_dry_run":
        res = create_dry_run_adapter(args.output_dir, args.base_model)
        print(f"Dry run complete: {res}")
        return

    if args.backend == "modal":
        if app is None:
            logger.error("Modal SDK is not available. Install modal or use --backend local")
            sys.exit(1)
        logger.info("Dispatching training job to Modal Labs serverless A10G GPU...")
        dataset_text = args.dataset.read_text(encoding="utf-8")
        with app.run():
            res = modal_train_entrypoint.remote(
                dataset_content=dataset_text,
                base_model=args.base_model,
                epochs=args.epochs,
                batch_size=args.batch_size,
                learning_rate=args.lr,
            )
        print(f"Modal training complete: {res}")
        return

    # Default: local training
    res = train_lora_native(
        dataset_path=args.dataset,
        base_model=args.base_model,
        output_dir=args.output_dir,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr,
        dry_run=args.dry_run,
    )
    print(f"Training finished: {res}")


if __name__ == "__main__":
    main()
