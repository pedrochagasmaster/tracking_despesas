#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import shlex
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
LOG_DIR = ROOT / "logs"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def local_ip() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


def is_port_open(port: int, host: str = "127.0.0.1") -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0


def pid_for_port(port: int) -> int | None:
    try:
        out = subprocess.check_output(
            ["bash", "-lc", f"ss -ltnp '( sport = :{port} )'"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except subprocess.CalledProcessError:
        return None

    for line in out.splitlines():
        marker = "pid="
        if marker not in line:
            continue
        rest = line.split(marker, 1)[1]
        pid_part = rest.split(",", 1)[0].strip()
        if pid_part.isdigit():
            return int(pid_part)
    return None


def start_nohup(command: str, log_path: Path) -> int:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    quoted_log = shlex.quote(str(log_path))
    cmd = f"cd {shlex.quote(str(ROOT))} && nohup {command} > {quoted_log} 2>&1 & echo $!"
    out = subprocess.check_output(["bash", "-lc", cmd], text=True).strip()
    return int(out)


def wait_for_port(port: int, timeout_s: int = 25) -> bool:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        if is_port_open(port):
            return True
        time.sleep(0.5)
    return False


def ensure_service(name: str, port: int, start_cmd: str, log_file: Path, mode: str) -> dict[str, Any]:
    running = is_port_open(port)
    started = False
    start_error = None
    pid = pid_for_port(port)

    if not running and mode in {"auto", "start"}:
        try:
            pid = start_nohup(start_cmd, log_file)
            running = wait_for_port(port)
            started = running
            if running:
                pid = pid_for_port(port) or pid
            else:
                start_error = f"{name} did not open port {port} within timeout"
        except Exception as exc:  # pragma: no cover - defensive
            start_error = str(exc)
            running = False

    return {
        "name": name,
        "port": port,
        "running": running,
        "started_now": started,
        "pid": pid,
        "log_file": str(log_file),
        "start_error": start_error,
    }


def build_urls(port: int, ip: str) -> dict[str, str]:
    return {
        "local": f"http://127.0.0.1:{port}",
        "lan": f"http://{ip}:{port}",
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Start or inspect Tracking Despesas app endpoints. "
            "Mode 'auto' starts missing services with nohup."
        )
    )
    parser.add_argument("--mode", choices=["auto", "status", "start"], default="auto")
    parser.add_argument("--api-port", type=int, default=8000)
    parser.add_argument("--ui-port", type=int, default=5173)
    parser.add_argument("--no-api", action="store_true", help="Skip API inspection/start")
    parser.add_argument("--no-ui", action="store_true", help="Skip dashboard inspection/start")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    ip = local_ip()
    services: dict[str, Any] = {}

    if not args.no_api:
        api_cmd = f"uv run python -m uvicorn api:app --host 0.0.0.0 --port {args.api_port}"
        api_info = ensure_service(
            name="api",
            port=args.api_port,
            start_cmd=api_cmd,
            log_file=LOG_DIR / "api.nohup.log",
            mode=args.mode,
        )
        api_info["urls"] = build_urls(args.api_port, ip)
        api_info["docs"] = f"http://127.0.0.1:{args.api_port}/docs"
        api_info["health_hint"] = f"http://127.0.0.1:{args.api_port}/api/default-month"
        services["api"] = api_info

    if not args.no_ui:
        ui_cmd = (
            f"npm --prefix {shlex.quote(str(ROOT / 'dashboard'))} run dev -- "
            f"--host 0.0.0.0 --port {args.ui_port}"
        )
        ui_info = ensure_service(
            name="frontend",
            port=args.ui_port,
            start_cmd=ui_cmd,
            log_file=LOG_DIR / "frontend.nohup.log",
            mode=args.mode,
        )
        ui_info["urls"] = build_urls(args.ui_port, ip)
        services["frontend"] = ui_info

    payload = {
        "timestamp_utc": now_iso(),
        "workspace": str(ROOT),
        "host": {
            "hostname": socket.gethostname(),
            "local_ip": ip,
        },
        "services": services,
        "agent_connection": {
            "dashboard_url_local": None if args.no_ui else f"http://127.0.0.1:{args.ui_port}",
            "dashboard_url_lan": None if args.no_ui else f"http://{ip}:{args.ui_port}",
            "api_base_url_local": None if args.no_api else f"http://127.0.0.1:{args.api_port}",
            "api_base_url_lan": None if args.no_api else f"http://{ip}:{args.api_port}",
        },
    }

    failed = [
        name
        for name, data in services.items()
        if not data.get("running") and args.mode in {"auto", "start"}
    ]

    print(json.dumps(payload, indent=2 if args.pretty else None, ensure_ascii=False))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
