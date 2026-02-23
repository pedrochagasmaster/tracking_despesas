---
name: tracking-api-actions
description: Execute all available actions in the local Tracking Despesas FastAPI backend (`api.py`), including reading analytics/list endpoints and writing expenses, incomes, subscriptions, and budgets. Use this skill when a personal agent must operate the project API directly, validate API behavior, seed/update data through API routes, or automate financial data workflows via HTTP.
---

# Tracking API Actions

## Overview

Use this skill to run every supported API action exposed by `api.py` with predictable commands.
Prefer the bundled script for reliability, then inspect results and report exact payloads/errors.

## Quick Start

1. Ensure API is running (default: `http://127.0.0.1:8000`).
2. Run `scripts/api_action.py` with the needed action.
3. Return parsed results and next recommended action.

Examples:

```bash
python scripts/api_action.py default-month
python scripts/api_action.py summary --month 2026-02
python scripts/api_action.py subscriptions
```

## Workflow

### 1) Read data and analytics

Run read endpoints first when user asks to inspect state, trends, or totals.

- `default-month`
- `summary [--month YYYY-MM]`
- `expenses [--month YYYY-MM] [--limit N]`
- `incomes [--month YYYY-MM]`
- `subscriptions`
- `budgets [--month YYYY-MM]`
- `trends [--months N]`
- `categories`

### 2) Write data

Use write actions when user asks to add/update financial records through API.

- `add-expense --expense-date YYYY-MM-DD --amount N --category TEXT --description TEXT`
- `add-income --income-date YYYY-MM-DD --amount N --category TEXT --description TEXT`
- `add-subscription --name TEXT --amount N --category TEXT --frequency monthly|yearly [--start-date YYYY-MM-DD]`
- `set-budget --month YYYY-MM --category TEXT --amount N`

After any write operation, run a related read action to verify persisted results.

## Safety and data handling

- Keep all dates explicit (`YYYY-MM` or `YYYY-MM-DD`).
- Treat write calls as persistent mutations; confirm intent if the request is ambiguous.
- On API errors, include status code and response body in the output.
- For bulk updates, run small batches and verify each batch with read calls.

## Batch operations

Use `scripts/api_batch.py` for bulk writes (JSON/CSV):

```bash
python scripts/api_batch.py --input operations.json --dry-run
python scripts/api_batch.py --input operations.json
python scripts/api_batch.py --input operations.csv --continue-on-error
```

Use dry-run first for safety, then execute.

## Resources

- Endpoint contract: `references/api-endpoints.md`
- Batch payload format: `references/batch-format.md`
- Single-action executor: `scripts/api_action.py`
- Batch executor: `scripts/api_batch.py`

Load `references/api-endpoints.md` for endpoint payload details.
Load `references/batch-format.md` when preparing bulk operation files.
Use scripts for actual API operations instead of ad-hoc curl.
