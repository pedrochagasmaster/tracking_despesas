#!/usr/bin/env python3
from __future__ import annotations

import argparse
import calendar
import sqlite3
import zipfile
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Iterable
import xml.etree.ElementTree as ET

DB_DEFAULT = "expenses.db"


@dataclass
class MonthWindow:
    start: date
    end: date


def parse_date(value: str) -> date:
    return datetime.strptime(value, "%Y-%m-%d").date()


def parse_month(value: str) -> MonthWindow:
    dt = datetime.strptime(value, "%Y-%m")
    start = date(dt.year, dt.month, 1)
    last_day = calendar.monthrange(dt.year, dt.month)[1]
    end = date(dt.year, dt.month, last_day)
    return MonthWindow(start=start, end=end)


def month_key(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def shift_month(base: date, offset: int) -> date:
    year = base.year + (base.month - 1 + offset) // 12
    month = (base.month - 1 + offset) % 12 + 1
    day = min(base.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def connect(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            expense_date TEXT NOT NULL,
            amount REAL NOT NULL CHECK(amount >= 0),
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            kind TEXT NOT NULL CHECK(kind IN ('one_off', 'subscription', 'installment')),
            subscription_id INTEGER,
            installment_id INTEGER,
            installment_number INTEGER,
            installment_total INTEGER,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(subscription_id) REFERENCES subscriptions(id),
            FOREIGN KEY(installment_id) REFERENCES installments(id)
        );

        CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            amount REAL NOT NULL CHECK(amount >= 0),
            category TEXT NOT NULL,
            frequency TEXT NOT NULL CHECK(frequency IN ('monthly', 'yearly')),
            start_date TEXT NOT NULL,
            end_date TEXT,
            active INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS subscription_charges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subscription_id INTEGER NOT NULL,
            charge_month TEXT NOT NULL,
            expense_id INTEGER NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(subscription_id, charge_month),
            FOREIGN KEY(subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
            FOREIGN KEY(expense_id) REFERENCES expenses(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS installments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            total_amount REAL NOT NULL CHECK(total_amount >= 0),
            installment_count INTEGER NOT NULL CHECK(installment_count > 0),
            start_date TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            budget_month TEXT NOT NULL,
            category TEXT NOT NULL,
            amount REAL NOT NULL CHECK(amount >= 0),
            UNIQUE(budget_month, category)
        );

        CREATE TABLE IF NOT EXISTS incomes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            income_date TEXT NOT NULL,
            amount REAL NOT NULL CHECK(amount >= 0),
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        """
    )
    conn.commit()


def add_expense(conn: sqlite3.Connection, args: argparse.Namespace) -> None:
    expense_date = parse_date(args.date)
    conn.execute(
        """
        INSERT INTO expenses (expense_date, amount, description, category, kind)
        VALUES (?, ?, ?, ?, 'one_off')
        """,
        (expense_date.isoformat(), args.amount, args.description.strip(), args.category.strip()),
    )
    conn.commit()
    print(f"Added one-off expense on {expense_date}: {args.category} ${args.amount:.2f}")


def add_income(conn: sqlite3.Connection, args: argparse.Namespace) -> None:
    income_date = parse_date(args.date)
    conn.execute(
        """
        INSERT INTO incomes (income_date, amount, description, category)
        VALUES (?, ?, ?, ?)
        """,
        (income_date.isoformat(), args.amount, args.description.strip(), args.category.strip()),
    )
    conn.commit()
    print(f"Added income on {income_date}: {args.category} ${args.amount:.2f}")


def add_subscription(conn: sqlite3.Connection, args: argparse.Namespace) -> None:
    start_date = parse_date(args.start_date)
    end_date = parse_date(args.end_date) if args.end_date else None
    cur = conn.execute(
        """
        INSERT INTO subscriptions (name, amount, category, frequency, start_date, end_date)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            args.name.strip(),
            args.amount,
            args.category.strip(),
            args.frequency,
            start_date.isoformat(),
            end_date.isoformat() if end_date else None,
        ),
    )
    conn.commit()
    print(f"Registered subscription #{cur.lastrowid}: {args.name} (${args.amount:.2f}, {args.frequency})")


def expected_monthly_amount(sub: sqlite3.Row) -> float:
    return float(sub["amount"]) if sub["frequency"] == "monthly" else float(sub["amount"]) / 12.0


def subscription_due_on_month(sub: sqlite3.Row, month: MonthWindow) -> bool:
    start = parse_date(sub["start_date"])
    if start > month.end:
        return False

    if sub["end_date"]:
        end = parse_date(sub["end_date"])
        if end < month.start:
            return False

    if sub["frequency"] == "monthly":
        return True

    # yearly: due when month/day cycle matches from start date
    for y in range(month.start.year - 1, month.start.year + 2):
        due_date = date(y, start.month, min(start.day, calendar.monthrange(y, start.month)[1]))
        if month.start <= due_date <= month.end:
            return True
    return False


def run_subscriptions(conn: sqlite3.Connection, args: argparse.Namespace) -> None:
    month = parse_month(args.month)
    month_id = month_key(month.start)
    subs = conn.execute(
        "SELECT * FROM subscriptions WHERE active = 1"
    ).fetchall()

    inserted = 0
    for sub in subs:
        if not subscription_due_on_month(sub, month):
            continue

        exists = conn.execute(
            "SELECT 1 FROM subscription_charges WHERE subscription_id = ? AND charge_month = ?",
            (sub["id"], month_id),
        ).fetchone()
        if exists:
            continue

        if args.dry_run:
            print(
                f"Would charge subscription #{sub['id']} ({sub['name']}) ${sub['amount']:.2f} for {month_id}"
            )
            inserted += 1
            continue

        charge_date = date(month.start.year, month.start.month, 1).isoformat()
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
        inserted += 1

    conn.commit()
    action = "Planned" if args.dry_run else "Recorded"
    print(f"{action} {inserted} subscription charge(s) for {month_id}.")


def add_installment(conn: sqlite3.Connection, args: argparse.Namespace) -> None:
    start = parse_date(args.start_date)
    count = args.installments
    each_amount = round(args.total_amount / count, 2)
    amounts = [each_amount] * count
    diff = round(args.total_amount - each_amount * count, 2)
    amounts[-1] += diff

    cur = conn.execute(
        """
        INSERT INTO installments (description, category, total_amount, installment_count, start_date)
        VALUES (?, ?, ?, ?, ?)
        """,
        (args.description.strip(), args.category.strip(), args.total_amount, count, start.isoformat()),
    )
    installment_id = cur.lastrowid

    for i in range(count):
        due = shift_month(start, i)
        conn.execute(
            """
            INSERT INTO expenses (
                expense_date,
                amount,
                description,
                category,
                kind,
                installment_id,
                installment_number,
                installment_total
            )
            VALUES (?, ?, ?, ?, 'installment', ?, ?, ?)
            """,
            (
                due.isoformat(),
                amounts[i],
                args.description.strip(),
                args.category.strip(),
                installment_id,
                i + 1,
                count,
            ),
        )

    conn.commit()
    print(
        f"Registered installment purchase #{installment_id}: {args.description} "
        f"({count}x, total ${args.total_amount:.2f})"
    )


def set_budget(conn: sqlite3.Connection, args: argparse.Namespace) -> None:
    _ = parse_month(args.month)
    conn.execute(
        """
        INSERT INTO budgets (budget_month, category, amount)
        VALUES (?, ?, ?)
        ON CONFLICT(budget_month, category)
        DO UPDATE SET amount = excluded.amount
        """,
        (args.month, args.category.strip(), args.amount),
    )
    conn.commit()
    print(f"Budget set for {args.month} / {args.category}: ${args.amount:.2f}")


def month_incomes(conn: sqlite3.Connection, month: MonthWindow) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT * FROM incomes
        WHERE income_date >= ? AND income_date <= ?
        ORDER BY income_date ASC, id ASC
        """,
        (month.start.isoformat(), month.end.isoformat()),
    ).fetchall()


def month_expenses(conn: sqlite3.Connection, month: MonthWindow) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT * FROM expenses
        WHERE expense_date >= ? AND expense_date <= ?
        ORDER BY expense_date ASC, id ASC
        """,
        (month.start.isoformat(), month.end.isoformat()),
    ).fetchall()


