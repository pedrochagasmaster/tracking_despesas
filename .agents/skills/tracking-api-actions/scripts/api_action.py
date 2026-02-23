#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import urllib.error
import urllib.parse
import urllib.request


def request(method: str, base: str, path: str, query: dict | None = None, body: dict | None = None):
    query_str = f"?{urllib.parse.urlencode(query)}" if query else ""
    url = f"{base.rstrip('/')}{path}{query_str}"
    data = None
    headers = {"Content-Type": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")

    req = urllib.request.Request(url=url, method=method, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            payload = resp.read().decode("utf-8")
            return json.loads(payload) if payload else {"status": "ok"}
    except urllib.error.HTTPError as err:
        msg = err.read().decode("utf-8", errors="replace")
        raise SystemExit(f"HTTP {err.code} {err.reason}: {msg}") from err


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Run actions against Tracking Despesas API")
    p.add_argument("--base", default="http://127.0.0.1:8000", help="API base URL")
    sub = p.add_subparsers(dest="action", required=True)

    sub.add_parser("default-month")

    s = sub.add_parser("summary")
    s.add_argument("--month")

    e = sub.add_parser("expenses")
    e.add_argument("--month")
    e.add_argument("--limit", type=int, default=200)

    inc = sub.add_parser("incomes")
    inc.add_argument("--month")

    sub.add_parser("subscriptions")

    b = sub.add_parser("budgets")
    b.add_argument("--month")

    t = sub.add_parser("trends")
    t.add_argument("--months", type=int, default=6)

    sub.add_parser("categories")

    ae = sub.add_parser("add-expense")
    ae.add_argument("--expense-date", required=True)
    ae.add_argument("--amount", type=float, required=True)
    ae.add_argument("--category", required=True)
    ae.add_argument("--description", required=True)

    ai = sub.add_parser("add-income")
    ai.add_argument("--income-date", required=True)
    ai.add_argument("--amount", type=float, required=True)
    ai.add_argument("--category", required=True)
    ai.add_argument("--description", required=True)

    asub = sub.add_parser("add-subscription")
    asub.add_argument("--name", required=True)
    asub.add_argument("--amount", type=float, required=True)
    asub.add_argument("--category", required=True)
    asub.add_argument("--frequency", choices=["monthly", "yearly"], default="monthly")
    asub.add_argument("--start-date")

    sb = sub.add_parser("set-budget")
    sb.add_argument("--month", required=True)
    sb.add_argument("--category", required=True)
    sb.add_argument("--amount", type=float, required=True)

    return p


def main() -> int:
    p = build_parser()
    args = p.parse_args()
    a = args.action

    if a == "default-month":
        res = request("GET", args.base, "/api/default-month")
    elif a == "summary":
        q = {"month": args.month} if args.month else None
        res = request("GET", args.base, "/api/summary", q)
    elif a == "expenses":
        q = {"limit": args.limit}
        if args.month:
            q["month"] = args.month
        res = request("GET", args.base, "/api/expenses", q)
    elif a == "incomes":
        q = {"month": args.month} if args.month else None
        res = request("GET", args.base, "/api/incomes", q)
    elif a == "subscriptions":
        res = request("GET", args.base, "/api/subscriptions")
    elif a == "budgets":
        q = {"month": args.month} if args.month else None
        res = request("GET", args.base, "/api/budgets", q)
    elif a == "trends":
        res = request("GET", args.base, "/api/trends", {"months": args.months})
    elif a == "categories":
        res = request("GET", args.base, "/api/categories")
    elif a == "add-expense":
        body = {
            "expense_date": args.expense_date,
            "amount": args.amount,
            "category": args.category,
            "description": args.description,
        }
        res = request("POST", args.base, "/api/expenses", body=body)
    elif a == "add-income":
        body = {
            "income_date": args.income_date,
            "amount": args.amount,
            "category": args.category,
            "description": args.description,
        }
        res = request("POST", args.base, "/api/incomes", body=body)
    elif a == "add-subscription":
        body = {
            "name": args.name,
            "amount": args.amount,
            "category": args.category,
            "frequency": args.frequency,
        }
        if args.start_date:
            body["start_date"] = args.start_date
        res = request("POST", args.base, "/api/subscriptions", body=body)
    elif a == "set-budget":
        body = {
            "month": args.month,
            "category": args.category,
            "amount": args.amount,
        }
        res = request("POST", args.base, "/api/budgets", body=body)
    else:
        raise SystemExit(f"Unsupported action: {a}")

    print(json.dumps(res, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
