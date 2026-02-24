#!/usr/bin/env python3
"""FastAPI bridge for the expense tracking dashboard."""
from __future__ import annotations

import csv
import sqlite3
import threading
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

DB_PATH = Path(__file__).parent / "expenses.db"
ROOT_PATH = Path(__file__).parent
DEFAULT_CURATION_CSV = ROOT_PATH / "nubank_csv_attachments_last24h" / "combined_transactions_deduped.csv"
_BUDGET_MIGRATION_LOCK = threading.Lock()
_BUDGET_MIGRATED = False

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
    _migrate_budgets_to_global_once(conn)
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


def _subscription_due_on_month(sub: sqlite3.Row, start: date, end: date) -> bool:
    start_date = datetime.strptime(str(sub["start_date"]), "%Y-%m-%d").date()
    if start_date > end:
        return False

    end_date_raw = sub["end_date"] if "end_date" in sub.keys() else None
    if end_date_raw:
        end_date = datetime.strptime(str(end_date_raw), "%Y-%m-%d").date()
        if end_date < start:
            return False

    frequency = str(sub["frequency"])
    if frequency == "monthly":
        return True

    if frequency == "yearly":
        import calendar

        due_day = min(start_date.day, calendar.monthrange(start.year, start_date.month)[1])
        due_date = date(start.year, start_date.month, due_day)
        return start <= due_date <= end

    return False


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
        )
        """
    ).fetchone()
    conn.close()
    latest = row["latest"] if row else None
    if not latest:
        return current_month()
    return str(latest)[:7]


def _migrate_budgets_to_global_once(conn: sqlite3.Connection) -> None:
    global _BUDGET_MIGRATED
    if _BUDGET_MIGRATED:
        return
    with _BUDGET_MIGRATION_LOCK:
        if _BUDGET_MIGRATED:
            return
        _migrate_budgets_to_global(conn)
        _BUDGET_MIGRATED = True


def _migrate_budgets_to_global(conn: sqlite3.Connection) -> None:
    cols = conn.execute("PRAGMA table_info(budgets)").fetchall()
    if not cols:
        return
    col_names = {str(col["name"]) for col in cols}
    if "budget_month" not in col_names:
        return
    conn.executescript(
        """
        DROP TABLE IF EXISTS budgets_new;

        CREATE TABLE budgets_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            amount REAL NOT NULL CHECK(amount >= 0),
            UNIQUE(category)
        );

        INSERT INTO budgets_new (category, amount)
        SELECT b.category, b.amount
        FROM budgets b
        JOIN (
            SELECT category, MAX(budget_month) AS latest_month
            FROM budgets
            GROUP BY category
        ) latest
          ON latest.category = b.category
         AND latest.latest_month = b.budget_month
        WHERE trim(coalesce(b.category, '')) <> '';

        DROP TABLE budgets;
        ALTER TABLE budgets_new RENAME TO budgets;
        """
    )
    conn.commit()


def _normalize_keep(value: Any) -> bool:
    text = str(value or "").strip().lower()
    return text in {"1", "true", "yes", "y", "sim", "s"}


def _resolve_csv_path(file_path: str | None) -> Path:
    if not file_path:
        target = DEFAULT_CURATION_CSV
        if not target.exists():
            csv_files = _list_curation_csv_files()
            if not csv_files:
                raise HTTPException(
                    status_code=404,
                    detail=f"CSV not found: {DEFAULT_CURATION_CSV}",
                )
            target = ROOT_PATH / csv_files[0]
    else:
        target = Path(file_path)
    if not target.is_absolute():
        target = ROOT_PATH / target
    resolved = target.resolve()
    if resolved.suffix.lower() != ".csv":
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    try:
        resolved.relative_to(ROOT_PATH.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="File path must be inside project root")
    if not resolved.exists():
        raise HTTPException(status_code=404, detail=f"CSV not found: {resolved}")
    return resolved


def _list_curation_csv_files() -> list[str]:
    ignored_dirs = {
        ".git",
        ".venv",
        "node_modules",
        "__pycache__",
        "dist",
        "build",
    }
    files: list[str] = []
    for path in ROOT_PATH.rglob("*.csv"):
        rel = path.relative_to(ROOT_PATH)
        if any(part in ignored_dirs for part in rel.parts):
            continue
        files.append(str(rel))
    return sorted(files)


def _load_budget_categories() -> list[str]:
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT DISTINCT category
        FROM budgets
        WHERE trim(coalesce(category, '')) <> ''
        ORDER BY category
        """
    ).fetchall()
    conn.close()
    return [str(row["category"]).strip() for row in rows]


