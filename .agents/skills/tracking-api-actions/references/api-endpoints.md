# Tracking Despesas API Endpoints

Base URL default: `http://127.0.0.1:8000`

Recommended bootstrap/status command:

```bash
./scripts/app_endpoint.py --mode auto --pretty
```

Use `api_base_url_local`/`api_base_url_lan` from that JSON output when calling endpoints.

## Read operations

- `GET /api/default-month`
  - Returns: `{ "month": "YYYY-MM", "budgets_month": "YYYY-MM" }`

- `GET /api/summary?month=YYYY-MM`
  - Optional: `month`
  - Returns monthly income/expenses/net/savings and category totals.

- `GET /api/expenses?month=YYYY-MM&limit=200`
  - Optional: `month`, `limit`
  - Returns list of expenses.

- `GET /api/incomes?month=YYYY-MM`
  - Optional: `month`
  - Returns list of incomes.

- `GET /api/subscriptions`
  - Returns list of subscriptions ordered by active/amount.

- `GET /api/budgets?month=YYYY-MM`
  - Optional: `month`
  - Returns budget vs spent by category.

- `GET /api/trends?months=6`
  - Optional: `months` (int)
  - Returns time-series rows: month, expenses, income, net.

- `GET /api/categories`
  - Returns distinct expense categories.

## Write operations

- `POST /api/expenses`
  - Body:
    - `expense_date` (YYYY-MM-DD)
    - `amount` (number)
    - `category` (string)
    - `description` (string)

- `POST /api/incomes`
  - Body:
    - `income_date` (YYYY-MM-DD)
    - `amount` (number)
    - `category` (string)
    - `description` (string)

- `POST /api/subscriptions`
  - Body:
    - `name` (string)
    - `amount` (number)
    - `category` (string)
    - `frequency` (`monthly` | `yearly`)
    - `start_date` (optional, YYYY-MM-DD)

- `POST /api/budgets`
  - Body:
    - `month` (YYYY-MM)
    - `category` (string)
    - `amount` (number)

## Script examples

Use `scripts/api_action.py` from this skill folder:

```bash
python scripts/api_action.py default-month
python scripts/api_action.py summary --month 2026-02
python scripts/api_action.py expenses --month 2026-02 --limit 50
python scripts/api_action.py add-expense --expense-date 2026-02-10 --amount 89.90 --category Alimentação --description "Supermercado"
python scripts/api_action.py set-budget --month 2026-02 --category Moradia --amount 5500
```


## Bulk operations

For multi-row writes, use `scripts/api_batch.py` with JSON/CSV.
See `references/batch-format.md` for schema and examples.
