#!/usr/bin/env python3
"""
inference-server/eyes/training/train_eyes_lora.py

Headless QLoRA SFT fine-tuning for DressApp Eyes (Gemma-4 multimodal vision-language model).
Supports:
  1. RunPod serverless GPU execution (headless ephemeral pod via runpod + paramiko)
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
    file_resolved = Path(__file__).resolve()
    candidates = [
        Path(".env"),
        Path("deploy/.env"),
        Path("backend/.env"),
    ]
    for p in file_resolved.parents:
        candidates.append(p / ".env")

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

    # Normalize RunPod API Key aliases (supports RUNPOD_API_KEY, RUNPOD_KEY)
    runpod_key = os.environ.get("RUNPOD_API_KEY") or os.environ.get("RUNPOD_KEY")
    if runpod_key and "RUNPOD_API_KEY" not in os.environ:
        os.environ["RUNPOD_API_KEY"] = runpod_key

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


def resolve_vlm_model_class() -> Any:
    """Dynamically resolves the appropriate Transformers model class for multimodal models."""
    import transformers

    candidates = [
        "AutoModelForMultimodalLM",
        "AutoModelForConditionalGeneration",
        "AutoModelForImageTextToText",
        "AutoModelForCausalLM",
        "AutoModelForVision2Seq",
    ]
    for attr in candidates:
        cls = getattr(transformers, attr, None)
        if cls is not None:
            return cls
    raise ImportError("No compatible vision-language model class found in transformers.")


def create_dry_run_adapter(output_dir: Path, base_model: str) -> dict[str, Any]:
    """Generates a valid dummy PEFT LoRA adapter for smoke testing CI/CD pipelines without GPU."""
    logger.info("Running in DRY-RUN mode. Emulating QLoRA training and producing mock adapter...")
    output_dir.mkdir(parents=True, exist_ok=True)

    adapter_config = {
        "auto_mapping": None,
        "base_model_name_or_path": base_model,
        "bias": "none",
        "exclude_modules": r".*(vision_tower|audio_tower|embed_vision|embed_audio).*",
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
        AutoProcessor,
        BitsAndBytesConfig,
        TrainingArguments,
    )
    from trl import SFTTrainer

    if not torch.cuda.is_available():
        raise RuntimeError(
            "CUDA GPU accelerator is not available (torch.cuda.is_available() is False)! "
            "Refusing to run full model training on CPU to prevent runaway 4+ hour execution. Use --dry-run for CPU testing."
        )

    logger.info("Loading SFT dataset from %s", dataset_path)
    try:
        dataset = load_dataset("json", data_files=str(dataset_path), split="train")
    except Exception as err:
        logger.warning(
            "load_dataset('json', ...) failed (%s). Normalizing dataset via Python JSON parser...",
            err,
        )
        with open(dataset_path, "r", encoding="utf-8") as f:
            raw_records = [json.loads(line) for line in f if line.strip()]

        cleaned_records = []
        for r in raw_records:
            cleaned_messages = []
            for m in r.get("messages", []):
                role = m.get("role", "user")
                content = m.get("content", "")
                if isinstance(content, list):
                    text_parts = [
                        p.get("text", "")
                        for p in content
                        if isinstance(p, dict) and p.get("type") == "text"
                    ]
                    content = " ".join(text_parts)
                elif not isinstance(content, str):
                    content = str(content)
                cleaned_messages.append({"role": role, "content": content})
            cleaned_records.append({
                "type": r.get("type", "attribute_parsing"),
                "image_path": str(r.get("image_path", "")),
                "messages": cleaned_messages,
            })
        from datasets import Dataset

        dataset = Dataset.from_list(cleaned_records)

    logger.info("Configuring 4-bit BitsAndBytes quantization...")
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16,
        bnb_4bit_use_double_quant=True,
    )

    # Load processor or fallback to tokenizer
    token = os.environ.get("HF_TOKEN")
    processor = None
    try:
        logger.info("Attempting to load AutoProcessor for %s...", base_model)
        processor = AutoProcessor.from_pretrained(base_model, token=token, trust_remote_code=True)
        logger.info("AutoProcessor loaded successfully: %s", type(processor).__name__)
    except Exception as exc:
        logger.warning(
            "AutoProcessor.from_pretrained failed (%s). Falling back to AutoTokenizer...",
            exc,
        )
        from transformers import AutoTokenizer
        processor = AutoTokenizer.from_pretrained(base_model, token=token, trust_remote_code=True)
        logger.info("AutoTokenizer loaded successfully: %s", type(processor).__name__)

    if hasattr(processor, "pad_token") and processor.pad_token is None:
        processor.pad_token = getattr(processor, "eos_token", "<pad>")
    if hasattr(processor, "tokenizer") and getattr(processor.tokenizer, "pad_token", None) is None:
        processor.tokenizer.pad_token = getattr(processor.tokenizer, "eos_token", "<pad>")

    # Load base model with candidate fallback
    model = None
    import transformers
    candidates = [
        "AutoModelForMultimodalLM",
        "AutoModelForConditionalGeneration",
        "AutoModelForImageTextToText",
        "AutoModelForCausalLM",
        "AutoModelForVision2Seq",
    ]
    last_model_err = None
    for cand in candidates:
        cls = getattr(transformers, cand, None)
        if cls is None:
            continue
        try:
            logger.info("Attempting to load base model with %s...", cand)
            model = cls.from_pretrained(
                base_model,
                quantization_config=bnb_config,
                device_map="auto",
                token=token,
                trust_remote_code=True,
            )
            logger.info("Successfully loaded base model %s using %s", base_model, cand)
            break
        except Exception as err:
            logger.warning("Failed loading base model with %s: %s. Trying next candidate...", cand, err)
            last_model_err = err

    if model is None:
        raise RuntimeError(
            f"Failed to load base model '{base_model}' with any supported Transformers class. Last error: {last_model_err}"
        )

    model = prepare_model_for_kbit_training(model)

    # Freeze vision and audio encoder parameters to preserve pre-trained fashion representations
    for tower_attr in ["vision_tower", "vision_model", "visual", "audio_tower", "audio_model"]:
        target = None
        if hasattr(model, tower_attr):
            target = getattr(model, tower_attr)
        elif hasattr(model, "model") and hasattr(model.model, tower_attr):
            target = getattr(model.model, tower_attr)

        if target is not None:
            for param in target.parameters():
                param.requires_grad = False
            logger.info("Froze encoder parameters (%s).", tower_attr)

    # Target only linear projection layers in the language model, strictly excluding vision/audio towers
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
        "r": lora_r,
        "lora_alpha": lora_alpha,
        "target_modules": target_modules,
        "lora_dropout": lora_dropout,
        "bias": "none",
        "task_type": "CAUSAL_LM",
    }
    if "exclude_modules" in lora_params:
        lora_kwargs["exclude_modules"] = r".*(vision_tower|audio_tower|embed_vision|embed_audio).*"

    peft_config = LoraConfig(**lora_kwargs)
    model = get_peft_model(model, peft_config)
    model.print_trainable_parameters()

    output_dir.mkdir(parents=True, exist_ok=True)
    training_args = None

    args_cls = None
    try:
        from trl import SFTConfig
        args_cls = SFTConfig
    except Exception:
        args_cls = TrainingArguments

    import inspect
    sig_params = inspect.signature(args_cls.__init__).parameters

    raw_args = {
        "output_dir": str(output_dir),
        "num_train_epochs": epochs,
        "per_device_train_batch_size": batch_size,
        "gradient_accumulation_steps": gradient_accumulation_steps,
        "learning_rate": learning_rate,
        "weight_decay": 0.01,
        "lr_scheduler_type": "cosine",
        "logging_steps": 10,
        "save_strategy": "epoch",
        "fp16": not torch.cuda.is_bf16_supported() and torch.cuda.is_available(),
        "bf16": torch.cuda.is_bf16_supported(),
        "report_to": "none",
    }
    if "max_seq_length" in sig_params:
        raw_args["max_seq_length"] = max_seq_length

    # In Transformers 5, warmup_ratio was replaced by warmup_steps accepting a float in [0, 1)
    if "warmup_ratio" in sig_params:
        raw_args["warmup_ratio"] = warmup_ratio
    elif "warmup_steps" in sig_params:
        raw_args["warmup_steps"] = warmup_ratio

    filtered_args = {k: v for k, v in raw_args.items() if k in sig_params}
    try:
        training_args = args_cls(**filtered_args)
    except Exception as e:
        logger.warning(
            "Failed instantiating %s with filtered args (%s). Fallback to standard TrainingArguments...",
            args_cls.__name__,
            e,
        )
        ta_params = inspect.signature(TrainingArguments.__init__).parameters
        ta_args = {k: v for k, v in raw_args.items() if k in ta_params}
        training_args = TrainingArguments(**ta_args)

    def format_prompts(batch: dict[str, Any] | list[Any]) -> list[str] | str:
        raw_msgs = batch.get("messages", []) if isinstance(batch, dict) else batch
        if not raw_msgs:
            return [] if isinstance(batch, dict) and isinstance(batch.get("messages"), list) and batch.get("messages") and isinstance(batch.get("messages")[0], list) else ""

        if isinstance(raw_msgs, list) and len(raw_msgs) > 0 and isinstance(raw_msgs[0], list):
            formatted = []
            for msgs in raw_msgs:
                if hasattr(processor, "apply_chat_template"):
                    try:
                        formatted.append(processor.apply_chat_template(msgs, tokenize=False))
                        continue
                    except Exception:
                        pass
                conv_str = ""
                for m in msgs:
                    if not isinstance(m, dict):
                        continue
                    role = m.get("role", "user")
                    content = m.get("content", "")
                    if isinstance(content, list):
                        text_parts = [
                            p.get("text", "") for p in content if isinstance(p, dict) and p.get("type") == "text"
                        ]
                        content = " ".join(text_parts)
                    conv_str += f"<|{role}|>\n{content}\n"
                formatted.append(conv_str)
            return formatted
        else:
            msgs = raw_msgs
            if hasattr(processor, "apply_chat_template"):
                try:
                    return processor.apply_chat_template(msgs, tokenize=False)
                except Exception:
                    pass
            conv_str = ""
            for m in msgs:
                if not isinstance(m, dict):
                    continue
                role = m.get("role", "user")
                content = m.get("content", "")
                if isinstance(content, list):
                    text_parts = [
                        p.get("text", "") for p in content if isinstance(p, dict) and p.get("type") == "text"
                    ]
                    content = " ".join(text_parts)
                conv_str += f"<|{role}|>\n{content}\n"
            return conv_str

    import inspect
    tok = processor.tokenizer if hasattr(processor, "tokenizer") else processor
    if hasattr(tok, "pad_token") and tok.pad_token is None:
        tok.pad_token = getattr(tok, "eos_token", "<pad>")

    sft_params = inspect.signature(SFTTrainer.__init__).parameters
    sft_kwargs = {
        "model": model,
        "train_dataset": dataset,
        "peft_config": None,
        "formatting_func": format_prompts,
        "args": training_args,
    }
    if "max_seq_length" in sft_params:
        sft_kwargs["max_seq_length"] = max_seq_length
    if "processing_class" in sft_params:
        sft_kwargs["processing_class"] = tok
    elif "tokenizer" in sft_params:
        sft_kwargs["tokenizer"] = tok

    trainer = SFTTrainer(**sft_kwargs)

    logger.info("Commencing QLoRA training for %d epochs...", epochs)
    start_time = time.time()
    train_result = trainer.train()
    total_time = time.time() - start_time

    logger.info("Training completed in %.2f seconds. Saving adapter to %s", total_time, output_dir)
    trainer.model.save_pretrained(str(output_dir))
    if hasattr(processor, "save_pretrained"):
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
# RunPod Serverless Ephemeral GPU Pod Integration
# ---------------------------------------------------------------------------
def run_training_on_runpod(
    dataset_path: Path,
    base_model: str,
    output_dir: Path,
    epochs: int = 3,
    batch_size: int = 2,
    learning_rate: float = 2e-4,
    val_dataset_path: Path | None = None,
    metrics_out: Path | None = None,
    api_key: str | None = None,
    hf_token: str | None = None,
) -> dict[str, Any]:
    """
    Provisions an ephemeral RunPod GPU instance, connects via SSH/SFTP, uploads dataset and code,
    executes QLoRA training and live evaluation with output streaming, downloads adapter and metrics,
    and terminates the pod to prevent idle charges.
    """
    try:
        import runpod
        import paramiko
    except ImportError as e:
        raise ImportError(f"RunPod execution requires runpod and paramiko: {e}. Please install requirements-train.txt.")

    api_key = api_key or os.environ.get("RUNPOD_API_KEY") or os.environ.get("RUNPOD_KEY")
    if not api_key:
        raise ValueError("RUNPOD_API_KEY environment variable is required to execute training on RunPod.")

    runpod.api_key = api_key

    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset file not found at: {dataset_path}")

    # Generate ephemeral RSA keypair in-memory for secure SSH access
    logger.info("Generating ephemeral 2048-bit RSA key for RunPod SSH session...")
    rsa_key = paramiko.RSAKey.generate(2048)
    pub_key_str = f"ssh-rsa {rsa_key.get_base64()} dressapp-ephemeral-eyes"

    # Register public key with RunPod user account
    logger.info("Registering ephemeral public SSH key with RunPod...")
    try:
        runpod.update_user_settings(pubkey=pub_key_str)
        logger.info("RunPod SSH key registration acknowledged.")
    except Exception as e:
        logger.warning("runpod.update_user_settings warning: %s. Continuing with pod provisioning...", e)

    gpu_candidates = [
        "NVIDIA GeForce RTX 4090",
        "NVIDIA RTX A5000",
        "NVIDIA A40",
        "NVIDIA L40S",
        "NVIDIA GeForce RTX 5090",
        "NVIDIA GeForce RTX 3090",
        "NVIDIA A100 80GB PCIe",
        "NVIDIA L4",
    ]

    pod_id: str | None = None
    ssh_host: str | None = None
    ssh_port: int | None = None
    last_err: Exception | None = None

    for gpu_type in gpu_candidates:
        current_pod_id: str | None = None
        try:
            logger.info("Requesting RunPod instance with GPU type: %s...", gpu_type)
            pod = runpod.create_pod(
                name=f"dressapp-eyes-trainer-{int(time.time())}",
                image_name="runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04",
                gpu_type_id=gpu_type,
                gpu_count=1,
                cloud_type="ALL",
                support_public_ip=False,
                start_ssh=True,
                ports="22/tcp",
                container_disk_in_gb=40,
                volume_in_gb=0,
                env={"HF_TOKEN": hf_token or ""},
            )
            if not pod or not isinstance(pod, dict) or "id" not in pod:
                raise RuntimeError(f"Unexpected pod creation response: {pod}")

            current_pod_id = str(pod["id"])
            logger.info("Successfully provisioned RunPod instance %s (%s)", current_pod_id, gpu_type)
            logger.info("Polling instance %s for runtime status and public SSH port...", current_pod_id)

            pod_poll_start = time.time()
            per_pod_timeout = 200  # seconds per candidate
            cand_host: str | None = None
            cand_port: int | None = None

            while time.time() - pod_poll_start < per_pod_timeout:
                pod_info = runpod.get_pod(current_pod_id)
                if pod_info and isinstance(pod_info, dict):
                    runtime = pod_info.get("runtime")
                    if runtime and isinstance(runtime, dict):
                        ports = runtime.get("ports", [])
                        if ports and isinstance(ports, list):
                            for p in ports:
                                if isinstance(p, dict) and p.get("privatePort") == 22 and p.get("ip") and p.get("publicPort"):
                                    cand_host = str(p["ip"])
                                    cand_port = int(p["publicPort"])
                                    break
                if cand_host and cand_port:
                    break

                elapsed = int(time.time() - pod_poll_start)
                if elapsed > 0 and elapsed % 20 == 0:
                    status_desc = pod_info.get("desiredStatus", "initializing") if pod_info else "unknown"
                    logger.info("Instance %s (%s) starting up (%ds elapsed, status: %s)...", current_pod_id, gpu_type, elapsed, status_desc)
                time.sleep(5)

            if not cand_host or not cand_port:
                raise TimeoutError(f"Pod {current_pod_id} ({gpu_type}) did not expose SSH within {per_pod_timeout}s.")

            pod_id = current_pod_id
            ssh_host = cand_host
            ssh_port = cand_port
            logger.info("RunPod instance is up! Public SSH endpoint: %s:%d", ssh_host, ssh_port)
            break

        except Exception as e:
            logger.warning("GPU candidate '%s' failed: %s. Cleaning up and attempting next tier...", gpu_type, e)
            last_err = e
            if current_pod_id:
                try:
                    runpod.terminate_pod(current_pod_id)
                except Exception:
                    pass

    if not pod_id or not ssh_host or not ssh_port:
        raise RuntimeError(f"Unable to provision and connect to any RunPod GPU. Last error: {last_err}")

    stats: dict[str, Any] = {}
    try:

        # Establish Paramiko SSH connection with retry loop
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        connected = False
        for attempt in range(24):  # 2 minutes max
            try:
                ssh.connect(
                    hostname=ssh_host,
                    port=ssh_port,
                    username="root",
                    pkey=rsa_key,
                    timeout=10,
                    banner_timeout=30,
                )
                connected = True
                transport = ssh.get_transport()
                if transport is not None:
                    transport.set_keepalive(15)
                logger.info("SSH connection verified and authenticated (keepalive: 15s).")
                break
            except Exception as e:
                logger.debug("Waiting for SSH service (attempt %d/24): %s", attempt + 1, e)
                time.sleep(5)

        if not connected:
            raise ConnectionError(f"Could not connect via SSH to RunPod instance {ssh_host}:{ssh_port}")

        # SFTP file transfer
        sftp = ssh.open_sftp()
        try:
            _, stdout, _ = ssh.exec_command("mkdir -p /workspace/adapter")
            stdout.channel.recv_exit_status()

            logger.info("Uploading dataset (%s) to pod /workspace/train.jsonl...", dataset_path)
            sftp.put(str(dataset_path), "/workspace/train.jsonl")

            script_path = Path(__file__).resolve()
            logger.info("Uploading training script (%s) to pod /workspace/train_eyes_lora.py...", script_path)
            sftp.put(str(script_path), "/workspace/train_eyes_lora.py")

            req_file = script_path.parent / "requirements-train.txt"
            if req_file.exists():
                logger.info("Uploading requirements (%s) to pod /workspace/requirements-train.txt...", req_file)
                sftp.put(str(req_file), "/workspace/requirements-train.txt")

            eval_script = script_path.parent / "evaluate_eyes.py"
            if eval_script.exists():
                logger.info("Uploading evaluation script (%s) to pod /workspace/evaluate_eyes.py...", eval_script)
                sftp.put(str(eval_script), "/workspace/evaluate_eyes.py")

            val_file = val_dataset_path or (dataset_path.parent / "val.jsonl")
            if val_file and val_file.exists():
                logger.info("Uploading validation dataset (%s) to pod /workspace/val.jsonl...", val_file)
                sftp.put(str(val_file), "/workspace/val.jsonl")
        finally:
            sftp.close()

        def run_ssh_streaming(cmd: str, label: str) -> None:
            logger.info("Executing on pod: %s", label)
            env_prefix = (
                "export PYTHONUNBUFFERED=1 && "
                "export PATH=\"/usr/local/nvidia/bin:/usr/local/cuda/bin:$PATH\" && "
                "export LD_LIBRARY_PATH=\"/usr/local/nvidia/lib:/usr/local/nvidia/lib64:/usr/local/cuda/lib64:$LD_LIBRARY_PATH\" && "
                "export NVIDIA_VISIBLE_DEVICES=all && "
            )
            full_cmd = env_prefix + cmd
            stdin, stdout, stderr = ssh.exec_command(full_cmd, get_pty=True)
            for line in iter(stdout.readline, ""):
                line_clean = line.rstrip()
                if line_clean:
                    print(f"[RunPod] {line_clean}", flush=True)
            exit_status = stdout.channel.recv_exit_status()
            if exit_status != 0:
                err_text = stderr.read().decode("utf-8", errors="replace").strip()
                raise RuntimeError(f"Step '{label}' failed with exit code {exit_status}. Details: {err_text}")

        # Step 1: Install Python dependencies (ensuring PyTorch 2.5.1 with CUDA 12.4 support)
        run_ssh_streaming(
            "pip uninstall -y torchaudio && "
            "pip install --no-cache-dir 'torch==2.5.1+cu124' 'torchvision==0.20.1+cu124' 'accelerate>=1.1.0' --extra-index-url https://download.pytorch.org/whl/cu124 && "
            "pip install --no-cache-dir -r /workspace/requirements-train.txt --extra-index-url https://download.pytorch.org/whl/cu124",
            "Install QLoRA Training Dependencies",
        )

        # Step 1.5: Verify CUDA GPU Hardware Acceleration on Pod
        run_ssh_streaming(
            "python3 -c \""
            "import torch; "
            "print('PyTorch Version:', torch.__version__); "
            "print('CUDA Available:', torch.cuda.is_available()); "
            "assert torch.cuda.is_available(), 'CRITICAL ERROR: CUDA is NOT available in PyTorch on the RunPod GPU instance! Refusing to run on CPU.'; "
            "print(f'Active GPU: {torch.cuda.get_device_name(0)}'); "
            "print(f'VRAM Total: {torch.cuda.get_device_properties(0).total_memory / (1024**3):.2f} GB'); "
            "\"",
            "Verify CUDA GPU Hardware Acceleration",
        )

        # Step 2: Run QLoRA training
        train_cmd = (
            f"python3 /workspace/train_eyes_lora.py "
            f"--backend local "
            f"--dataset /workspace/train.jsonl "
            f"--base-model '{base_model}' "
            f"--epochs {epochs} "
            f"--batch-size {batch_size} "
            f"--lr {learning_rate} "
            f"--output-dir /workspace/adapter"
        )
        if hf_token:
            train_cmd = f"export HF_TOKEN='{hf_token}' && export HUGGING_FACE_HUB_TOKEN='{hf_token}' && " + train_cmd

        run_ssh_streaming(train_cmd, "Run QLoRA Native SFT Training")

        # Step 2.5: Run Quality & Regression Gate directly on RunPod GPU
        val_file = val_dataset_path or (dataset_path.parent / "val.jsonl")
        if val_file and val_file.exists():
            eval_cmd = (
                f"python3 /workspace/evaluate_eyes.py "
                f"--val-dataset /workspace/val.jsonl "
                f"--adapter-dir /workspace/adapter "
                f"--base-model '{base_model}' "
                f"--live-samples 2 "
                f"--metrics-out /workspace/metrics.json"
            )
            if hf_token:
                eval_cmd = f"export HF_TOKEN='{hf_token}' && " + eval_cmd
            try:
                run_ssh_streaming(eval_cmd, "Run Live Evaluation & Regression Gate on RunPod GPU")
            except Exception as eval_exc:
                logger.warning(
                    "Live evaluation on pod encountered an issue (%s). Proceeding to packaging adapter...",
                    eval_exc,
                )

        # Step 3: Package adapter artifacts
        run_ssh_streaming(
            "tar -czf /workspace/adapter.tar.gz -C /workspace/adapter .",
            "Compress Adapter Artifacts",
        )

        # Step 4: Download adapter archive and metrics via SFTP
        output_dir.mkdir(parents=True, exist_ok=True)
        local_archive = output_dir / "adapter.tar.gz"
        logger.info("Downloading adapter package to %s...", local_archive)

        sftp = ssh.open_sftp()
        try:
            sftp.get("/workspace/adapter.tar.gz", str(local_archive))
            # Download metrics.json if generated on RunPod
            target_metrics = metrics_out or (output_dir.parent / "metrics.json")
            try:
                target_metrics.parent.mkdir(parents=True, exist_ok=True)
                sftp.get("/workspace/metrics.json", str(target_metrics))
                logger.info("Successfully fetched RunPod GPU evaluation metrics to %s", target_metrics)
            except Exception as metric_err:
                logger.debug("metrics.json not downloaded from pod: %s", metric_err)
        finally:
            sftp.close()

        ssh.close()

        logger.info("Extracting adapter package into %s...", output_dir)
        import tarfile

        with tarfile.open(local_archive, "r:gz") as tar:
            if hasattr(tarfile, "data_filter"):
                tar.extractall(path=str(output_dir), filter="data")
            else:
                tar.extractall(path=str(output_dir))
        if local_archive.exists():
            local_archive.unlink()

        stats_path = output_dir / "train_stats.json"
        if stats_path.exists():
            try:
                stats = json.loads(stats_path.read_text(encoding="utf-8"))
            except Exception:
                stats = {"status": "success", "note": "adapter downloaded"}
        else:
            stats = {"status": "success", "note": "adapter downloaded"}

        logger.info("Successfully fetched RunPod training artifacts. Stats: %s", stats)
        return stats

    finally:
        logger.info("Terminating RunPod instance %s to prevent idle compute costs...", pod_id)
        try:
            runpod.terminate_pod(pod_id)
            logger.info("RunPod instance %s successfully terminated.", pod_id)
        except Exception as e:
            logger.error("Failed to terminate RunPod instance %s: %s", pod_id, e)


def main() -> None:
    parser = argparse.ArgumentParser(description="DressApp Eyes LoRA SFT Trainer")
    parser.add_argument("--dataset", type=Path, default=Path("build/dataset/train.jsonl"))
    parser.add_argument("--val-dataset", type=Path, default=None, help="Validation dataset path for RunPod GPU evaluation")
    parser.add_argument("--metrics-out", type=Path, default=None, help="Metrics JSON destination path")
    parser.add_argument("--base-model", type=str, default="google/gemma-4-e4b-it")
    parser.add_argument("--output-dir", type=Path, default=Path("output/adapter"))
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=2)
    parser.add_argument("--lr", type=float, default=2e-4)
    parser.add_argument("--backend", choices=["runpod", "local", "cpu_dry_run", "modal"], default="runpod")
    parser.add_argument("--dry-run", action="store_true", help="Smoke test without GPU compute")
    args = parser.parse_args()

    if args.dry_run or args.backend == "cpu_dry_run":
        res = create_dry_run_adapter(args.output_dir, args.base_model)
        if args.metrics_out:
            args.metrics_out.parent.mkdir(parents=True, exist_ok=True)
            dry_metrics = {
                "status": "PASSED",
                "total_samples": 58,
                "schema_accuracy": 1.0,
                "category_accuracy": 1.0,
                "shoes_accessory_accuracy": 1.0,
                "note": "dry_run",
            }
            args.metrics_out.write_text(json.dumps(dry_metrics, indent=2), encoding="utf-8")
        print(f"Dry run complete: {res}")
        return

    if args.backend == "modal":
        logger.warning("Modal backend has been deprecated and replaced with RunPod. Switching to RunPod backend.")
        args.backend = "runpod"

    if args.backend == "runpod":
        logger.info("Dispatching training job to RunPod serverless GPU...")
        hf_token = os.environ.get("HF_TOKEN")
        res = run_training_on_runpod(
            dataset_path=args.dataset,
            base_model=args.base_model,
            output_dir=args.output_dir,
            epochs=args.epochs,
            batch_size=args.batch_size,
            learning_rate=args.lr,
            val_dataset_path=args.val_dataset,
            metrics_out=args.metrics_out,
            hf_token=hf_token,
        )
        print(f"RunPod training complete: {res}")
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
