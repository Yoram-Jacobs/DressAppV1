#!/usr/bin/env python3
"""Headless RunPod Driver for On-Demand QLoRA Fine-Tuning.

Spins up an ephemeral GPU pod on RunPod, uploads datasets and training script,
executes fine-tuning with live log streaming, exports adapter artifacts to Hugging Face,
and strictly guarantees pod termination via a finally block cost guardrail.
"""

from __future__ import annotations

import argparse
import atexit
import logging
import os
import signal
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("runpod_driver")

DEFAULT_IMAGE = "runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04"
DEFAULT_GPU_CANDIDATES = [
    "NVIDIA GeForce RTX 4090",
    "NVIDIA RTX 4090",
    "NVIDIA A40",
    "NVIDIA RTX A5000",
    "NVIDIA L40S",
    "NVIDIA L4",
]

# Global tracking for emergency termination handler
ACTIVE_POD_ID: Optional[str] = None


def emergency_cleanup():
    global ACTIVE_POD_ID
    if ACTIVE_POD_ID:
        try:
            import runpod
            logger.warning("[COST GUARDRAIL] Emergency cleanup terminating pod: %s", ACTIVE_POD_ID)
            runpod.terminate_pod(ACTIVE_POD_ID)
            ACTIVE_POD_ID = None
        except Exception as e:
            logger.error("Failed during emergency pod termination: %s", e)


atexit.register(emergency_cleanup)


def signal_handler(signum, frame):
    logger.warning("Received termination signal %s. Initiating emergency pod teardown...", signum)
    emergency_cleanup()
    sys.exit(128 + signum)


signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="RunPod Headless QLoRA Driver")
    parser.add_argument(
        "--adapter_name",
        type=str,
        required=True,
        choices=["garment_vision", "trend_scout", "stylist_chat", "suitcase", "scheduled_outfit"],
        help="Adapter workflow to train",
    )
    parser.add_argument(
        "--dataset_path",
        type=str,
        default="training/datasets/sample_garment_vision.jsonl",
        help="Local path to JSONL training dataset",
    )
    parser.add_argument(
        "--train_script",
        type=str,
        default="training/train_qlora.py",
        help="Path to training script",
    )
    parser.add_argument(
        "--base_model",
        type=str,
        default="google/gemma-4-E4B-it",
        help="Base model repo ID",
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=3,
        help="Training epochs (default: 3)",
    )
    parser.add_argument(
        "--batch_size",
        type=int,
        default=2,
        help="Batch size (default: 2)",
    )
    parser.add_argument(
        "--learning_rate",
        type=float,
        default=2e-4,
        help="Learning rate (default: 2e-4)",
    )
    parser.add_argument(
        "--gpu_type",
        type=str,
        default="NVIDIA RTX 4090",
        help="Primary target GPU type",
    )
    parser.add_argument(
        "--dry_run",
        action="store_true",
        help="Dry run without provisioning cloud GPU pod",
    )
    parser.add_argument(
        "--hf_token",
        type=str,
        default=None,
        help="Hugging Face API token",
    )
    parser.add_argument(
        "--hf_repo",
        type=str,
        default=None,
        help="Target Hugging Face Model Repository",
    )
    parser.add_argument(
        "--output_dir",
        type=str,
        default="output_adapters",
        help="Local directory to download trained adapter weights",
    )
    return parser.parse_args()


def execute_dry_run(args: argparse.Namespace) -> Dict[str, Any]:
    logger.info("Executing headless RunPod training pipeline in DRY-RUN mode...")
    time.sleep(1)
    out_dir = Path(args.output_dir) / args.adapter_name
    out_dir.mkdir(parents=True, exist_ok=True)
    
    mock_config = {
        "base_model_name_or_path": args.base_model,
        "adapter_name": args.adapter_name,
        "r": 16,
        "lora_alpha": 32,
        "target_modules": ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        "status": "verified_dry_run",
    }
    (out_dir / "adapter_config.json").write_text(str(mock_config), encoding="utf-8")
    (out_dir / "adapter_model.safetensors").write_bytes(b"MOCK_SAFETENSORS_WEIGHTS")
    logger.info("[Dry Run] Mock adapter successfully generated at %s", out_dir)
    return {"status": "success", "mode": "dry_run", "adapter": args.adapter_name}


