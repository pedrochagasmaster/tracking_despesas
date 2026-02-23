---
name: tracking-api-actions
description: Execute all available actions in the local Tracking Despesas FastAPI backend (`api.py`), including reading analytics/list endpoints and writing expenses, incomes, subscriptions, and budgets. Use this skill when a personal agent must operate the project API directly, validate API behavior, seed/update data through API routes, or automate financial data workflows via HTTP.
---

# Tracking API Actions

## Overview

Use this skill to run every supported API action exposed by `api.py` with predictable commands.
Prefer the bundled script for reliability, then inspect results and report exact payloads/errors.

## Quick Start

1. Ensure endpoints are ready with repository script:
   - `./scripts/app_endpoint.py --mode auto --pretty`
   - `auto`: starts missing services with `nohup`
   - `status`: only inspects and prints connection details
2. Use `api_base_url_local` or `api_base_url_lan` from script output.
3. Run `scripts/api_action.py` with the needed action.
4. Return parsed results and next recommended action.

## External Agent (Different Directory)

If the agent is running from another working directory, always use absolute paths or `uv --project`.

Assume project root:
- `/home/pedro/my_project_dir/tracking_despesas`

Bootstrap/status from anywhere:

```bash
/home/pedro/my_project_dir/tracking_despesas/scripts/app_endpoint.py --mode auto --pretty
```

Run CLI entrypoint from anywhere:

```bash
uv run --project /home/pedro/my_project_dir/tracking_despesas tracking-despesas --help
```

Run API action script from anywhere:

```bash
python /home/pedro/my_project_dir/tracking_despesas/.agents/skills/tracking-api-actions/scripts/api_action.py summary --month 2027-01
```

Preferred integration flow for external agents:
1. Run `app_endpoint.py --mode status|auto`.
2. Read `agent_connection.api_base_url_local` or `agent_connection.api_base_url_lan`.
3. Call HTTP endpoints using that base URL.

Examples:

```bash
./scripts/app_endpoint.py --mode auto --pretty
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
- `set-budget --category TEXT --amount N`
- `update-expense --id N --expense-date YYYY-MM-DD --amount N --category TEXT --description TEXT`
- `delete-expense --id N`
- `update-budget --category TEXT --amount N`
- `delete-budget --category TEXT`

After any write operation, run a related read action to verify persisted results.

## Safety and data handling

- Keep all dates explicit (`YYYY-MM` or `YYYY-MM-DD`).
- Treat write calls as persistent mutations; confirm intent if the request is ambiguous.
- On API errors, include status code and response body in the output.
- For bulk updates, run small batches and verify each batch with read calls.
- If API is not reachable, run `./scripts/app_endpoint.py --mode auto --no-ui --pretty` and retry.
- For expense edit/delete, only records with `kind=one_off` are mutable. Subscriptions/parcelados are protected.

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
- Endpoint bootstrap/status: `scripts/app_endpoint.py`

Load `references/api-endpoints.md` for endpoint payload details.
Load `references/batch-format.md` when preparing bulk operation files.
Use scripts for actual API operations instead of ad-hoc curl.
