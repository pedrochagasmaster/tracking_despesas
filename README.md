# Tracking Despesas

CLI backend and workbook tooling for personal expense tracking.

## Project files

- `expense_cli.py`: SQLite-backed CLI for transactions, subscriptions, installments, budgets, and analytics.
- `scripts/generate_workbooks.py`: generates robust Excel workbooks (template + prefilled).
- `Orcamento_Robusto_Template.xlsx`: clean robust workbook template.
- `Orcamento_Robusto_Preenchido.xlsx`: robust workbook prefilled from `Orçamento mensal.xlsx`.

## CLI quick start

```bash
python expense_cli.py init
python expense_cli.py --help
```

## Install as a package

```bash
uv pip install -e .
uv run tracking-despesas --help
```

Build distributable artifacts:

```bash
uv build
```

This creates:

- `dist/tracking_despesas-0.1.0.tar.gz`
- `dist/tracking_despesas-0.1.0-py3-none-any.whl`

## Make targets

```bash
make help
make init
make test-cli
make smoke
make gen-workbook
```

- `make test-cli`: runs syntax + CLI help checks.
- `make smoke`: runs a lightweight end-to-end flow using `smoke_test.db`.
- `make gen-workbook`: regenerates robust workbook files.

### Common commands

```bash
# One-off expense
python expense_cli.py add-expense --date 2026-02-05 --amount 1100 --category Moradia --description "Aluguel"

# Income
python expense_cli.py add-income --date 2026-02-05 --amount 12418 --category Salario --description "Pagamento"

# Subscription + monthly materialization
python expense_cli.py add-subscription --name Netflix --amount 45 --category Streaming --frequency monthly --start-date 2026-01-10
python expense_cli.py run-subscriptions --month 2026-02

# Installment purchase (parcelado)
python expense_cli.py add-installment --description "Notebook" --category Eletronicos --total-amount 2400 --installments 12 --start-date 2026-02-15

# Budget and analytics
python expense_cli.py set-budget --month 2026-02 --category Moradia --amount 1300
python expense_cli.py report-month --month 2026-02
python expense_cli.py report-trends --months 6
python expense_cli.py report-savings --month 2026-02 --target-rate 20
```

### Import from existing workbook

```bash
python expense_cli.py import-excel --file "Orçamento mensal.xlsx" --import-subscriptions
```

## Dashboard API base URL

The frontend now uses:

- `VITE_API_BASE_URL` when defined, otherwise
- `http(s)://<current-hostname>:8000`

Examples:

```bash
# Local default (same machine)
npm --prefix dashboard run dev

# Force a specific API URL
VITE_API_BASE_URL=http://192.168.15.17:8000 npm --prefix dashboard run dev -- --host 0.0.0.0 --port 5173
```

## Agent endpoint launcher/status

Use one script to either start missing services with `nohup` or just inspect running endpoints:

```bash
# Auto mode: starts API/frontend if missing, then prints connection JSON
./scripts/app_endpoint.py --mode auto --pretty

# Status mode: only checks and prints current connection JSON
./scripts/app_endpoint.py --mode status --pretty
```

The output includes:

- `agent_connection.dashboard_url_local`
- `agent_connection.dashboard_url_lan`
- `agent_connection.api_base_url_local`
- `agent_connection.api_base_url_lan`

## Workbook generation

```bash
python scripts/generate_workbooks.py
# or
make gen-workbook
```

This generates:

- `Orcamento_Robusto_Template.xlsx`
- `Orcamento_Robusto_Preenchido.xlsx`

## Notes

- Default database file is `expenses.db` (override with `--db`).
- `run-subscriptions` is idempotent per month.