def category_totals(rows: Iterable[sqlite3.Row]) -> dict[str, float]:
    totals: dict[str, float] = defaultdict(float)
    for row in rows:
        totals[row["category"]] += float(row["amount"])
    return dict(totals)


def print_currency(value: float) -> str:
    return f"${value:,.2f}"


def excel_serial_to_date(value: float) -> date:
    base = date(1899, 12, 30)
    return base.fromordinal(base.toordinal() + int(value))


def _extract_cell_value(cell: ET.Element, shared_strings: list[str], ns: dict[str, str]) -> str:
    cell_type = cell.attrib.get("t")
    value_node = cell.find("a:v", ns)
    if value_node is None or value_node.text is None:
        return ""
    raw = value_node.text.strip()
    if cell_type == "s":
        idx = int(raw)
        return shared_strings[idx] if 0 <= idx < len(shared_strings) else ""
    return raw


def read_xlsx_sheet_rows(xlsx_file: Path, sheet_name: str) -> list[list[str]]:
    ns = {
        "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
        "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        "pr": "http://schemas.openxmlformats.org/package/2006/relationships",
    }
    with zipfile.ZipFile(xlsx_file) as zf:
        workbook = ET.fromstring(zf.read("xl/workbook.xml"))
        rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
        rel_map = {r.attrib["Id"]: r.attrib["Target"] for r in rels.findall("pr:Relationship", ns)}

        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in zf.namelist():
            shared = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for si in shared.findall("a:si", ns):
                text = "".join(node.text or "" for node in si.findall(".//a:t", ns))
                shared_strings.append(text)

        target = None
        for sheet in workbook.findall("a:sheets/a:sheet", ns):
            if sheet.attrib.get("name") != sheet_name:
                continue
            rid = sheet.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
            if rid:
                target = rel_map.get(rid)
            break

        if not target:
            return []

        sheet_path = f"xl/{target}".replace("xl//", "xl/")
        ws = ET.fromstring(zf.read(sheet_path))
        rows: list[list[str]] = []
        for row in ws.findall("a:sheetData/a:row", ns):
            items = [_extract_cell_value(cell, shared_strings, ns) for cell in row.findall("a:c", ns)]
            rows.append(items)
        return rows


