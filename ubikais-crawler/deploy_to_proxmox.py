#!/usr/bin/env python3
"""
Deploy UBIKAIS crawler to Proxmox using SSH + SCP with required env configuration.
"""

from __future__ import annotations

import os
import sys
import re
import shlex
from pathlib import Path
from typing import Optional, Tuple

import paramiko
from scp import SCPClient

# Proxmox connection
PROXMOX_HOST = os.getenv("PROXMOX_HOST", "").strip()
PROXMOX_USER = os.getenv("PROXMOX_USER", "root").strip() or "root"
PROXMOX_PASSWORD = os.getenv("PROXMOX_PASSWORD", "").strip()
PROXMOX_KEY_PATH = os.getenv("PROXMOX_KEY_PATH", "").strip() or None
PROXMOX_KEY_PASSPHRASE = os.getenv("PROXMOX_KEY_PASSPHRASE", "").strip() or None
ALLOW_UNKNOWN_HOST = os.getenv("PROXMOX_ALLOW_UNKNOWN_HOSTS", "false").lower() in {"1", "true", "yes", "on"}

DOCKER_COMMAND = os.getenv("DOCKER_COMMAND", "docker").strip() or "docker"
DOCKER_COMPOSE_COMMAND = os.getenv("DOCKER_COMPOSE_COMMAND", "docker-compose").strip() or "docker-compose"
COMMAND_SAFE_PATTERN = re.compile(r"^[A-Za-z0-9._/-]+$")

# Local/remote paths
SCRIPT_DIR = Path(__file__).resolve().parent
LOCAL_DOCKER_DIR = SCRIPT_DIR / "docker"
REMOTE_DIR = "/opt/ubikais-crawler"

DEPLOY_FILES = [
    "unified_crawler.py",
    "auto_crawler.py",
    "Dockerfile",
    "docker-compose.yml",
    "requirements.txt",
    "deploy.sh",
]


def require_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def validate_shell_command(value: str, label: str) -> str:
    if not COMMAND_SAFE_PATTERN.fullmatch(value):
        raise RuntimeError(f"Unsafe value for {label}: {value}")
    return value


def validate_host(value: str) -> str:
    if value != value.strip() or any(ch.isspace() for ch in value) or "\n" in value or "\r" in value:
        raise RuntimeError(f"Invalid host value: {value}")
    return value


def create_ssh_client(host: str, user: str, password: Optional[str], key_path: Optional[str]) -> paramiko.SSHClient:
    ssh = paramiko.SSHClient()
    ssh.load_system_host_keys()
    if ALLOW_UNKNOWN_HOST:
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        print("[WARN] Unknown host keys are allowed via PROXMOX_ALLOW_UNKNOWN_HOSTS=true")
    else:
        ssh.set_missing_host_key_policy(paramiko.RejectPolicy())

    connect_kwargs = {
        "hostname": host,
        "username": user,
        "timeout": 30,
        "allow_agent": False,
        "look_for_keys": False,
    }

    if key_path:
        connect_kwargs["key_filename"] = key_path
        if PROXMOX_KEY_PASSPHRASE:
            connect_kwargs["passphrase"] = PROXMOX_KEY_PASSPHRASE
    elif password:
        connect_kwargs["password"] = password
    else:
        raise RuntimeError("Proxmox connection needs PROXMOX_PASSWORD or PROXMOX_KEY_PATH")

    ssh.connect(**connect_kwargs)
    return ssh


def exec_command(ssh: paramiko.SSHClient, command: str, timeout: int = 120) -> Tuple[int, str, str]:
    stdin, stdout, stderr = ssh.exec_command(command, timeout=timeout)
    status = stdout.channel.recv_exit_status()
    out = stdout.read().decode(errors="ignore")
    err = stderr.read().decode(errors="ignore")
    if out.strip():
        print(out.strip())
    if err.strip():
        print(err.strip(), file=sys.stderr)
    return status, out, err


def exec_checked(ssh: paramiko.SSHClient, command: str, timeout: int = 120, allow_fail: bool = False) -> bool:
    status, _, _ = exec_command(ssh, command, timeout)
    if status != 0:
        if allow_fail:
            return False
        raise RuntimeError(f"Command failed ({status}): {command}")
    return True


