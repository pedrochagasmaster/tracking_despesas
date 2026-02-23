# Tracking Despesas API Endpoints

Base URL default: `http://127.0.0.1:8000`

Recommended bootstrap/status command:

```bash
./scripts/app_endpoint.py --mode auto --pretty
```

Use `api_base_url_local`/`api_base_url_lan` from that JSON output when calling endpoints.

For agents running outside the project directory, use absolute path:

```bash
/home/pedro/my_project_dir/tracking_despesas/scripts/app_endpoint.py --mode status --pretty
```

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
    - `category` (string)
    - `amount` (number)

- `PUT /api/expenses/{id}`
  - Body:
    - `expense_date` (YYYY-MM-DD)
    - `amount` (number)
    - `category` (string)
    - `description` (string)
  - Note: only `kind=one_off` can be edited.

- `DELETE /api/expenses/{id}`
  - Note: only `kind=one_off` can be deleted.

- `PUT /api/budgets`
  - Body:
    - `category` (string)
    - `amount` (number)
  - Updates existing budget, returns 404 if not found.

- `DELETE /api/budgets?category=TEXT`
  - Deletes an existing budget row.

## Script examples

Use `scripts/api_action.py` from this skill folder:

```bash
python scripts/api_action.py default-month
python scripts/api_action.py summary --month 2026-02
python scripts/api_action.py expenses --month 2026-02 --limit 50
python scripts/api_action.py add-expense --expense-date 2026-02-10 --amount 89.90 --category Alimentação --description "Supermercado"
python scripts/api_action.py set-budget --category Moradia --amount 5500
python scripts/api_action.py update-expense --id 12 --expense-date 2026-02-10 --amount 99.90 --category Alimentação --description "Supermercado (ajuste)"
python scripts/api_action.py delete-expense --id 12
python scripts/api_action.py update-budget --category Moradia --amount 5800
python scripts/api_action.py delete-budget --category Moradia
```


## Bulk operations

For multi-row writes, use `scripts/api_batch.py` with JSON/CSV.
See `references/batch-format.md` for schema and examples.