def _parse_excel_date(raw: str) -> date | None:
    if not raw:
        return None
    try:
        if "." in raw:
            return excel_serial_to_date(float(raw))
        return excel_serial_to_date(float(int(raw)))
    except (ValueError, TypeError):
        try:
            return parse_date(raw)
        except ValueError:
            return None


def import_excel(conn: sqlite3.Connection, args: argparse.Namespace) -> None:
    xlsx_file = Path(args.file)
    if not xlsx_file.exists():
        raise SystemExit(f"Excel file not found: {xlsx_file}")

    tx_rows = read_xlsx_sheet_rows(xlsx_file, "Transações")
    as_rows = read_xlsx_sheet_rows(xlsx_file, "Assinaturas")

    imported_expenses = 0
    imported_incomes = 0
    imported_subs = 0

    for row in tx_rows[4:]:
        if len(row) >= 5:
            d, amount, desc, category = row[1], row[2], row[3], row[4]
            exp_date = _parse_excel_date(d)
            if exp_date and amount and desc and category:
                if args.month and month_key(exp_date) != args.month:
                    pass
                else:
                    amount_value = float(amount)
                    exists = conn.execute(
                        """
                        SELECT 1 FROM expenses
                        WHERE expense_date = ? AND amount = ? AND description = ? AND category = ? AND kind = 'one_off'
                        """,
                        (exp_date.isoformat(), amount_value, desc.strip(), category.strip()),
                    ).fetchone()
                    if not exists:
                        conn.execute(
                            """
                            INSERT INTO expenses (expense_date, amount, description, category, kind)
                            VALUES (?, ?, ?, ?, 'one_off')
                            """,
                            (exp_date.isoformat(), amount_value, desc.strip(), category.strip()),
                        )
                        imported_expenses += 1

        if len(row) >= 10:
            d, amount, desc, category = row[6], row[7], row[8], row[9]
            inc_date = _parse_excel_date(d)
            if inc_date and amount and desc and category:
                if args.month and month_key(inc_date) != args.month:
                    continue
                amount_value = float(amount)
                exists = conn.execute(
                    """
                    SELECT 1 FROM incomes
                    WHERE income_date = ? AND amount = ? AND description = ? AND category = ?
                    """,
                    (inc_date.isoformat(), amount_value, desc.strip(), category.strip()),
                ).fetchone()
                if not exists:
                    conn.execute(
                        """
                        INSERT INTO incomes (income_date, amount, description, category)
                        VALUES (?, ?, ?, ?)
                        """,
                        (inc_date.isoformat(), amount_value, desc.strip(), category.strip()),
                    )
                    imported_incomes += 1

    if args.import_subscriptions:
        current_frequency = "monthly"
        for row in as_rows:
            name = row[0].strip() if row else ""
            if not name:
                continue

            lowered = name.lower()
            if "assinaturas anuais" in lowered:
                current_frequency = "yearly"
                continue
            if "assinaturas" in lowered:
                current_frequency = "monthly"
                continue
            if len(row) < 2:
                continue
            amount = row[1].strip()
            if not amount:
                continue
            try:
                amount_value = float(amount)
            except ValueError:
                continue
            exists = conn.execute(
                """
                SELECT 1 FROM subscriptions
                WHERE lower(name) = lower(?) AND amount = ? AND frequency = ?
                """,
                (name, amount_value, current_frequency),
            ).fetchone()
            if exists:
                continue
            conn.execute(
                """
                INSERT INTO subscriptions (name, amount, category, frequency, start_date)
                VALUES (?, ?, ?, ?, ?)
                """,
                (name, amount_value, "Assinaturas", current_frequency, date.today().isoformat()),
            )
            imported_subs += 1

    conn.commit()
    print(
        f"Imported {imported_expenses} expense(s), {imported_incomes} income(s), "
        f"{imported_subs} subscription(s) from {xlsx_file}."
    )