def run_pod_training(args: argparse.Namespace) -> Dict[str, Any]:
    global ACTIVE_POD_ID

    if args.dry_run:
        return execute_dry_run(args)

    try:
        import runpod
        import paramiko
    except ImportError as e:
        logger.error("Missing required dependencies: %s", e)
        logger.error("Run: pip install runpod paramiko huggingface_hub")
        sys.exit(1)

    api_key = os.environ.get("RUNPOD_API_KEY")
    if not api_key:
        raise ValueError("RUNPOD_API_KEY environment variable is required.")
    runpod.api_key = api_key

    hf_token = args.hf_token or os.environ.get("HF_TOKEN", "")
    target_hf_repo = args.hf_repo or f"Yoram-Jacobs/dressapp-{args.adapter_name}-adapter"

    # In-memory ephemeral RSA keypair for secure pod SSH access
    logger.info("Generating ephemeral 2048-bit RSA key for SSH...")
    rsa_key = paramiko.RSAKey.generate(2048)
    pub_key_str = f"ssh-rsa {rsa_key.get_base64()} dressapp-headless-trainer"

    try:
        runpod.update_user_settings(pubkey=pub_key_str)
        logger.info("Registered ephemeral public SSH key with RunPod.")
    except Exception as e:
        logger.warning("runpod.update_user_settings warning: %s. Continuing...", e)

    # Establish GPU candidate prioritization
    candidates = [args.gpu_type] + [g for g in DEFAULT_GPU_CANDIDATES if g != args.gpu_type]
    pod_id: Optional[str] = None
    ssh_host: Optional[str] = None
    ssh_port: Optional[int] = None
    ssh_client: Optional[paramiko.SSHClient] = None

    for gpu in candidates:
        logger.info("Attempting to provision RunPod instance with GPU: %s...", gpu)
        current_pod = None
        try:
            pod = runpod.create_pod(
                name=f"dressapp-{args.adapter_name}-{int(time.time())}",
                image_name=DEFAULT_IMAGE,
                gpu_type_id=gpu,
                gpu_count=1,
                cloud_type="ALL",
                support_public_ip=False,
                start_ssh=True,
                ports="22/tcp",
                container_disk_in_gb=40,
                volume_in_gb=0,
                env={"HF_TOKEN": hf_token},
            )
            if not pod or not isinstance(pod, dict) or "id" not in pod:
                raise RuntimeError(f"Unexpected pod creation response: {pod}")

            current_pod = str(pod["id"])
            ACTIVE_POD_ID = current_pod
            logger.info("Provisioned pod ID: %s. Polling for SSH connectivity...", current_pod)

            # Poll for SSH host and port
            poll_start = time.time()
            cand_host, cand_port = None, None
            while time.time() - poll_start < 240:
                pinfo = runpod.get_pod(current_pod)
                if pinfo and isinstance(pinfo, dict):
                    runtime = pinfo.get("runtime")
                    if runtime and isinstance(runtime, dict):
                        for p in runtime.get("ports", []):
                            if isinstance(p, dict) and p.get("privatePort") == 22 and p.get("ip") and p.get("publicPort"):
                                cand_host = str(p["ip"])
                                cand_port = int(p["publicPort"])
                                break
                if cand_host and cand_port:
                    break
                time.sleep(5)

            if not cand_host or not cand_port:
                raise TimeoutError(f"Pod {current_pod} failed to expose SSH port within timeout.")

            # Connect via SSH with retries
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            connected = False
            for attempt in range(15):
                try:
                    client.connect(
                        hostname=cand_host,
                        port=cand_port,
                        username="root",
                        pkey=rsa_key,
                        timeout=10,
                        banner_timeout=30,
                    )
                    connected = True
                    break
                except Exception:
                    time.sleep(4)

            if not connected:
                raise ConnectionError(f"Failed to establish SSH connection with {cand_host}:{cand_port}")

            pod_id = current_pod
            ssh_host = cand_host
            ssh_port = cand_port
            ssh_client = client
            logger.info("Connected to RunPod instance %s (%s) at %s:%d", pod_id, gpu, ssh_host, ssh_port)
            break

        except Exception as e:
            logger.warning("Candidate GPU '%s' failed: %s. Cleaning up...", gpu, e)
            if current_pod:
                try:
                    runpod.terminate_pod(current_pod)
                except Exception:
                    pass
                ACTIVE_POD_ID = None

    if not pod_id or not ssh_client:
        raise RuntimeError("Failed to provision any viable RunPod GPU instance.")

    # Primary Execution Block with CRITICAL Cost Guardrail (finally block)
    try:
        logger.info("Setting up remote workspace and uploading files...")
        sftp = ssh_client.open_sftp()
        try:
            sftp.mkdir("/workspace")
        except Exception:
            pass

        dataset_remote = f"/workspace/dataset.jsonl"
        script_remote = "/workspace/train_qlora.py"

        logger.info("Uploading dataset: %s -> %s", args.dataset_path, dataset_remote)
        sftp.put(str(Path(args.dataset_path).resolve()), dataset_remote)

        logger.info("Uploading training script: %s -> %s", args.train_script, script_remote)
        sftp.put(str(Path(args.train_script).resolve()), script_remote)
        sftp.close()

        # Install training dependencies remotely
        logger.info("Installing fine-tuning dependencies on remote pod...")
        install_cmd = (
            "export DEBIAN_FRONTEND=noninteractive && "
            "pip install --upgrade pip && "
            "pip install --prefer-binary "
            "'transformers>=4.40.0' 'peft>=0.10.0' 'trl>=0.8.6' 'accelerate>=0.28.0' "
            "'bitsandbytes>=0.43.0' 'datasets>=2.18.0' 'huggingface_hub>=0.22.0'"
        )
        _, stdout, stderr = ssh_client.exec_command(install_cmd, get_pty=True)
        for line in iter(stdout.readline, ""):
            if line:
                logger.info("[Remote Pip] %s", line.strip())
        status = stdout.channel.recv_exit_status()
        if status != 0:
            raise RuntimeError(f"Dependency installation failed with code {status}")

        # Construct training command
        hub_flag = f"--push_to_hub --hub_model_id '{target_hf_repo}'" if hf_token else ""
        run_cmd = (
            f"export HF_TOKEN='{hf_token}' && "
            f"python3 /workspace/train_qlora.py "
            f"--adapter_name '{args.adapter_name}' "
            f"--dataset_path '{dataset_remote}' "
            f"--base_model '{args.base_model}' "
            f"--output_dir '/workspace/adapter_out' "
            f"--epochs {args.epochs} "
            f"--batch_size {args.batch_size} "
            f"--learning_rate {args.learning_rate} "
            f"{hub_flag}"
        )

        logger.info("Launching QLoRA fine-tuning on remote GPU...")
        _, stdout, stderr = ssh_client.exec_command(run_cmd, get_pty=True)
        for line in iter(stdout.readline, ""):
            if line:
                logger.info("[Remote Training] %s", line.strip())

        exit_code = stdout.channel.recv_exit_status()
        if exit_code != 0:
            raise RuntimeError(f"Training script terminated with non-zero exit code {exit_code}")

        logger.info("Remote training finished successfully.")

        # Download adapter artifacts locally
        local_adapter_dir = Path(args.output_dir) / args.adapter_name
        local_adapter_dir.mkdir(parents=True, exist_ok=True)
        sftp = ssh_client.open_sftp()
        try:
            remote_files = sftp.listdir("/workspace/adapter_out")
            for rf in remote_files:
                logger.info("Downloading artifact: %s", rf)
                sftp.get(f"/workspace/adapter_out/{rf}", str(local_adapter_dir / rf))
        finally:
            sftp.close()

        logger.info("Successfully fetched trained adapter to: %s", local_adapter_dir)
        return {
            "status": "success",
            "pod_id": pod_id,
            "adapter_name": args.adapter_name,
            "local_path": str(local_adapter_dir),
            "hf_repo": target_hf_repo if hf_token else None,
        }

    finally:
        # CRITICAL COST GUARDRAIL: Strict termination in finally block
        if pod_id:
            logger.info("=================================================================")
            logger.info("[COST GUARDRAIL] Terminating RunPod instance %s immediately...", pod_id)
            logger.info("=================================================================")
            if ssh_client:
                try:
                    ssh_client.close()
                except Exception:
                    pass

            for term_attempt in range(5):
                try:
                    runpod.terminate_pod(pod_id)
                    logger.info("Successfully terminated RunPod pod %s. Billing halted.", pod_id)
                    ACTIVE_POD_ID = None
                    break
                except Exception as te:
                    logger.error("Error terminating pod %s (attempt %d/5): %s", pod_id, term_attempt + 1, te)
                    time.sleep(3)


def main():
    args = parse_args()
    try:
        result = run_pod_training(args)
        logger.info("RunPod headless training completed: %s", result)
    except Exception as e:
        logger.exception("RunPod driver encountered fatal error: %s", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