def _read_curation_csv(csv_path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise HTTPException(status_code=400, detail=f"CSV header missing: {csv_path}")
        fieldnames = list(reader.fieldnames)
        rows = list(reader)

    for column in ("keep", "categoria_orcamento"):
        if column not in fieldnames:
            fieldnames.append(column)
            for row in rows:
                row[column] = ""
        else:
            for row in rows:
                row[column] = row.get(column, "")
    return fieldnames, rows


def _write_curation_csv(csv_path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    temp_path = csv_path.with_suffix(csv_path.suffix + ".tmp")
    with temp_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    temp_path.replace(csv_path)


def _parse_curation_amount(raw: Any) -> float | None:
    text = str(raw or "").strip()
    if not text:
        return None
    normalized = text.replace(",", "")
    try:
        return float(normalized)
    except ValueError:
        return None


# ── Metadata ───────────────────────────────────────────────────────────────────
@app.get("/api/default-month")
def default_month():
    month = latest_data_month()
    return {"month": month, "budgets_month": month}


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
    budget_rows = conn.execute("SELECT category, amount FROM budgets").fetchall()
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


def _editable_expense_or_404(conn: sqlite3.Connection, expense_id: int) -> sqlite3.Row:
    row = conn.execute(
        "SELECT id, kind FROM expenses WHERE id = ?",
        (expense_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Expense not found")
    if row["kind"] != "one_off":
        raise HTTPException(
            status_code=400,
            detail="Only one-off expenses can be edited or deleted",
        )
    return row


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


@app.put("/api/expenses/{expense_id}")
def update_expense(expense_id: int, body: ExpenseIn):
    conn = get_conn()
    _editable_expense_or_404(conn, expense_id)
    conn.execute(
        """
        UPDATE expenses
        SET expense_date = ?, amount = ?, description = ?, category = ?
        WHERE id = ?
        """,
        (body.expense_date, body.amount, body.description.strip(), body.category.strip(), expense_id),
    )
    conn.commit()
    conn.close()
    return {"status": "ok"}


@app.delete("/api/expenses/{expense_id}")
def delete_expense(expense_id: int):
    conn = get_conn()
    _editable_expense_or_404(conn, expense_id)
    conn.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
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


class SubscriptionUpdateIn(BaseModel):
    name: str
    amount: float
    category: str
    frequency: str
    start_date: str
    end_date: str | None = None
    active: bool = True


def _subscription_or_404(conn: sqlite3.Connection, subscription_id: int) -> sqlite3.Row:
    row = conn.execute("SELECT id FROM subscriptions WHERE id = ?", (subscription_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return row


@app.put("/api/subscriptions/{subscription_id}")
def update_subscription(subscription_id: int, body: SubscriptionUpdateIn):
    conn = get_conn()
    _subscription_or_404(conn, subscription_id)
    conn.execute(
        """
        UPDATE subscriptions
        SET name = ?, amount = ?, category = ?, frequency = ?, start_date = ?, end_date = ?, active = ?
        WHERE id = ?
        """,
        (
            body.name.strip(),
            body.amount,
            body.category.strip(),
            body.frequency,
            body.start_date,
            body.end_date,
            1 if body.active else 0,
            subscription_id,
        ),
    )
    conn.commit()
    conn.close()
    return {"status": "ok"}


@app.delete("/api/subscriptions/{subscription_id}")
def delete_subscription(subscription_id: int):
    conn = get_conn()
    _subscription_or_404(conn, subscription_id)
    try:
        cur = conn.execute("DELETE FROM subscriptions WHERE id = ?", (subscription_id,))
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(
            status_code=400,
            detail="Subscription has linked charges. Set it inactive instead of deleting.",
        )
    if cur.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Subscription not found")
    conn.commit()
    conn.close()
    return {"status": "ok"}


class RunSubscriptionsIn(BaseModel):
    month: str
    dry_run: bool = False


@app.post("/api/subscriptions/run")
def run_subscriptions(body: RunSubscriptionsIn):
    start, end = parse_month(body.month)
    month_id = start.strftime("%Y-%m")
    charge_date = date(start.year, start.month, 1).isoformat()

    conn = get_conn()
    subs = conn.execute("SELECT * FROM subscriptions WHERE active = 1").fetchall()

    eligible = 0
    skipped_already_charged = 0
    materialized = 0

    for sub in subs:
        if not _subscription_due_on_month(sub, start, end):
            continue
        eligible += 1

        exists = conn.execute(
            "SELECT 1 FROM subscription_charges WHERE subscription_id = ? AND charge_month = ?",
            (sub["id"], month_id),
        ).fetchone()
        if exists:
            skipped_already_charged += 1
            continue

        if body.dry_run:
            materialized += 1
            continue

        exp = conn.execute(
            """
            INSERT INTO expenses (expense_date, amount, description, category, kind, subscription_id)
            VALUES (?, ?, ?, ?, 'subscription', ?)
            """,
            (charge_date, sub["amount"], f"Subscription: {sub['name']}", sub["category"], sub["id"]),
        )
        conn.execute(
            """
            INSERT INTO subscription_charges (subscription_id, charge_month, expense_id)
            VALUES (?, ?, ?)
            """,
            (sub["id"], month_id, exp.lastrowid),
        )
        materialized += 1

    if not body.dry_run:
        conn.commit()
    conn.close()

    return {
        "status": "ok",
        "month": month_id,
        "dry_run": body.dry_run,
        "eligible_subscriptions": eligible,
        "materialized": materialized,
        "already_charged": skipped_already_charged,
    }


# ── POST: Set budget ──────────────────────────────────────────────────────────────
class BudgetIn(BaseModel):
    category: str
    amount: float


@app.post("/api/budgets")
def set_budget(body: BudgetIn):
    conn = get_conn()
    conn.execute(
        """INSERT INTO budgets (category, amount) VALUES (?, ?)
           ON CONFLICT(category) DO UPDATE SET amount = excluded.amount""",
        (body.category.strip(), body.amount),
    )
    conn.commit()
    conn.close()
    return {"status": "ok"}


@app.put("/api/budgets")
def update_budget(body: BudgetIn):
    conn = get_conn()
    cur = conn.execute(
        """
        UPDATE budgets
        SET amount = ?
        WHERE category = ?
        """,
        (body.amount, body.category.strip()),
    )
    if cur.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Budget not found")
    conn.commit()
    conn.close()
    return {"status": "ok"}


@app.delete("/api/budgets")
def delete_budget(category: str = Query(...)):
    conn = get_conn()
    cur = conn.execute(
        "DELETE FROM budgets WHERE category = ?",
        (category.strip(),),
    )
    if cur.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Budget not found")
    conn.commit()
    conn.close()
    return {"status": "ok"}


# ── CSV Curation (mobile-friendly transaction triage) ─────────────────────────
@app.get("/api/curation/meta")
def curation_meta(file: str | None = Query(default=None)):
    csv_path = _resolve_csv_path(file)
    categories = _load_budget_categories()
    return {
        "csv_file": str(csv_path.relative_to(ROOT_PATH)),
        "available_csv_files": _list_curation_csv_files(),
        "categories": categories,
    }


@app.get("/api/curation/transactions")
def curation_transactions(
    file: str | None = Query(default=None),
    view: str = Query(default="keep"),
    limit: int = Query(default=250, ge=1, le=2000),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
):
    csv_path = _resolve_csv_path(file)
    _, rows = _read_curation_csv(csv_path)
    parsed_from: date | None = None
    parsed_to: date | None = None
    if date_from:
        try:
            parsed_from = datetime.strptime(date_from, "%Y-%m-%d").date()
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="date_from must be YYYY-MM-DD") from exc
    if date_to:
        try:
            parsed_to = datetime.strptime(date_to, "%Y-%m-%d").date()
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="date_to must be YYYY-MM-DD") from exc
    if parsed_from and parsed_to and parsed_from > parsed_to:
        raise HTTPException(status_code=400, detail="date_from must be <= date_to")

    items: list[dict[str, Any]] = []
    for row_id, row in enumerate(rows, start=1):
        keep = _normalize_keep(row.get("keep"))
        category = (row.get("categoria_orcamento") or "").strip()
        text = (row.get("title") or row.get("description") or "").strip()
        raw_date = str(row.get("date", "")).strip()
        parsed_row_date: date | None = None
        if raw_date:
            try:
                parsed_row_date = datetime.strptime(raw_date, "%Y-%m-%d").date()
            except ValueError:
                parsed_row_date = None

        if parsed_from and (not parsed_row_date or parsed_row_date < parsed_from):
            continue
        if parsed_to and (not parsed_row_date or parsed_row_date > parsed_to):
            continue

        item = {
            "row_id": row_id,
            "keep": keep,
            "categoria_orcamento": category,
            "date": raw_date,
            "amount": row.get("amount", ""),
            "schema_type": row.get("schema_type", ""),
            "title": row.get("title", ""),
            "description": row.get("description", ""),
            "source_file": row.get("source_file", ""),
            "preview": text,
        }
        items.append(item)

    if view == "keep":
        items = [item for item in items if item["keep"]]
    elif view == "uncategorized":
        items = [item for item in items if item["keep"] and not item["categoria_orcamento"]]
    elif view != "all":
        raise HTTPException(status_code=400, detail="view must be one of: keep, uncategorized, all")

    return {
        "view": view,
        "date_from": date_from,
        "date_to": date_to,
        "total": len(items),
        "items": items[:limit],
    }


class CurationUpdateRow(BaseModel):
    row_id: int
    keep: bool | None = None
    categoria_orcamento: str | None = None


class CurationUpdatePayload(BaseModel):
    file: str | None = None
    updates: list[CurationUpdateRow]


@app.post("/api/curation/transactions")
def curation_update_transactions(payload: CurationUpdatePayload):
    csv_path = _resolve_csv_path(payload.file)
    fieldnames, rows = _read_curation_csv(csv_path)

    changed = 0
    for update in payload.updates:
        if update.row_id < 1 or update.row_id > len(rows):
            raise HTTPException(status_code=400, detail=f"Invalid row_id: {update.row_id}")
        row = rows[update.row_id - 1]

        if update.keep is not None:
            row["keep"] = "true" if update.keep else "false"
            changed += 1

        if update.categoria_orcamento is not None:
            row["categoria_orcamento"] = update.categoria_orcamento.strip()
            changed += 1

    _write_curation_csv(csv_path, fieldnames, rows)
    return {
        "status": "ok",
        "changed_fields": changed,
        "csv_file": str(csv_path.relative_to(ROOT_PATH)),
    }


class CurationDateRangePayload(BaseModel):
    file: str | None = None
    date_from: str
    date_to: str


@app.post("/api/curation/date-range")
def curation_apply_date_range(payload: CurationDateRangePayload):
    csv_path = _resolve_csv_path(payload.file)
    fieldnames, rows = _read_curation_csv(csv_path)
    try:
        parsed_from = datetime.strptime(payload.date_from, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="date_from must be YYYY-MM-DD") from exc
    try:
        parsed_to = datetime.strptime(payload.date_to, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="date_to must be YYYY-MM-DD") from exc
    if parsed_from > parsed_to:
        raise HTTPException(status_code=400, detail="date_from must be <= date_to")

    dropped_outside = 0
    invalid_date = 0
    changed_rows = 0
    for row in rows:
        raw_date = str(row.get("date", "")).strip()
        try:
            row_date = datetime.strptime(raw_date, "%Y-%m-%d").date()
        except ValueError:
            row_date = None
            invalid_date += 1

        in_range = bool(row_date and parsed_from <= row_date <= parsed_to)
        if not in_range:
            dropped_outside += 1
            if _normalize_keep(row.get("keep")):
                row["keep"] = "false"
                changed_rows += 1

    if changed_rows:
        _write_curation_csv(csv_path, fieldnames, rows)
    return {
        "status": "ok",
        "csv_file": str(csv_path.relative_to(ROOT_PATH)),
        "date_from": payload.date_from,
        "date_to": payload.date_to,
        "dropped_outside_range": dropped_outside,
        "invalid_date_rows": invalid_date,
        "changed_rows": changed_rows,
    }


class CurationImportPayload(BaseModel):
    file: str | None = None
    require_category: bool = True


@app.post("/api/curation/import-expenses")
def curation_import_expenses(payload: CurationImportPayload):
    csv_path = _resolve_csv_path(payload.file)
    _, rows = _read_curation_csv(csv_path)
    conn = get_conn()

    imported = 0
    skipped_not_keep = 0
    skipped_missing_category = 0
    skipped_invalid_date = 0
    skipped_invalid_amount = 0
    skipped_non_expense_amount = 0
    skipped_duplicates = 0
    by_month: dict[str, int] = defaultdict(int)

    for row in rows:
        if not _normalize_keep(row.get("keep")):
            skipped_not_keep += 1
            continue

        category = (row.get("categoria_orcamento") or "").strip()
        if payload.require_category and not category:
            skipped_missing_category += 1
            continue
        if not category:
            category = "Sem Categoria"

        raw_date = str(row.get("date", "")).strip()
        try:
            tx_date = datetime.strptime(raw_date, "%Y-%m-%d").date().isoformat()
        except ValueError:
            skipped_invalid_date += 1
            continue

        amount = _parse_curation_amount(row.get("amount"))
        if amount is None:
            skipped_invalid_amount += 1
            continue
        if amount <= 0:
            skipped_non_expense_amount += 1
            continue

        description = (
            str(row.get("title") or "").strip()
            or str(row.get("description") or "").strip()
            or "Transação importada de CSV"
        )

        exists = conn.execute(
            """
            SELECT 1 FROM expenses
            WHERE expense_date = ? AND amount = ? AND description = ? AND category = ? AND kind = 'one_off'
            """,
            (tx_date, amount, description, category),
        ).fetchone()
        if exists:
            skipped_duplicates += 1
            continue

        conn.execute(
            """
            INSERT INTO expenses (expense_date, amount, description, category, kind)
            VALUES (?, ?, ?, ?, 'one_off')
            """,
            (tx_date, amount, description, category),
        )
        imported += 1
        by_month[tx_date[:7]] += 1

    conn.commit()
    conn.close()

    return {
        "status": "ok",
        "csv_file": str(csv_path.relative_to(ROOT_PATH)),
        "imported_expenses": imported,
        "imported_by_month": dict(sorted(by_month.items())),
        "skipped": {
            "not_keep": skipped_not_keep,
            "missing_category": skipped_missing_category,
            "invalid_date": skipped_invalid_date,
            "invalid_amount": skipped_invalid_amount,
            "non_expense_amount": skipped_non_expense_amount,
            "duplicates": skipped_duplicates,
        },
    }


@app.post("/api/curation/export")
def curation_export_keep_only(file: str | None = Query(default=None)):
    csv_path = _resolve_csv_path(file)
    fieldnames, rows = _read_curation_csv(csv_path)

    kept_rows = [row for row in rows if _normalize_keep(row.get("keep"))]
    out_path = csv_path.with_name(f"{csv_path.stem}_keep_categorized.csv")
    _write_curation_csv(out_path, fieldnames, kept_rows)

    return {
        "status": "ok",
        "input_file": str(csv_path.relative_to(ROOT_PATH)),
        "output_file": str(out_path.relative_to(ROOT_PATH)),
        "rows_exported": len(kept_rows),
    }