def report_month(conn: sqlite3.Connection, args: argparse.Namespace) -> None:
    month = parse_month(args.month)
    expense_rows = month_expenses(conn, month)
    income_rows = month_incomes(conn, month)
    totals = category_totals(expense_rows)
    spent = sum(totals.values())
    earned = sum(float(r["amount"]) for r in income_rows)
    net = earned - spent
    savings_rate = (net / earned * 100.0) if earned > 0 else 0.0

    budget_rows = conn.execute(
        "SELECT category, amount FROM budgets WHERE budget_month = ?",
        (args.month,),
    ).fetchall()
    budget_map = {r["category"]: float(r["amount"]) for r in budget_rows}

    print(f"Month: {args.month}")
    print(f"Total earned: {print_currency(earned)}")
    print(f"Total spent: {print_currency(spent)}")
    print(f"Net savings: {print_currency(net)} ({savings_rate:.1f}% savings rate)")

    if totals:
        print("\nSpending by category:")
        for category, amount in sorted(totals.items(), key=lambda x: x[1], reverse=True):
            print(f"- {category}: {print_currency(amount)}")
    else:
        print("\nNo expenses in this month.")

    if budget_map:
        print("\nBudget status:")
        total_budget = sum(budget_map.values())
        remaining_total = total_budget - spent
        print(
            f"- Total budget: {print_currency(total_budget)} | Remaining: {print_currency(remaining_total)}"
        )

        all_categories = sorted(set(budget_map) | set(totals))
        for category in all_categories:
            budget = budget_map.get(category, 0.0)
            actual = totals.get(category, 0.0)
            remaining = budget - actual
            marker = "OVER" if remaining < 0 else "OK"
            print(
                f"- {category}: budget {print_currency(budget)} | spent {print_currency(actual)} "
                f"| remaining {print_currency(remaining)} [{marker}]"
            )


def report_trends(conn: sqlite3.Connection, args: argparse.Namespace) -> None:
    today = date.today().replace(day=1)
    months = [shift_month(today, -i) for i in reversed(range(args.months))]
    print(f"Spending trend (last {args.months} month(s)):")

    for m_start in months:
        m_key = month_key(m_start)
        win = parse_month(m_key)
        expense_rows = month_expenses(conn, win)
        income_rows = month_incomes(conn, win)
        total_expense = sum(float(r["amount"]) for r in expense_rows)
        total_income = sum(float(r["amount"]) for r in income_rows)
        net = total_income - total_expense
        print(
            f"- {m_key}: spent {print_currency(total_expense)} | "
            f"earned {print_currency(total_income)} | net {print_currency(net)}"
        )


def last_n_month_keys(month: MonthWindow, n: int) -> list[str]:
    return [month_key(shift_month(month.start, -i)) for i in range(1, n + 1)]


