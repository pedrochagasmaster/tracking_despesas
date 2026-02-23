#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ALLOWED_ACTIONS = {
    "add-expense",
    "add-income",
    "add-subscription",
    "set-budget",
    "update-expense",
    "delete-expense",
    "update-budget",
    "delete-budget",
}


def request_json(method: str, base: str, path: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(
        url=f"{base.rstrip('/')}{path}",
        method=method,
        data=json.dumps(body).encode("utf-8") if body is not None else None,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {"status": "ok"}
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {err.code} {err.reason}: {detail}") from err


def endpoint_and_payload(item: dict) -> tuple[str, str, dict | None]:
    action = item.get("action")
    if action not in ALLOWED_ACTIONS:
        raise ValueError(f"Unsupported action: {action}")

    if action == "add-expense":
        return "POST", "/api/expenses", {
            "expense_date": item["expense_date"],
            "amount": float(item["amount"]),
            "category": item["category"],
            "description": item["description"],
        }

    if action == "add-income":
        return "POST", "/api/incomes", {
            "income_date": item["income_date"],
            "amount": float(item["amount"]),
            "category": item["category"],
            "description": item["description"],
        }

    if action == "add-subscription":
        body = {
            "name": item["name"],
            "amount": float(item["amount"]),
            "category": item["category"],
            "frequency": item.get("frequency", "monthly"),
        }
        if item.get("start_date"):
            body["start_date"] = item["start_date"]
        return "POST", "/api/subscriptions", body

    if action == "set-budget":
        return "POST", "/api/budgets", {
            "category": item["category"],
            "amount": float(item["amount"]),
        }

    if action == "update-expense":
        return "PUT", f"/api/expenses/{int(item['id'])}", {
            "expense_date": item["expense_date"],
            "amount": float(item["amount"]),
            "category": item["category"],
            "description": item["description"],
        }

    if action == "delete-expense":
        return "DELETE", f"/api/expenses/{int(item['id'])}", None

    if action == "update-budget":
        return "PUT", "/api/budgets", {
            "category": item["category"],
            "amount": float(item["amount"]),
        }

    query = urllib.parse.urlencode({"category": item["category"]})
    return "DELETE", f"/api/budgets?{query}", None


def load_json(path: Path) -> list[dict]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict):
        data = data.get("operations", [])
    if not isinstance(data, list):
        raise ValueError("JSON input must be a list or an object with 'operations' list")
    return data


def load_csv(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


def main() -> int:
    parser = argparse.ArgumentParser(description="Batch-write actions to Tracking Despesas API")
    parser.add_argument("--base", default="http://127.0.0.1:8000", help="API base URL")
    parser.add_argument("--input", required=True, help="Path to JSON or CSV batch file")
    parser.add_argument("--dry-run", action="store_true", help="Print operations without executing")
    parser.add_argument("--continue-on-error", action="store_true", help="Continue when one operation fails")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        raise SystemExit(f"Input file not found: {input_path}")

    suffix = input_path.suffix.lower()
    if suffix == ".json":
        ops = load_json(input_path)
    elif suffix == ".csv":
        ops = load_csv(input_path)
    else:
        raise SystemExit("Input must be .json or .csv")

    ok = 0
    failed = 0
    for idx, op in enumerate(ops, start=1):
        try:
            method, path, body = endpoint_and_payload(op)
            if args.dry_run:
                print(
                    json.dumps(
                        {"index": idx, "action": op.get("action"), "method": method, "path": path, "body": body},
                        ensure_ascii=False,
                    )
                )
                ok += 1
                continue
            result = request_json(method, args.base, path, body)
            print(json.dumps({"index": idx, "action": op.get("action"), "result": result}, ensure_ascii=False))
            ok += 1
        except Exception as err:
            failed += 1
            print(json.dumps({"index": idx, "action": op.get("action"), "error": str(err)}, ensure_ascii=False))
            if not args.continue_on_error:
                break

    print(json.dumps({"summary": {"total": len(ops), "ok": ok, "failed": failed, "dry_run": args.dry_run}}, ensure_ascii=False))
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