def upload_files(ssh: paramiko.SSHClient) -> None:
    print("= upload_files =")
    exec_checked(ssh, f"mkdir -p {shlex.quote(REMOTE_DIR)}")

    with SCPClient(ssh.get_transport()) as scp:
        for filename in DEPLOY_FILES:
            local_path = LOCAL_DOCKER_DIR / filename
            if not local_path.exists():
                raise FileNotFoundError(f"Missing local file: {local_path}")
            remote_path = f"{REMOTE_DIR}/{filename}"
            print(f"Copying: {filename}")
            scp.put(str(local_path), remote_path)

    exec_checked(ssh, f"chmod +x {shlex.quote(f'{REMOTE_DIR}/deploy.sh')}")


def install_docker(ssh: paramiko.SSHClient) -> None:
    print("= install_docker =")
    checks = [
        f"command -v {shlex.quote(DOCKER_COMMAND)}",
        f"command -v {shlex.quote(DOCKER_COMPOSE_COMMAND)}",
    ]

    docker_installed = all(exec_checked(ssh, c, allow_fail=True) for c in checks)
    if not docker_installed:
        commands = [
            "apt-get update",
            "apt-get install -y docker.io docker-compose",
            "systemctl enable docker",
            "systemctl start docker",
        ]
        for command in commands:
            exec_checked(ssh, command, timeout=300)


def deploy_container(ssh: paramiko.SSHClient) -> None:
    print("= deploy_container =")
    base = f"cd {shlex.quote(REMOTE_DIR)} && "
    commands = [
        f"{base}{shlex.quote(DOCKER_COMPOSE_COMMAND)} down 2>/dev/null || true",
        f"{base}{shlex.quote(DOCKER_COMPOSE_COMMAND)} build --no-cache",
        f"{base}{shlex.quote(DOCKER_COMPOSE_COMMAND)} up -d",
        "sleep 5",
        f"{base}{shlex.quote(DOCKER_COMPOSE_COMMAND)} logs --tail=30",
    ]
    for command in commands:
        exec_checked(ssh, command, timeout=300)


def check_status(ssh: paramiko.SSHClient) -> None:
    print("= check_status =")
    remote_dir = shlex.quote(REMOTE_DIR)
    for command in [
        f"{shlex.quote(DOCKER_COMMAND)} ps -a | grep ubikais || true",
        f"ls -la {remote_dir}/data/ 2>/dev/null || echo 'No data dir'",
    ]:
        exec_checked(ssh, command)


def main() -> int:
    print("= UBIKAIS Proxmox Deployment =")
    try:
        host = validate_host(PROXMOX_HOST or require_env("PROXMOX_HOST"))
        docker_command = validate_shell_command(DOCKER_COMMAND, "DOCKER_COMMAND")
        docker_compose_command = validate_shell_command(DOCKER_COMPOSE_COMMAND, "DOCKER_COMPOSE_COMMAND")
        key_path = PROXMOX_KEY_PATH
        if key_path and not Path(key_path).exists():
            raise RuntimeError(f"PROXMOX_KEY_PATH does not exist: {key_path}")
        if not LOCAL_DOCKER_DIR.is_dir():
            raise RuntimeError(f"Invalid deployment directory: {LOCAL_DOCKER_DIR}")

        print(f"Target server: {host}")
        print(f"Using commands: {docker_command}, {docker_compose_command}")

        ssh = create_ssh_client(host, PROXMOX_USER, PROXMOX_PASSWORD, key_path)
        print("SSH connection established")

        globals()["DOCKER_COMMAND"] = docker_command
        globals()["DOCKER_COMPOSE_COMMAND"] = docker_compose_command

        upload_files(ssh)
        install_docker(ssh)
        deploy_container(ssh)
        check_status(ssh)

        ssh.close()
        print("Deployment completed")
        print(f"Logs: ssh {PROXMOX_USER}@{host} 'cd {REMOTE_DIR} && {DOCKER_COMPOSE_COMMAND} logs -f'")
        print(f"Status: ssh {PROXMOX_USER}@{host} 'cd {REMOTE_DIR} && {DOCKER_COMMAND} ps | grep ubikais'")
        print(f"Stop: ssh {PROXMOX_USER}@{host} 'cd {REMOTE_DIR} && {DOCKER_COMPOSE_COMMAND} down'")
        return 0
    except Exception as exc:
        print(f"Deployment failed: {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