def report_savings(conn: sqlite3.Connection, args: argparse.Namespace) -> None:
    month = parse_month(args.month)
    rows = month_expenses(conn, month)
    income_rows = month_incomes(conn, month)
    if not rows and not income_rows:
        print(f"No expenses found for {args.month}.")
        return

    totals = category_totals(rows)
    spent = sum(totals.values())
    earned = sum(float(r["amount"]) for r in income_rows)
    net = earned - spent
    savings_rate = (net / earned * 100.0) if earned > 0 else 0.0
    print(f"Saving opportunities for {args.month}:")
    print(
        f"- Snapshot: earned {print_currency(earned)} | spent {print_currency(spent)} "
        f"| net {print_currency(net)} | savings rate {savings_rate:.1f}%"
    )

    if earned > 0 and savings_rate < args.target_rate:
        monthly_target = earned * args.target_rate / 100.0
        gap = monthly_target - net
        print(
            f"- To reach target savings rate {args.target_rate:.1f}%, "
            f"reduce expenses or raise income by {print_currency(max(gap, 0.0))}."
        )

    budget_rows = conn.execute(
        "SELECT category, amount FROM budgets WHERE budget_month = ?",
        (args.month,),
    ).fetchall()
    budget_map = {r["category"]: float(r["amount"]) for r in budget_rows}

    over_budget = []
    for cat, budget in budget_map.items():
        actual = totals.get(cat, 0.0)
        if actual > budget:
            over_budget.append((cat, actual - budget, actual, budget))

    if over_budget:
        print("\n1) Over-budget categories:")
        for cat, excess, actual, budget in sorted(over_budget, key=lambda x: x[1], reverse=True):
            print(
                f"- {cat}: exceeded by {print_currency(excess)} "
                f"(spent {print_currency(actual)} / budget {print_currency(budget)})"
            )
    else:
        print("\n1) Over-budget categories: none")

    sub_rows = conn.execute("SELECT * FROM subscriptions WHERE active = 1").fetchall()
    sub_monthly = [(s["name"], expected_monthly_amount(s), s["category"]) for s in sub_rows]
    sub_monthly.sort(key=lambda x: x[1], reverse=True)

    if sub_monthly:
        print("\n2) Subscription review candidates:")
        for name, monthly_equivalent, category in sub_monthly[:5]:
            share = (monthly_equivalent / spent * 100.0) if spent else 0.0
            print(
                f"- {name} ({category}): {print_currency(monthly_equivalent)}/month "
                f"(~{share:.1f}% of this month's spend)"
            )
    else:
        print("\n2) Subscription review candidates: no active subscriptions")

    prev_keys = last_n_month_keys(month, 3)
    prev_totals: dict[str, list[float]] = defaultdict(list)
    for mk in prev_keys:
        prev_rows = month_expenses(conn, parse_month(mk))
        pt = category_totals(prev_rows)
        for cat, amount in pt.items():
            prev_totals[cat].append(amount)

    spikes = []
    for cat, current in totals.items():
        hist = prev_totals.get(cat)
        if not hist:
            continue
        avg = sum(hist) / len(hist)
        if avg <= 0:
            continue
        if current > avg * 1.3:
            spikes.append((cat, current, avg, current - avg))

    if spikes:
        print("\n3) Category spikes (>30% vs prior 3-month average):")
        for cat, current, avg, diff in sorted(spikes, key=lambda x: x[3], reverse=True):
            print(
                f"- {cat}: {print_currency(current)} vs avg {print_currency(avg)} "
                f"(+{print_currency(diff)})"
            )
    else:
        print("\n3) Category spikes: none detected")


