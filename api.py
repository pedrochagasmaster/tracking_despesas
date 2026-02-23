#!/usr/bin/env python3
"""FastAPI bridge for the expense tracking dashboard."""
from __future__ import annotations

import sqlite3
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

DB_PATH = Path(__file__).parent / "expenses.db"

app = FastAPI(title="Tracking Despesas API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def row_to_dict(row: sqlite3.Row) -> dict:
    return dict(row)


def parse_month(value: str):
    dt = datetime.strptime(value, "%Y-%m")
    import calendar
    start = date(dt.year, dt.month, 1)
    last_day = calendar.monthrange(dt.year, dt.month)[1]
    end = date(dt.year, dt.month, last_day)
    return start, end


def shift_month(base: date, offset: int) -> date:
    import calendar
    year = base.year + (base.month - 1 + offset) // 12
    month = (base.month - 1 + offset) % 12 + 1
    day = min(base.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def current_month() -> str:
    today = date.today()
    return f"{today.year:04d}-{today.month:02d}"


def latest_data_month() -> str:
    conn = get_conn()
    row = conn.execute(
        """
        SELECT MAX(dt) AS latest FROM (
            SELECT MAX(expense_date) AS dt FROM expenses
            UNION ALL
            SELECT MAX(income_date) AS dt FROM incomes
            UNION ALL
            SELECT MAX(budget_month || '-01') AS dt FROM budgets
        )
        """
    ).fetchone()
    conn.close()
    latest = row["latest"] if row else None
    if not latest:
        return current_month()
    return str(latest)[:7]


def latest_budget_month() -> str:
    conn = get_conn()
    row = conn.execute("SELECT MAX(budget_month) AS latest FROM budgets").fetchone()
    conn.close()
    latest = row["latest"] if row else None
    if not latest:
        return latest_data_month()
    return str(latest)[:7]


# ── Metadata ───────────────────────────────────────────────────────────────────
@app.get("/api/default-month")
def default_month():
    return {"month": latest_data_month(), "budgets_month": latest_budget_month()}


# ── Summary ────────────────────────────────────────────────────────────────────
@app.get("/api/summary")
def summary(month: str = Query(default=None)):
    if month is None:
        month = current_month()
    start, end = parse_month(month)

    conn = get_conn()
    expenses = conn.execute(
        "SELECT amount, category FROM expenses WHERE expense_date >= ? AND expense_date <= ?",
        (start.isoformat(), end.isoformat()),
    ).fetchall()
    incomes = conn.execute(
        "SELECT amount FROM incomes WHERE income_date >= ? AND income_date <= ?",
        (start.isoformat(), end.isoformat()),
    ).fetchall()

    total_expenses = sum(float(r["amount"]) for r in expenses)
    total_income = sum(float(r["amount"]) for r in incomes)
    net = total_income - total_expenses
    savings_rate = (net / total_income * 100.0) if total_income > 0 else 0.0

    by_category: dict[str, float] = defaultdict(float)
    for r in expenses:
        by_category[r["category"]] += float(r["amount"])

    # previous month for delta
    prev_month_start = shift_month(start, -1)
    prev_month = f"{prev_month_start.year:04d}-{prev_month_start.month:02d}"
    prev_start, prev_end = parse_month(prev_month)
    prev_exp_rows = conn.execute(
        "SELECT amount FROM expenses WHERE expense_date >= ? AND expense_date <= ?",
        (prev_start.isoformat(), prev_end.isoformat()),
    ).fetchall()
    prev_inc_rows = conn.execute(
        "SELECT amount FROM incomes WHERE income_date >= ? AND income_date <= ?",
        (prev_start.isoformat(), prev_end.isoformat()),
    ).fetchall()
    prev_expenses = sum(float(r["amount"]) for r in prev_exp_rows)
    prev_income = sum(float(r["amount"]) for r in prev_inc_rows)

    conn.close()
    return {
        "month": month,
        "income": total_income,
        "expenses": total_expenses,
        "net": net,
        "savings_rate": round(savings_rate, 1),
        "prev_income": prev_income,
        "prev_expenses": prev_expenses,
        "spending_by_category": dict(sorted(by_category.items(), key=lambda x: x[1], reverse=True)),
    }


# ── Expenses ────────────────────────────────────────────────────────────────────
@app.get("/api/expenses")
def expenses(month: str = Query(default=None), limit: int = 200):
    if month is None:
        month = current_month()
    start, end = parse_month(month)
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM expenses WHERE expense_date >= ? AND expense_date <= ? ORDER BY expense_date DESC, id DESC LIMIT ?",
        (start.isoformat(), end.isoformat(), limit),
    ).fetchall()
    conn.close()
    return [row_to_dict(r) for r in rows]


# ── Incomes ─────────────────────────────────────────────────────────────────────
@app.get("/api/incomes")
def incomes(month: str = Query(default=None)):
    if month is None:
        month = current_month()
    start, end = parse_month(month)
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM incomes WHERE income_date >= ? AND income_date <= ? ORDER BY income_date DESC",
        (start.isoformat(), end.isoformat()),
    ).fetchall()
    conn.close()
    return [row_to_dict(r) for r in rows]


