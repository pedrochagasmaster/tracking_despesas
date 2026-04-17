import sqlite3
import tempfile
import unittest
from pathlib import Path

import api
from expense_cli import init_db


class IncomeDeletionBehaviorTests(unittest.TestCase):
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

    def test_delete_imported_income_restores_inbox_row_to_excluded(self) -> None:
        conn = api.get_conn()
        try:
            cur = conn.execute(
                """
                INSERT INTO incomes (income_date, amount, description, category)
                VALUES ('2026-04-11', 3000, 'Empresa X', 'Salário')
                """
            )
            income_id = cur.lastrowid
            cur = conn.execute(
                """
                INSERT INTO inbox_transactions (
                    provider, external_id, tx_date, amount, signed_amount, direction, description,
                    category, status, imported_income_id
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "pluggy",
                    "income-imported",
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
            inbox_id = cur.lastrowid
            conn.commit()
        finally:
            conn.close()

        response = api.delete_income(income_id)

        conn = api.get_conn()
        try:
            deleted_income = conn.execute("SELECT id FROM incomes WHERE id = ?", (income_id,)).fetchone()
            restored_inbox = conn.execute(
                "SELECT status, exclude_reason, imported_income_id FROM inbox_transactions WHERE id = ?",
                (inbox_id,),
            ).fetchone()
        finally:
            conn.close()

        self.assertEqual({"status": "ok"}, response)
        self.assertIsNone(deleted_income)
        self.assertEqual("excluded", restored_inbox["status"])
        self.assertEqual("manual_exclusion", restored_inbox["exclude_reason"])
        self.assertIsNone(restored_inbox["imported_income_id"])

    def test_delete_manual_income_only_removes_income_row(self) -> None:
        conn = api.get_conn()
        try:
            cur = conn.execute(
                """
                INSERT INTO incomes (income_date, amount, description, category)
                VALUES ('2026-04-15', 150, 'Venda', 'Reembolso')
                """
            )
            income_id = cur.lastrowid
            conn.commit()
        finally:
            conn.close()

        response = api.delete_income(income_id)

        conn = api.get_conn()
        try:
            deleted_income = conn.execute("SELECT id FROM incomes WHERE id = ?", (income_id,)).fetchone()
            inbox_rows = conn.execute("SELECT COUNT(*) AS c FROM inbox_transactions").fetchone()
        finally:
            conn.close()

        self.assertEqual({"status": "ok"}, response)
        self.assertIsNone(deleted_income)
        self.assertEqual(0, inbox_rows["c"])


if __name__ == "__main__":
    unittest.main()