def list_data(conn: sqlite3.Connection, args: argparse.Namespace) -> None:
    if args.entity == "expenses":
        rows = conn.execute(
            "SELECT * FROM expenses ORDER BY expense_date DESC, id DESC LIMIT ?", (args.limit,)
        ).fetchall()
        for row in rows:
            extra = ""
            if row["kind"] == "installment":
                extra = f" [{row['installment_number']}/{row['installment_total']}]"
            print(
                f"#{row['id']} {row['expense_date']} {row['kind']} {row['category']} "
                f"{print_currency(row['amount'])} - {row['description']}{extra}"
            )
    elif args.entity == "subscriptions":
        rows = conn.execute("SELECT * FROM subscriptions ORDER BY id DESC").fetchall()
        for row in rows:
            print(
                f"#{row['id']} {row['name']} {print_currency(row['amount'])} {row['frequency']} "
                f"({row['category']}) start={row['start_date']} active={bool(row['active'])}"
            )
    elif args.entity == "budgets":
        rows = conn.execute(
            "SELECT * FROM budgets ORDER BY budget_month DESC, category ASC"
        ).fetchall()
        for row in rows:
            print(f"{row['budget_month']} {row['category']} {print_currency(row['amount'])}")
    elif args.entity == "incomes":
        rows = conn.execute(
            "SELECT * FROM incomes ORDER BY income_date DESC, id DESC LIMIT ?", (args.limit,)
        ).fetchall()
        for row in rows:
            print(
                f"#{row['id']} {row['income_date']} {row['category']} "
                f"{print_currency(row['amount'])} - {row['description']}"
            )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Expenses tracking CLI")
    parser.add_argument("--db", default=DB_DEFAULT, help=f"SQLite file (default: {DB_DEFAULT})")

    sub = parser.add_subparsers(dest="command", required=True)

    init_cmd = sub.add_parser("init", help="Initialize database")
    init_cmd.set_defaults(func=lambda conn, _args: print("Database initialized."))

    add_exp = sub.add_parser("add-expense", help="Log a one-off expense")
    add_exp.add_argument("--date", default=date.today().isoformat(), help="YYYY-MM-DD")
    add_exp.add_argument("--amount", type=float, required=True)
    add_exp.add_argument("--category", required=True)
    add_exp.add_argument("--description", required=True)
    add_exp.set_defaults(func=add_expense)

    add_inc = sub.add_parser("add-income", help="Log an income entry")
    add_inc.add_argument("--date", default=date.today().isoformat(), help="YYYY-MM-DD")
    add_inc.add_argument("--amount", type=float, required=True)
    add_inc.add_argument("--category", required=True)
    add_inc.add_argument("--description", required=True)
    add_inc.set_defaults(func=add_income)

    add_sub = sub.add_parser("add-subscription", help="Register a recurring subscription")
    add_sub.add_argument("--name", required=True)
    add_sub.add_argument("--amount", type=float, required=True)
    add_sub.add_argument("--category", required=True)
    add_sub.add_argument("--frequency", choices=["monthly", "yearly"], default="monthly")
    add_sub.add_argument("--start-date", default=date.today().isoformat(), help="YYYY-MM-DD")
    add_sub.add_argument("--end-date", help="YYYY-MM-DD")
    add_sub.set_defaults(func=add_subscription)

    sub_run = sub.add_parser(
        "run-subscriptions",
        help="Materialize subscription charges for a month into expenses",
    )
    sub_run.add_argument("--month", required=True, help="YYYY-MM")
    sub_run.add_argument("--dry-run", action="store_true")
    sub_run.set_defaults(func=run_subscriptions)

    add_inst = sub.add_parser("add-installment", help="Register an installment purchase")
    add_inst.add_argument("--description", required=True)
    add_inst.add_argument("--category", required=True)
    add_inst.add_argument("--total-amount", type=float, required=True)
    add_inst.add_argument("--installments", type=int, required=True)
    add_inst.add_argument("--start-date", default=date.today().isoformat(), help="YYYY-MM-DD")
    add_inst.set_defaults(func=add_installment)

    budget = sub.add_parser("set-budget", help="Set budget for month/category")
    budget.add_argument("--month", required=True, help="YYYY-MM")
    budget.add_argument("--category", required=True)
    budget.add_argument("--amount", type=float, required=True)
    budget.set_defaults(func=set_budget)

    report_month_cmd = sub.add_parser("report-month", help="Show monthly spending and budget status")
    report_month_cmd.add_argument("--month", required=True, help="YYYY-MM")
    report_month_cmd.set_defaults(func=report_month)

    trends = sub.add_parser("report-trends", help="Show monthly spending trend")
    trends.add_argument("--months", type=int, default=6)
    trends.set_defaults(func=report_trends)

    savings = sub.add_parser("report-savings", help="Identify saving opportunities")
    savings.add_argument("--month", required=True, help="YYYY-MM")
    savings.add_argument("--target-rate", type=float, default=20.0, help="Target savings rate percent")
    savings.set_defaults(func=report_savings)

    import_excel_cmd = sub.add_parser("import-excel", help="Import data from workbook")
    import_excel_cmd.add_argument(
        "--file",
        default="Orçamento mensal.xlsx",
        help="Path to .xlsx workbook",
    )
    import_excel_cmd.add_argument("--month", help="Optional YYYY-MM filter while importing transactions")
    import_excel_cmd.add_argument(
        "--import-subscriptions",
        action="store_true",
        help="Also import items from sheet 'Assinaturas' as active monthly subscriptions",
    )
    import_excel_cmd.set_defaults(func=import_excel)

    list_cmd = sub.add_parser("list", help="List records")
    list_cmd.add_argument("entity", choices=["expenses", "subscriptions", "budgets", "incomes"])
    list_cmd.add_argument("--limit", type=int, default=20)
    list_cmd.set_defaults(func=list_data)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    db_file = Path(args.db)
    conn = connect(str(db_file))
    init_db(conn)

    try:
        args.func(conn, args)
    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
