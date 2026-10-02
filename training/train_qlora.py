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

# Ensure torch and torch.nn are imported early so downstream integrations (transformers.integrations.accelerate)
# resolve nn.Module type annotations cleanly.
try:
    import torch
    import torch.nn as nn
except ImportError:
    pass

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

    # Patch tokenizer to prevent AttributeError if extra_special_tokens is a list
    try:
        import transformers.tokenization_utils_base
        orig_set_tokens = getattr(
            transformers.tokenization_utils_base.PreTrainedTokenizerBase,
            "_set_model_specific_special_tokens",
            None,
        )
        if orig_set_tokens:
            def _safe_set_model_specific_special_tokens(self, special_tokens=None):
                if isinstance(special_tokens, list):
                    special_tokens = {tok: tok for tok in special_tokens}
                return orig_set_tokens(self, special_tokens=special_tokens)
            transformers.tokenization_utils_base.PreTrainedTokenizerBase._set_model_specific_special_tokens = _safe_set_model_specific_special_tokens
    except Exception as patch_err:
        logger.debug("Tokenizer patch skipped: %s", patch_err)

    raw_token = args.hf_token or os.environ.get("HF_TOKEN") or ""
    token = raw_token.strip() if isinstance(raw_token, str) and raw_token.strip() else None
    if token is None and "HF_TOKEN" in os.environ:
        del os.environ["HF_TOKEN"]

    logger.info("Loading Tokenizer / Processor for %s...", args.base_model)
    tokenizer = None
    try:
        from transformers import AutoProcessor
        proc = AutoProcessor.from_pretrained(args.base_model, trust_remote_code=True, token=token)
        tokenizer = getattr(proc, "tokenizer", proc)
        logger.info("AutoProcessor loaded successfully.")
    except Exception as proc_err:
        logger.warning("AutoProcessor failed (%s). Falling back to AutoTokenizer...", proc_err)
        try:
            tokenizer = AutoTokenizer.from_pretrained(args.base_model, trust_remote_code=True, token=token)
        except Exception as tok_err:
            logger.warning("Fast tokenizer failed (%s). Retrying with use_fast=False...", tok_err)
            tokenizer = AutoTokenizer.from_pretrained(args.base_model, trust_remote_code=True, token=token, use_fast=False)

    tok_obj = getattr(tokenizer, "tokenizer", tokenizer)
    if hasattr(tok_obj, "pad_token") and tok_obj.pad_token is None:
        tok_obj.pad_token = getattr(tok_obj, "eos_token", "<pad>")
    if hasattr(tokenizer, "pad_token") and tokenizer.pad_token is None:
        tokenizer.pad_token = getattr(tokenizer, "eos_token", "<pad>")

    logger.info("Loading Base Model in 4-bit NF4: %s...", args.base_model)
    import transformers

    # Dynamic architecture registration safety net for gemma4
    try:
        from transformers.models.auto.configuration_auto import CONFIG_MAPPING
        if "gemma4" not in CONFIG_MAPPING:
            for cfg_name in ["Gemma4Config", "Gemma3Config", "Gemma2Config", "GemmaConfig"]:
                cfg_cls = getattr(transformers, cfg_name, None)
                if cfg_cls is not None:
                    try:
                        CONFIG_MAPPING.register("gemma4", cfg_cls)
                    except AttributeError:
                        CONFIG_MAPPING["gemma4"] = cfg_cls
                    logger.info("Registered 'gemma4' configuration mapping to %s", cfg_name)
                    break
    except Exception as map_err:
        logger.debug("Architecture mapping fallback skipped: %s", map_err)

    model = None
    model_classes = [
        "AutoModelForMultimodalLM",
        "AutoModelForConditionalGeneration",
        "AutoModelForImageTextToText",
        "AutoModelForCausalLM",
        "AutoModelForVision2Seq",
    ]
    for cand in model_classes:
        cls = getattr(transformers, cand, None)
        if cls is None:
            continue
        try:
            logger.info("Attempting to load base model with %s...", cand)
            model = cls.from_pretrained(
                args.base_model,
                quantization_config=bnb_config,
                device_map="auto",
                trust_remote_code=True,
                token=token,
            )
            logger.info("Successfully loaded base model %s using %s", args.base_model, cand)
            break
        except Exception as err:
            logger.warning("Failed loading base model with %s: %s. Trying next candidate...", cand, err)

    if model is None:
        raise RuntimeError(f"Failed to load base model '{args.base_model}' with any supported class.")

    model = prepare_model_for_kbit_training(model)

    # Freeze encoder parameters if multimodal
    for tower_attr in ["vision_tower", "vision_model", "visual", "audio_tower", "audio_model"]:
        target = None
        if hasattr(model, tower_attr):
            target = getattr(model, tower_attr)
        elif hasattr(model, "model") and hasattr(model.model, tower_attr):
            target = getattr(model.model, tower_attr)
        if target is not None:
            for param in target.parameters():
                param.requires_grad = False
    # PEFT patch for Gemma4ClippableLinear compatibility
    try:
        import peft.tuners.lora.model
        orig_create_new_module = peft.tuners.lora.model.LoraModel._create_new_module

        @staticmethod
        def _safe_create_new_module(*args, **kwargs):
            target = kwargs.get("target")
            if target is None and len(args) >= 3:
                target = args[2]
            if target is not None and target.__class__.__name__ == "Gemma4ClippableLinear" and hasattr(target, "linear"):
                if "target" in kwargs:
                    kwargs_copy = dict(kwargs)
                    kwargs_copy["target"] = target.linear
                    new_inner = orig_create_new_module(*args, **kwargs_copy)
                else:
                    new_args = list(args)
                    new_args[2] = target.linear
                    new_inner = orig_create_new_module(*new_args, **kwargs)
                target.linear = new_inner
                return target
            return orig_create_new_module(*args, **kwargs)

        peft.tuners.lora.model.LoraModel._create_new_module = _safe_create_new_module
        logger.info("Successfully patched PEFT for Gemma4ClippableLinear support.")
    except Exception as patch_e:
        logger.debug("PEFT Gemma4ClippableLinear patch skipped: %s", patch_e)

    # Target only linear projection layers in the language model, excluding vision/audio towers
    target_modules = []
    for name, module in model.named_modules():
        if any(tower in name for tower in ["vision_tower", "audio_tower", "embed_vision", "embed_audio"]):
            continue
        leaf = name.split(".")[-1]
        if leaf in ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]:
            target_modules.append(name)

    if not target_modules:
        target_modules = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]

    logger.info("Configured %d target linear modules for LoRA.", len(target_modules))

    import inspect
    lora_params = inspect.signature(LoraConfig.__init__).parameters
    lora_kwargs = {
        "r": args.lora_r,
        "lora_alpha": args.lora_alpha,
        "target_modules": target_modules,
        "lora_dropout": args.lora_dropout,
        "bias": "none",
        "task_type": "CAUSAL_LM",
    }
    if "exclude_modules" in lora_params:
        lora_kwargs["exclude_modules"] = r".*(vision_tower|audio_tower|embed_vision|embed_audio).*"

    lora_config = LoraConfig(**lora_kwargs)
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
            apply_fn = getattr(tokenizer, "apply_chat_template", None) or getattr(tok_obj, "apply_chat_template", None)
            if apply_fn:
                prompt_str = apply_fn(user_msgs, tokenize=False, add_generation_prompt=True)
                full_str = apply_fn(messages, tokenize=False, add_generation_prompt=False)
            else:
                prompt_str = "\n".join([f"<|{m.get('role')}|>\n{m.get('content')}" for m in user_msgs]) + "\n<|assistant|>\n"
                full_str = "\n".join([f"<|{m.get('role')}|>\n{m.get('content')}" for m in messages])

            prompt_ids = tok_obj.encode(prompt_str, add_special_tokens=False)
            full_ids = tok_obj.encode(full_str, add_special_tokens=False)

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

    import inspect
    try:
        from trl import SFTConfig
        args_cls = SFTConfig
    except Exception:
        args_cls = TrainingArguments

    sig_params = inspect.signature(args_cls.__init__).parameters
    raw_args = {
        "output_dir": str(output_dir / "checkpoints"),
        "num_train_epochs": args.epochs,
        "per_device_train_batch_size": args.batch_size,
        "gradient_accumulation_steps": 4,
        "warmup_ratio": 0.03,
        "learning_rate": args.learning_rate,
        "fp16": False,
        "bf16": torch.cuda.is_bf16_supported() if torch.cuda.is_available() else False,
        "logging_steps": 10,
        "save_strategy": "epoch",
        "optim": "paged_adamw_8bit" if torch.cuda.is_available() else "adamw_torch",
        "report_to": "none",
    }
    if "eval_strategy" in sig_params:
        raw_args["eval_strategy"] = "no"
    elif "evaluation_strategy" in sig_params:
        raw_args["evaluation_strategy"] = "no"

    if "max_seq_length" in sig_params:
        raw_args["max_seq_length"] = args.max_seq_length

    filtered_args = {k: v for k, v in raw_args.items() if k in sig_params}
    training_args = args_cls(**filtered_args)

    from transformers import DataCollatorForSeq2Seq
    collator = DataCollatorForSeq2Seq(tokenizer=tok_obj, pad_to_multiple_of=8, return_tensors="pt")

    sft_sig = inspect.signature(SFTTrainer.__init__).parameters
    sft_kwargs = {
        "model": model,
        "train_dataset": hf_dataset,
        "data_collator": collator,
        "args": training_args,
    }
    if "processing_class" in sft_sig:
        sft_kwargs["processing_class"] = tokenizer
    elif "tokenizer" in sft_sig:
        sft_kwargs["tokenizer"] = tokenizer

    if "max_seq_length" in sft_sig and "max_seq_length" not in sig_params:
        sft_kwargs["max_seq_length"] = args.max_seq_length

    trainer = SFTTrainer(**sft_kwargs)

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
        import traceback
        sys.stderr.write(f"\n[FATAL ERROR in train_qlora]: {e}\n")
        traceback.print_exc(file=sys.stderr)
        sys.stderr.flush()
        logger.exception("Fine-tuning failed: %s", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
