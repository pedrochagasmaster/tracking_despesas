import sqlite3
import tempfile
import unittest
from pathlib import Path

import api
from expense_cli import init_db


class InboxCategoryUpdateTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.db_path = self.root / "test_expenses.db"
        self.checkpoint_dir = self.root / "checkpoints"
        self.checkpoint_index = self.checkpoint_dir / "index.jsonl"

        self.prev_db_path = api.DB_PATH
        self.prev_root = api.ROOT_PATH
        self.prev_checkpoint_dir = api.CHECKPOINT_DIR
        self.prev_checkpoint_index = api.CHECKPOINT_INDEX_PATH
        self.prev_budget_migrated = api._BUDGET_MIGRATED
        self.prev_inbox_migrated = api._INBOX_MIGRATED

        api.DB_PATH = self.db_path
        api.ROOT_PATH = self.root
        api.CHECKPOINT_DIR = self.checkpoint_dir
        api.CHECKPOINT_INDEX_PATH = self.checkpoint_index
        api._BUDGET_MIGRATED = False
        api._INBOX_MIGRATED = False

        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        init_db(conn)
        api._migrate_inbox_once(conn)
        conn.commit()
        conn.close()

    def tearDown(self) -> None:
        api.DB_PATH = self.prev_db_path
        api.ROOT_PATH = self.prev_root
        api.CHECKPOINT_DIR = self.prev_checkpoint_dir
        api.CHECKPOINT_INDEX_PATH = self.prev_checkpoint_index
        api._BUDGET_MIGRATED = self.prev_budget_migrated
        api._INBOX_MIGRATED = self.prev_inbox_migrated
        self.temp_dir.cleanup()

    def test_updating_imported_expense_category_propagates_to_expense_row(self) -> None:
        conn = api.get_conn()
        try:
            cur = conn.execute(
                """
                INSERT INTO expenses (expense_date, amount, description, category, kind)
                VALUES ('2026-04-10', 42.5, 'Mercado', 'Alimentação', 'one_off')
                """
            )
            expense_id = cur.lastrowid
            conn.execute(
                """
                INSERT INTO inbox_transactions (
                    provider, external_id, tx_date, amount, signed_amount, direction, description,
                    category, status, imported_expense_id
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "pluggy",
                    "expense-1",
                    "2026-04-10",
                    42.5,
                    -42.5,
                    "expense",
                    "Mercado",
                    "Alimentação",
                    "imported",
                    expense_id,
                ),
            )
            conn.commit()
        finally:
            conn.close()

        api.inbox_update_transactions(
            api.InboxUpdatePayload(
                updates=[api.InboxUpdateRow(id=1, category="Mercado Extra", status="imported")]
            )
        )

        conn = api.get_conn()
        try:
            inbox_row = conn.execute(
                "SELECT category FROM inbox_transactions WHERE id = 1"
            ).fetchone()
            expense_row = conn.execute(
                "SELECT category FROM expenses WHERE id = ?", (expense_id,)
            ).fetchone()
        finally:
            conn.close()

        self.assertEqual("Mercado Extra", inbox_row["category"])
        self.assertEqual("Mercado Extra", expense_row["category"])

    def test_updating_imported_income_category_propagates_to_income_row(self) -> None:
        conn = api.get_conn()
        try:
            cur = conn.execute(
                """
                INSERT INTO incomes (income_date, amount, description, category)
                VALUES ('2026-04-11', 3000, 'Empresa X', 'Salário')
                """
            )
            income_id = cur.lastrowid
            conn.execute(
                """
                INSERT INTO inbox_transactions (
                    provider, external_id, tx_date, amount, signed_amount, direction, description,
                    category, status, imported_income_id
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "pluggy",
                    "income-1",
                    "2026-04-11",
                    3000,
                    3000,
                    "income",
                    "Empresa X",
                    "Salário",
                    "imported",
                    income_id,
                ),
            )
            conn.commit()
        finally:
            conn.close()

        api.inbox_update_transactions(
            api.InboxUpdatePayload(
                updates=[api.InboxUpdateRow(id=1, category="Reembolso", status="imported")]
            )
        )

        conn = api.get_conn()
        try:
            inbox_row = conn.execute(
                "SELECT category FROM inbox_transactions WHERE id = 1"
            ).fetchone()
            income_row = conn.execute(
                "SELECT category FROM incomes WHERE id = ?", (income_id,)
            ).fetchone()
        finally:
            conn.close()

        self.assertEqual("Reembolso", inbox_row["category"])
        self.assertEqual("Reembolso", income_row["category"])


if __name__ == "__main__":
    unittest.main()