# ── Subscriptions ────────────────────────────────────────────────────────────────
@app.get("/api/subscriptions")
def subscriptions():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM subscriptions ORDER BY active DESC, amount DESC").fetchall()
    conn.close()
    return [row_to_dict(r) for r in rows]


# ── Budgets ──────────────────────────────────────────────────────────────────────
@app.get("/api/budgets")
def budgets(month: str = Query(default=None)):
    if month is None:
        month = current_month()
    start, end = parse_month(month)
    conn = get_conn()
    budget_rows = conn.execute(
        "SELECT category, amount FROM budgets WHERE budget_month = ?", (month,)
    ).fetchall()
    expense_rows = conn.execute(
        "SELECT category, amount FROM expenses WHERE expense_date >= ? AND expense_date <= ?",
        (start.isoformat(), end.isoformat()),
    ).fetchall()

    actual: dict[str, float] = defaultdict(float)
    for r in expense_rows:
        actual[r["category"]] += float(r["amount"])

    result = []
    for b in budget_rows:
        cat = b["category"]
        budgeted = float(b["amount"])
        spent = actual.get(cat, 0.0)
        result.append({
            "category": cat,
            "budgeted": budgeted,
            "spent": spent,
            "remaining": budgeted - spent,
            "pct": round(min(spent / budgeted * 100, 100) if budgeted > 0 else 0, 1),
        })
    conn.close()
    return sorted(result, key=lambda x: x["pct"], reverse=True)


# ── Trends ───────────────────────────────────────────────────────────────────────
@app.get("/api/trends")
def trends(months: int = Query(default=6)):
    anchor_month = latest_data_month()
    today = datetime.strptime(anchor_month, "%Y-%m").date().replace(day=1)
    result = []
    for i in reversed(range(months)):
        m_start = shift_month(today, -i)
        m_key = f"{m_start.year:04d}-{m_start.month:02d}"
        start, end = parse_month(m_key)
        conn = get_conn()
        exp = conn.execute(
            "SELECT amount FROM expenses WHERE expense_date >= ? AND expense_date <= ?",
            (start.isoformat(), end.isoformat()),
        ).fetchall()
        inc = conn.execute(
            "SELECT amount FROM incomes WHERE income_date >= ? AND income_date <= ?",
            (start.isoformat(), end.isoformat()),
        ).fetchall()
        conn.close()
        total_exp = sum(float(r["amount"]) for r in exp)
        total_inc = sum(float(r["amount"]) for r in inc)
        net = total_inc - total_exp
        result.append({
            "month": m_key,
            "expenses": round(total_exp, 2),
            "income": round(total_inc, 2),
            "net": round(net, 2),
        })
    return result


# ── Categories ───────────────────────────────────────────────────────────────────
@app.get("/api/categories")
def categories():
    """All-time category list for filtering."""
    conn = get_conn()
    rows = conn.execute(
        "SELECT DISTINCT category FROM expenses ORDER BY category"
    ).fetchall()
    conn.close()
    return [r["category"] for r in rows]


# ── POST: Add expense ─────────────────────────────────────────────────────────────
class ExpenseIn(BaseModel):
    expense_date: str
    amount: float
    category: str
    description: str


@app.post("/api/expenses")
def add_expense(body: ExpenseIn):
    conn = get_conn()
    conn.execute(
        "INSERT INTO expenses (expense_date, amount, description, category, kind) VALUES (?, ?, ?, ?, 'one_off')",
        (body.expense_date, body.amount, body.description.strip(), body.category.strip()),
    )
    conn.commit()
    conn.close()
    return {"status": "ok"}


# ── POST: Add income ─────────────────────────────────────────────────────────────
class IncomeIn(BaseModel):
    income_date: str
    amount: float
    category: str
    description: str


@app.post("/api/incomes")
def add_income(body: IncomeIn):
    conn = get_conn()
    conn.execute(
        "INSERT INTO incomes (income_date, amount, description, category) VALUES (?, ?, ?, ?)",
        (body.income_date, body.amount, body.description.strip(), body.category.strip()),
    )
    conn.commit()
    conn.close()
    return {"status": "ok"}


# ── POST: Add subscription ────────────────────────────────────────────────────────
class SubscriptionIn(BaseModel):
    name: str
    amount: float
    category: str
    frequency: str = "monthly"
    start_date: str | None = None


@app.post("/api/subscriptions")
def add_subscription(body: SubscriptionIn):
    start_date = body.start_date or date.today().isoformat()
    conn = get_conn()
    conn.execute(
        "INSERT INTO subscriptions (name, amount, category, frequency, start_date) VALUES (?, ?, ?, ?, ?)",
        (body.name.strip(), body.amount, body.category.strip(), body.frequency, start_date),
    )
    conn.commit()
    conn.close()
    return {"status": "ok"}


# ── POST: Set budget ──────────────────────────────────────────────────────────────
class BudgetIn(BaseModel):
    month: str
    category: str
    amount: float


@app.post("/api/budgets")
def set_budget(body: BudgetIn):
    conn = get_conn()
    conn.execute(
        """INSERT INTO budgets (budget_month, category, amount) VALUES (?, ?, ?)
           ON CONFLICT(budget_month, category) DO UPDATE SET amount = excluded.amount""",
        (body.month, body.category.strip(), body.amount),
    )
    conn.commit()
    conn.close()
    return {"status": "ok"}
