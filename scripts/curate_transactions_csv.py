#!/usr/bin/env python3
"""Interactive triage tool to mark which CSV transactions should be kept."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path
from typing import Iterable


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Review transactions in a merged CSV and set keep=true/false. "
            "By default, only rows without keep set are shown."
        )
    )
    parser.add_argument(
        "--file",
        required=True,
        help="Path to merged CSV file (for example combined_transactions_deduped.csv).",
    )
    parser.add_argument(
        "--show-all",
        action="store_true",
        help="Review all rows, including those that already have keep set.",
    )
    parser.add_argument(
        "--start-at",
        type=int,
        default=1,
        help="1-based row number to start from (default: 1).",
    )
    parser.add_argument(
        "--autosave-every",
        type=int,
        default=20,
        help="Persist changes every N decisions (default: 20).",
    )
    return parser.parse_args()


def is_truthy(text: str) -> bool:
    return text.strip().lower() in {"1", "true", "yes", "y", "sim", "s"}


def is_falsy(text: str) -> bool:
    return text.strip().lower() in {"0", "false", "no", "n", "nao", "não"}


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise ValueError(f"CSV sem cabeçalho: {path}")
        rows = list(reader)
        fieldnames = list(reader.fieldnames)

    if "keep" not in fieldnames:
        fieldnames.append("keep")
        for row in rows:
            row["keep"] = ""
    else:
        for row in rows:
            row["keep"] = row.get("keep", "")
    return fieldnames, rows


def write_csv(path: Path, fieldnames: Iterable[str], rows: list[dict[str, str]]) -> None:
    temp_path = path.with_suffix(path.suffix + ".tmp")
    with temp_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(fieldnames))
        writer.writeheader()
        writer.writerows(rows)
    temp_path.replace(path)


def row_summary(row: dict[str, str], row_num: int, total: int) -> str:
    date = row.get("date", "")
    amount = row.get("amount", "")
    schema = row.get("schema_type", "")
    title = row.get("title", "")
    description = row.get("description", "")
    source = row.get("source_file", "")
    keep = row.get("keep", "")
    text = title if title else description
    if len(text) > 160:
        text = text[:157] + "..."
    return (
        f"[{row_num}/{total}] keep={keep or '<vazio>'} | "
        f"{date} | {amount} | {schema} | {text} | source={source}"
    )


def main() -> int:
    args = parse_args()
    csv_path = Path(args.file).expanduser().resolve()
    if not csv_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {csv_path}")
    if args.start_at < 1:
        raise ValueError("--start-at deve ser >= 1")
    if args.autosave_every < 1:
        raise ValueError("--autosave-every deve ser >= 1")

    fieldnames, rows = read_csv(csv_path)

    start_index = args.start_at - 1
    if start_index >= len(rows):
        print(f"Nada para revisar: --start-at ({args.start_at}) > total de linhas ({len(rows)}).")
        return 0

    row_indexes = []
    for index, row in enumerate(rows):
        if index < start_index:
            continue
        keep_value = (row.get("keep") or "").strip()
        if args.show_all or not keep_value:
            row_indexes.append(index)

    if not row_indexes:
        print("Nenhuma linha pendente. Use --show-all para revisar tudo.")
        return 0

    print(f"Arquivo: {csv_path}")
    print(f"Linhas para revisar: {len(row_indexes)}")
    print("Comandos: [k]eep, [d]rop, [s]kip, [u]nset, [q]uit")

    decisions_since_save = 0

    for display_pos, row_index in enumerate(row_indexes, start=1):
        row = rows[row_index]
        print("")
        print(row_summary(row, display_pos, len(row_indexes)))

        while True:
            cmd = input("Decisão (k/d/s/u/q): ").strip().lower()

            if cmd in {"k", "keep"}:
                row["keep"] = "true"
                decisions_since_save += 1
                break
            if cmd in {"d", "drop"}:
                row["keep"] = "false"
                decisions_since_save += 1
                break
            if cmd in {"u", "unset"}:
                row["keep"] = ""
                decisions_since_save += 1
                break
            if cmd in {"s", "skip", ""}:
                break
            if cmd in {"q", "quit"}:
                write_csv(csv_path, fieldnames, rows)
                print(f"Salvo e finalizado: {csv_path}")
                return 0
            if is_truthy(cmd):
                row["keep"] = "true"
                decisions_since_save += 1
                break
            if is_falsy(cmd):
                row["keep"] = "false"
                decisions_since_save += 1
                break
            print("Comando inválido. Use k, d, s, u ou q.")

        if decisions_since_save >= args.autosave_every:
            write_csv(csv_path, fieldnames, rows)
            decisions_since_save = 0
            print("Autosave concluído.")

    write_csv(csv_path, fieldnames, rows)
    print(f"Revisão concluída. Arquivo salvo: {csv_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
