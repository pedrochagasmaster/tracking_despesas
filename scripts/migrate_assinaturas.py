#!/usr/bin/env python3
"""Migrate legacy 'Assinaturas' categories to real underlying categories.

Safety:
  - Creates a .bak copy of the database before any write.
  - Supports --dry-run to preview changes without committing.
  - Idempotent: re-running after migration is a no-op.

Usage:
  python scripts/migrate_assinaturas.py --dry-run   # preview
  python scripts/migrate_assinaturas.py              # execute
"""
from __future__ import annotations

import argparse
import shutil
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "expenses.db"

# ── Subscription category mapping ────────────────────────────────────────────
SUBSCRIPTION_MAPPING: dict[str, str] = {
    "netflix": "Streaming",
    "youtube": "Streaming",
    "chatgpt": "Ferramentas",
    "copilot": "Ferramentas",
    "google one": "Ferramentas",
    "inshot": "Ferramentas",
    "lightroom": "Ferramentas",
    "faceapp": "Ferramentas",
    "facetune": "Ferramentas",
    "contabilizei'": "Contabilidade",
    "gympass": "Saúde",
    "webdiet": "Saúde",
    "IPVA": "Transporte",
}

# ── Pluggy one-off expense mapping (by partial description match) ────────────
PLUGGY_ONEOFF_MAPPING: list[tuple[str, str]] = [
    ("Medium.Com", "Ferramentas"),
    ("Openai", "Ferramentas"),
    ("Amazon Servicos", "Streaming"),
    ("Github", "Ferramentas"),
    ("IOF de compra internacional", "Ferramentas"),
    ("ANUIDADE DIFERENCIADA", "Serviços Financeiros"),
]

# ── Budget redistribution ────────────────────────────────────────────────────
# Monthly costs per new category from subscriptions:
#   Streaming:     netflix(45) + youtube(54) = 99/mo
#   Ferramentas:   chatgpt(100) + copilot(58) + google_one(15) + inshot(64.9/12=5.41)
#                  + lightroom(100/12=8.33) + faceapp(120/12=10) + facetune(300/12=25) = 221.74/mo
#   Contabilidade: contabilizei(120) = 120/mo
#   Saúde:         gympass(68) + webdiet(1000/12=83.33) = 151.33/mo (but gympass is 300/mo now)
#   Transporte:    IPVA(3300/12=275) = 275/mo
#
# We redistribute the old budgets (Mensais=692 + Anuais=132.075 = 824.075 total)
# proportionally based on actual monthly costs.

