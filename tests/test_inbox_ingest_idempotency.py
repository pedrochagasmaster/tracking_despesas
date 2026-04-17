import sqlite3
import tempfile
import unittest
from pathlib import Path

import api
from expense_cli import init_db


class InboxIngestIdempotencyTests(unittest.TestCase):
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

    def _expense_entry(self, external_id: str, description: str) -> api.InboxIngestItem:
        return api.InboxIngestItem(
            provider="pluggy",
            external_id=external_id,
            tx_date="2026-04-13",
            amount=134.02,
            signed_amount=-134.02,
            direction="expense",
            description=description,
            category="Internet",
            raw_category="",
        )

    def test_reingesting_same_transaction_with_new_external_id_does_not_create_pending_duplicate(self) -> None:
        first = self._expense_entry(
            "first-id",
            "[MeuPluggy] PIX QR CODE DINAMICO - DES: TELEFONICA BRASIL S.A 13/04 - DOCTO: 548109 [pluggy]",
        )
        second = self._expense_entry(
            "second-id",
            "[MeuPluggy] PIX QR CODE DINAMICO - DES  TELEFONICA BRASIL S.A 13/04 - DOCTO: 548109 [pluggy]",
        )

        api.inbox_ingest(api.InboxIngestPayload(entries=[first]))
        api.inbox_import_transactions(api.InboxImportPayload(require_category=True))
        response = api.inbox_ingest(api.InboxIngestPayload(entries=[second]))

        conn = api.get_conn()
        try:
            inbox_count = conn.execute("SELECT COUNT(*) AS c FROM inbox_transactions").fetchone()["c"]
            pending_count = conn.execute(
                "SELECT COUNT(*) AS c FROM inbox_transactions WHERE status = 'pending'"
            ).fetchone()["c"]
            expense_count = conn.execute("SELECT COUNT(*) AS c FROM expenses").fetchone()["c"]
        finally:
            conn.close()

        self.assertEqual(0, response["inserted"])
        self.assertEqual(1, response["deduplicated"])
        self.assertEqual(1, inbox_count)
        self.assertEqual(0, pending_count)
        self.assertEqual(1, expense_count)

    def test_reingesting_excluded_transaction_preserves_excluded_status(self) -> None:
        entry = self._expense_entry("excluded-id", "DROGASIL2573")

        api.inbox_ingest(api.InboxIngestPayload(entries=[entry]))
        api.inbox_update_transactions(
            api.InboxUpdatePayload(
                updates=[
                    api.InboxUpdateRow(
                        id=1,
                        status="excluded",
                        exclude_reason="manual_exclusion",
                    )
                ]
            )
        )
        response = api.inbox_ingest(api.InboxIngestPayload(entries=[entry]))

        conn = api.get_conn()
        try:
            row = conn.execute(
                "SELECT status, exclude_reason FROM inbox_transactions WHERE id = 1"
            ).fetchone()
            inbox_count = conn.execute("SELECT COUNT(*) AS c FROM inbox_transactions").fetchone()["c"]
        finally:
            conn.close()

        self.assertEqual(0, response["inserted"])
        self.assertEqual(1, response["deduplicated"])
        self.assertEqual(1, inbox_count)
        self.assertEqual("excluded", row["status"])
        self.assertEqual("manual_exclusion", row["exclude_reason"])

    def test_importing_existing_pending_duplicates_creates_one_expense(self) -> None:
        first = self._expense_entry(
            "first-id",
            "[MeuPluggy] PIX QR CODE DINAMICO - DES: TELEFONICA BRASIL S.A 13/04 - DOCTO: 548109 [pluggy]",
        )
        second = self._expense_entry(
            "second-id",
            "[MeuPluggy] PIX QR CODE DINAMICO - DES  TELEFONICA BRASIL S.A 13/04 - DOCTO: 548109 [pluggy]",
        )

        conn = api.get_conn()
        try:
            for entry in (first, second):
                conn.execute(
                    """
                    INSERT INTO inbox_transactions (
                        provider, external_id, tx_date, amount, signed_amount, direction, description,
                        category, status
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
                    """,
                    (
                        entry.provider,
                        entry.external_id,
                        entry.tx_date,
                        abs(float(entry.amount)),
                        entry.signed_amount,
                        entry.direction,
                        entry.description,
                        entry.category,
                    ),
                )
            conn.commit()
        finally:
            conn.close()

        response = api.inbox_import_transactions(api.InboxImportPayload(require_category=True))

        conn = api.get_conn()
        try:
            expenses = conn.execute("SELECT id FROM expenses").fetchall()
            inbox_rows = conn.execute(
                "SELECT status, imported_expense_id FROM inbox_transactions ORDER BY id"
            ).fetchall()
        finally:
            conn.close()

        self.assertEqual(1, response["imported_expenses"])
        self.assertEqual(1, response["skipped"]["duplicates"])
        self.assertEqual(1, len(expenses))
        self.assertEqual(["imported", "imported"], [row["status"] for row in inbox_rows])
        self.assertEqual(expenses[0]["id"], inbox_rows[0]["imported_expense_id"])
        self.assertEqual(expenses[0]["id"], inbox_rows[1]["imported_expense_id"])


if __name__ == "__main__":
    unittest.main()
