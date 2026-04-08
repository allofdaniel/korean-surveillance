"""
Deploy eAIP Crawler to NAS
Replaced shell-style command construction with argument-based execution and environment driven config.
"""

import argparse
import os
import shlex
import subprocess
import sys
from pathlib import Path

REQUEST_TIMEOUT_SECONDS = 60

SCRIPT_DIR = Path(__file__).resolve().parent


def get_required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def run_command(cmd, timeout: int = REQUEST_TIMEOUT_SECONDS):
    result = subprocess.run(
        cmd,
        check=False,
        capture_output=True,
        text=True,
        timeout=timeout,
    )

    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    return result.returncode == 0, result


def run_ssh(host: str, command: str, user: str, key_file: str | None = None) -> bool:
    ssh_cmd = [
        "ssh",
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=15",
        "-o",
        "StrictHostKeyChecking=accept-new",
    ]

    if key_file:
        ssh_cmd.extend(["-i", key_file])

    ssh_cmd.extend([f"{user}@{host}", command])
    return run_command(ssh_cmd)[0]


def run_scp(host: str, user: str, local_path: Path, remote_path: str, key_file: str | None = None) -> bool:
    if not local_path.exists():
        print(f"Missing file: {local_path}")
        return False

    scp_cmd = [
        "scp",
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=15",
        "-o",
        "StrictHostKeyChecking=accept-new",
    ]
    if key_file:
        scp_cmd.extend(["-i", key_file])
    scp_cmd.extend([str(local_path), f"{user}@{host}:{remote_path}"])
    return run_command(scp_cmd)[0]


def main() -> int:
    parser = argparse.ArgumentParser(description="Deploy eAIP crawler to NAS")
    parser.add_argument("--host", default=os.getenv("NAS_HOST"))
    parser.add_argument("--user", default=os.getenv("NAS_USER"))
    parser.add_argument("--path", default=os.getenv("NAS_DOCKER_PATH", "/volume1/docker/eaip-crawler"))
    parser.add_argument("--ssh-key", default=os.getenv("NAS_SSH_KEY_PATH", ""))
    parser.add_argument("--docker-bin", default=os.getenv("NAS_DOCKER_BIN", "/usr/local/bin/docker"))
    parser.add_argument("--compose-bin", default=os.getenv("NAS_DOCKER_COMPOSE_BIN", "/usr/local/bin/docker-compose"))
    args = parser.parse_args()

    try:
        host = args.host or get_required_env("NAS_HOST")
        user = args.user or get_required_env("NAS_USER")
        docker_path = args.path
        key_file = args.ssh_key.strip() if args.ssh_key else None
    except RuntimeError as e:
        print(f"[FAIL] {e}")
        return 1

    # Keep SSH key empty if the file does not exist.
    if key_file and not Path(key_file).exists():
        print(f"[FAIL] SSH key not found: {key_file}")
        return 1

    print("=== Deploying eAIP Crawler to NAS ===")
    print(f"NAS: {user}@{host}")
    print(f"Path: {docker_path}")

    local_files = ["eaip_crawler.py", "Dockerfile", "entrypoint.sh", "docker-compose.yml"]

    if not run_ssh(host, f"mkdir -p {shlex.quote(docker_path)}", user, key_file):
        print("[FAIL] Failed to create remote directory")
        return 1

    for filename in local_files:
        local_path = SCRIPT_DIR / filename
        remote_path = f"{docker_path}/{filename}"
        if not run_scp(host, user, local_path, remote_path, key_file):
            print(f"[FAIL] Failed to copy {filename}")
            return 1

    if not run_ssh(host, f"chmod +x {shlex.quote(f'{docker_path}/entrypoint.sh')}", user, key_file):
        print("[FAIL] Failed to set script execute permission")
        return 1

    if not run_ssh(
        host,
        f"{shlex.quote(args.docker_bin)} stop eaip-crawler || true && "
        f"{shlex.quote(args.docker_bin)} rm eaip-crawler || true",
        user,
        key_file,
    ):
        print("[WARN] Existing container stop/removal failed, continuing")

    if not run_ssh(
        host,
        f"cd {shlex.quote(docker_path)} && {shlex.quote(args.compose_bin)} up -d --build",
        user,
        key_file,
        timeout=180,
    ):
        print("[FAIL] Failed to start deployment")
        return 1

    docker_logs_cmd = f"{shlex.quote(args.docker_bin)} logs -f eaip-crawler"
    print("=== Deployment complete ===")
    print(f"Check logs: ssh {user}@{host} '{docker_logs_cmd}'")
    return 0


if __name__ == "__main__":
    sys.exit(main())