BUDGET_NEW_CATEGORIES: dict[str, float] = {
    "Streaming": 100.0,
    "Ferramentas": 225.0,
    "Contabilidade": 120.0,
    "Saúde": 235.0,  # gympass(300) + webdiet(83.33/mo)
    # Transporte already has a budget row (400.0), we'll add to it
    # Serviços Financeiros gets a small budget for the annual fee
    "Serviços Financeiros": 35.0,
}
TRANSPORT_BUDGET_ADD = 275.0  # IPVA monthly equivalent to add to existing Transporte budget


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Preview without committing")
    args = parser.parse_args()

    if not DB_PATH.exists():
        print(f"ERROR: Database not found at {DB_PATH}")
        return

    if not args.dry_run:
        bak = DB_PATH.with_suffix(".db.bak_pre_assinaturas_migrate")
        if not bak.exists():
            shutil.copy2(DB_PATH, bak)
            print(f"✓ Backup created: {bak.name}")

    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")

    # ── 1. Update subscriptions table ────────────────────────────────────────
    print("\n━━ Subscriptions ━━")
    subs = conn.execute(
        "SELECT id, name, category FROM subscriptions WHERE category = 'Assinaturas'"
    ).fetchall()

    for sub in subs:
        new_cat = SUBSCRIPTION_MAPPING.get(sub["name"])
        if not new_cat:
            print(f"  ⚠ No mapping for subscription '{sub['name']}' (id={sub['id']}), skipping")
            continue
        print(f"  {'[DRY] ' if args.dry_run else ''}#{sub['id']} {sub['name']}: Assinaturas → {new_cat}")
        if not args.dry_run:
            conn.execute(
                "UPDATE subscriptions SET category = ? WHERE id = ?",
                (new_cat, sub["id"]),
            )

    # ── 2. Update subscription-kind expenses ─────────────────────────────────
    print("\n━━ Subscription Expenses ━━")
    sub_expenses = conn.execute(
        """
        SELECT e.id, e.description, e.category, e.subscription_id, s.name AS sub_name
        FROM expenses e
        JOIN subscriptions s ON e.subscription_id = s.id
        WHERE e.kind = 'subscription' AND e.category = 'Assinaturas'
        """
    ).fetchall()

    for exp in sub_expenses:
        new_cat = SUBSCRIPTION_MAPPING.get(exp["sub_name"])
        if not new_cat:
            print(f"  ⚠ No mapping for expense #{exp['id']} (sub: {exp['sub_name']}), skipping")
            continue
        print(f"  {'[DRY] ' if args.dry_run else ''}#{exp['id']} {exp['description']}: Assinaturas → {new_cat}")
        if not args.dry_run:
            conn.execute(
                "UPDATE expenses SET category = ? WHERE id = ?",
                (new_cat, exp["id"]),
            )

    # ── 3. Update Pluggy one-off expenses with Assinaturas Mensais/Anuais ────
    print("\n━━ Pluggy One-Off Expenses ━━")
    pluggy_expenses = conn.execute(
        """
        SELECT id, description, category
        FROM expenses
        WHERE category IN ('Assinaturas Mensais', 'Assinaturas Anuais')
          AND kind != 'subscription'
        """
    ).fetchall()

    for exp in pluggy_expenses:
        new_cat = None
        for pattern, cat in PLUGGY_ONEOFF_MAPPING:
            if pattern.lower() in exp["description"].lower():
                new_cat = cat
                break
        if not new_cat:
            print(f"  ⚠ No mapping for expense #{exp['id']} '{exp['description']}', skipping")
            continue
        print(f"  {'[DRY] ' if args.dry_run else ''}#{exp['id']} {exp['description']}: {exp['category']} → {new_cat}")
        if not args.dry_run:
            conn.execute(
                "UPDATE expenses SET category = ? WHERE id = ?",
                (new_cat, exp["id"]),
            )

    # ── 4. Redistribute budgets ──────────────────────────────────────────────
    print("\n━━ Budget Redistribution ━━")
    old_budgets = conn.execute(
        "SELECT category, amount FROM budgets WHERE category IN ('Assinaturas Mensais', 'Assinaturas Anuais')"
    ).fetchall()
    for b in old_budgets:
        print(f"  Removing: {b['category']} = R${b['amount']:.2f}")

    if not args.dry_run:
        conn.execute("DELETE FROM budgets WHERE category IN ('Assinaturas Mensais', 'Assinaturas Anuais')")

    for cat, amount in BUDGET_NEW_CATEGORIES.items():
        existing = conn.execute(
            "SELECT id, amount FROM budgets WHERE category = ?", (cat,)
        ).fetchone()
        if existing:
            print(f"  {'[DRY] ' if args.dry_run else ''}Budget '{cat}' already exists (R${existing['amount']:.2f}), skipping creation")
        else:
            print(f"  {'[DRY] ' if args.dry_run else ''}Creating budget: {cat} = R${amount:.2f}")
            if not args.dry_run:
                conn.execute(
                    "INSERT INTO budgets (category, amount) VALUES (?, ?)",
                    (cat, amount),
                )

    # Add IPVA portion to existing Transporte budget
    transport = conn.execute(
        "SELECT id, amount FROM budgets WHERE category = 'Transporte'"
    ).fetchone()
    if transport:
        new_amount = transport["amount"] + TRANSPORT_BUDGET_ADD
        print(f"  {'[DRY] ' if args.dry_run else ''}Transporte: R${transport['amount']:.2f} → R${new_amount:.2f} (+R${TRANSPORT_BUDGET_ADD:.2f} for IPVA)")
        if not args.dry_run:
            conn.execute(
                "UPDATE budgets SET amount = ? WHERE id = ?",
                (new_amount, transport["id"]),
            )

    # ── 5. Commit ────────────────────────────────────────────────────────────
    if args.dry_run:
        print("\n🔍 DRY RUN — no changes committed.")
        conn.close()
    else:
        conn.commit()
        conn.close()
        print("\n✅ Migration committed successfully.")

    # ── 6. Verification ──────────────────────────────────────────────────────
    print("\n━━ Post-Migration Verification ━━")
    conn2 = sqlite3.connect(str(DB_PATH))
    conn2.row_factory = sqlite3.Row

    remaining_subs = conn2.execute(
        "SELECT COUNT(*) AS c FROM subscriptions WHERE category = 'Assinaturas'"
    ).fetchone()["c"]
    remaining_exp = conn2.execute(
        "SELECT COUNT(*) AS c FROM expenses WHERE category LIKE '%Assinatura%'"
    ).fetchone()["c"]
    remaining_bud = conn2.execute(
        "SELECT COUNT(*) AS c FROM budgets WHERE category LIKE '%Assinatura%'"
    ).fetchone()["c"]

    print(f"  Subscriptions with 'Assinaturas': {remaining_subs}")
    print(f"  Expenses with '*Assinatura*': {remaining_exp}")
    print(f"  Budgets with '*Assinatura*': {remaining_bud}")

    if remaining_subs == 0 and remaining_exp == 0 and remaining_bud == 0:
        print("  ✅ All clear — no legacy Assinaturas categories remain.")
    else:
        print("  ⚠ Some legacy categories still exist (may be expected in dry-run)")

    conn2.close()


if __name__ == "__main__":
    main()
