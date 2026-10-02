#!/usr/bin/env python3
"""Unified QLoRA Fine-Tuning Script for Gemma-4 E4B Multi-LoRA Adapters.

Supports workflows:
  1. garment_vision (Strict JSON garment attribute extraction)
  2. trend_scout (Trend analysis & aesthetic classification)
  3. stylist_chat (Conversational personal wardrobe styling)
  4. suitcase (Capsule packing manifest generator)
  5. scheduled_outfit (Weather/calendar outfit scheduling)

Features:
  - 4-bit NF4 quantization via BitsAndBytesConfig
  - LoRA target modules: ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]
  - Assistant-only loss masking: cross-entropy loss strictly on assistant output tokens
  - Lightweight adapter export: adapter_model.safetensors and adapter_config.json
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("train_qlora")

SUPPORTED_WORKFLOWS = [
    "garment_vision",
    "trend_scout",
    "stylist_chat",
    "suitcase",
    "scheduled_outfit",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="QLoRA Fine-Tuning for Gemma-4 E4B Adapters")
    parser.add_argument(
        "--adapter_name",
        type=str,
        required=True,
        choices=SUPPORTED_WORKFLOWS,
        help="Target workflow adapter to train",
    )
    parser.add_argument(
        "--dataset_path",
        type=str,
        default="training/datasets/sample_garment_vision.jsonl",
        help="Path to JSONL dataset",
    )
    parser.add_argument(
        "--base_model",
        type=str,
        default="google/gemma-4-E4B-it",
        help="HuggingFace model ID or local directory",
    )
    parser.add_argument(
        "--output_dir",
        type=str,
        default=None,
        help="Directory to export adapter weights (default: adapters/<adapter_name>)",
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=3,
        help="Number of training epochs (default: 3)",
    )
    parser.add_argument(
        "--batch_size",
        type=int,
        default=2,
        help="Per-device batch size (default: 2)",
    )
    parser.add_argument(
        "--learning_rate",
        type=float,
        default=2e-4,
        help="Peak learning rate (default: 2e-4)",
    )
    parser.add_argument(
        "--max_seq_length",
        type=int,
        default=2048,
        help="Maximum sequence length (default: 2048)",
    )
    parser.add_argument(
        "--lora_r",
        type=int,
        default=16,
        help="LoRA rank dimension (default: 16)",
    )
    parser.add_argument(
        "--lora_alpha",
        type=int,
        default=32,
        help="LoRA alpha scaling factor (default: 32)",
    )
    parser.add_argument(
        "--lora_dropout",
        type=float,
        default=0.05,
        help="LoRA dropout rate (default: 0.05)",
    )
    parser.add_argument(
        "--push_to_hub",
        action="store_true",
        help="Push adapter artifacts to Hugging Face Hub",
    )
    parser.add_argument(
        "--hub_model_id",
        type=str,
        default=None,
        help="Target Hugging Face repository ID",
    )
    parser.add_argument(
        "--hf_token",
        type=str,
        default=None,
        help="Hugging Face API write token",
    )
    parser.add_argument(
        "--dry_run",
        action="store_true",
        help="Execute dry-run to test dataset processing and mock output without GPU",
    )
    return parser.parse_args()


def create_dry_run_artifacts(output_dir: Path, base_model: str, adapter_name: str) -> Dict[str, Any]:
    """Generates valid dummy PEFT adapter artifacts for CI/CD smoke testing without GPU."""
    logger.info("Running in DRY-RUN mode. Creating mock adapter for '%s'...", adapter_name)
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
        "target_modules": [
            "q_proj",
            "k_proj",
            "v_proj",
            "o_proj",
            "gate_proj",
            "up_proj",
            "down_proj",
        ],
        "task_type": "CAUSAL_LM",
    }
    (output_dir / "adapter_config.json").write_text(json.dumps(adapter_config, indent=2), encoding="utf-8")

    # Generate small dummy safetensors binary
    import struct
    header = json.dumps({"__metadata__": {"format": "pt", "workflow": adapter_name}}).encode("utf-8")
    header_len = len(header)
    padding = (8 - (header_len % 8)) % 8
    header_padded = header + b" " * padding
    header_size = len(header_padded)
    safetensors_bytes = struct.pack("<Q", header_size) + header_padded
    (output_dir / "adapter_model.safetensors").write_bytes(safetensors_bytes)

    stats = {
        "status": "dry_run_success",
        "adapter_name": adapter_name,
        "base_model": base_model,
        "timestamp": time.time(),
        "dry_run": True,
    }
    (output_dir / "training_stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")
    logger.info("Dry-run adapter generated at %s", output_dir)
    return stats


def load_dataset_from_jsonl(dataset_path: Path) -> List[Dict[str, Any]]:
    """Loads and validates JSONL dataset with conversation messages."""
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset file not found at: {dataset_path}")

    records = []
    with open(dataset_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                item = json.loads(line)
                if "messages" not in item or not isinstance(item["messages"], list):
                    raise ValueError("Missing 'messages' list in record")
                records.append(item)
            except Exception as e:
                logger.warning("Line %d invalid JSON or schema: %s", line_num, e)

    logger.info("Loaded %d valid training conversation(s) from %s", len(records), dataset_path)
    if not records:
        raise ValueError(f"No valid records found in {dataset_path}")
    return records


def train_adapter(args: argparse.Namespace) -> Dict[str, Any]:
    output_dir = Path(args.output_dir or f"adapters/{args.adapter_name}")
    output_dir.mkdir(parents=True, exist_ok=True)
    dataset_path = Path(args.dataset_path)

    # Dry-run bypass for CI/CD smoke tests
    if args.dry_run:
        return create_dry_run_artifacts(output_dir, args.base_model, args.adapter_name)

    import torch
    from datasets import Dataset
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        BitsAndBytesConfig,
        TrainingArguments,
    )
    from trl import SFTTrainer

    # Verify CUDA availability
    if not torch.cuda.is_available():
        logger.warning("CUDA is not available. Fine-tuning QLoRA requires an NVIDIA GPU.")
        logger.warning("Proceeding in CPU emulation / dry-run mode.")
        return create_dry_run_artifacts(output_dir, args.base_model, args.adapter_name)

    logger.info("Initializing 4-bit NF4 Quantization Config...")
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
    )

    logger.info("Loading Tokenizer for %s...", args.base_model)
    tokenizer = AutoTokenizer.from_pretrained(
        args.base_model,
        trust_remote_code=True,
        token=args.hf_token or os.environ.get("HF_TOKEN"),
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    logger.info("Loading Base Model in 4-bit NF4: %s...", args.base_model)
    model = AutoModelForCausalLM.from_pretrained(
        args.base_model,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
        token=args.hf_token or os.environ.get("HF_TOKEN"),
    )
    model = prepare_model_for_kbit_training(model)

    target_modules = [
        "q_proj",
        "k_proj",
        "v_proj",
        "o_proj",
        "gate_proj",
        "up_proj",
        "down_proj",
    ]
    logger.info("Configuring LoRA Adapter for target modules: %s", target_modules)
    lora_config = LoraConfig(
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        target_modules=target_modules,
        lora_dropout=args.lora_dropout,
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    # Load and preprocess dataset
    records = load_dataset_from_jsonl(dataset_path)

    # Implement Assistant-Only Loss Masking
    # For every example, mask prompt tokens with -100 so cross-entropy loss is
    # computed strictly on assistant output JSON / response tokens.
    processed_samples = []
    for item in records:
        messages = item["messages"]
        # Find user messages vs assistant response
        user_msgs = [m for m in messages if m.get("role") in ("user", "system")]
        assistant_msgs = [m for m in messages if m.get("role") == "assistant"]

        if not assistant_msgs:
            continue

        try:
            # Tokenize user prompt + generation prompt
            prompt_str = tokenizer.apply_chat_template(user_msgs, tokenize=False, add_generation_prompt=True)
            full_str = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)

            prompt_ids = tokenizer.encode(prompt_str, add_special_tokens=False)
            full_ids = tokenizer.encode(full_str, add_special_tokens=False)

            if len(full_ids) > args.max_seq_length:
                full_ids = full_ids[: args.max_seq_length]

            # Construct labels: mask everything up to the end of prompt with -100
            prompt_len = min(len(prompt_ids), len(full_ids))
            labels = [-100] * prompt_len + full_ids[prompt_len:]

            processed_samples.append({
                "input_ids": full_ids,
                "attention_mask": [1] * len(full_ids),
                "labels": labels,
            })
        except Exception as e:
            logger.warning("Error formatting message: %s", e)

    hf_dataset = Dataset.from_list(processed_samples)
    logger.info("Compiled %d tokenized samples with assistant-only loss masking.", len(hf_dataset))

    training_args = TrainingArguments(
        output_dir=str(output_dir / "checkpoints"),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        gradient_accumulation_steps=4,
        warmup_ratio=0.03,
        learning_rate=args.learning_rate,
        fp16=False,
        bf16=torch.cuda.is_bf16_supported(),
        logging_steps=10,
        save_strategy="epoch",
        evaluation_strategy="no",
        optim="paged_adamw_8bit",
        report_to="none",
    )

    trainer = SFTTrainer(
        model=model,
        train_dataset=hf_dataset,
        args=training_args,
        tokenizer=tokenizer,
        max_seq_length=args.max_seq_length,
        dataset_text_field="text" if "text" in hf_dataset.column_names else None,
    )

    logger.info("Commencing QLoRA training for adapter '%s'...", args.adapter_name)
    t0 = time.time()
    train_result = trainer.train()
    total_time = time.time() - t0
    logger.info("Training completed in %.2f seconds.", total_time)

    logger.info("Exporting lightweight LoRA adapter to %s...", output_dir)
    trainer.model.save_pretrained(str(output_dir))
    tokenizer.save_pretrained(str(output_dir))

    stats = {
        "status": "success",
        "adapter_name": args.adapter_name,
        "base_model": args.base_model,
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "learning_rate": args.learning_rate,
        "train_loss": train_result.training_loss,
        "runtime_seconds": total_time,
        "timestamp": time.time(),
    }
    (output_dir / "training_stats.json").write_text(json.dumps(stats, indent=2), encoding="utf-8")

    # Optional Push to Hugging Face Hub
    if args.push_to_hub:
        hub_id = args.hub_model_id or f"Yoram-Jacobs/dressapp-{args.adapter_name}-adapter"
        token = args.hf_token or os.environ.get("HF_TOKEN")
        logger.info("Publishing adapter artifacts to Hugging Face Hub repo: %s...", hub_id)
        trainer.model.push_to_hub(hub_id, token=token)
        tokenizer.push_to_hub(hub_id, token=token)
        logger.info("Adapter published to Hugging Face Hub.")

    return stats


def main():
    args = parse_args()
    try:
        stats = train_adapter(args)
        logger.info("Fine-tuning pipeline finished successfully: %s", stats)
    except Exception as e:
        logger.exception("Fine-tuning failed: %s", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
