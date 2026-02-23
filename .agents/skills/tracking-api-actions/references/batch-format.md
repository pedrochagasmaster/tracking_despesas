# Batch Format

Use `scripts/api_batch.py` for bulk writes to the API.

Supported actions:

- `add-expense`
- `add-income`
- `add-subscription`
- `set-budget`

## JSON format

```json
[
  {
    "action": "add-expense",
    "expense_date": "2026-02-10",
    "amount": 89.9,
    "category": "Alimentação",
    "description": "Supermercado"
  },
  {
    "action": "set-budget",
    "month": "2026-02",
    "category": "Moradia",
    "amount": 5500
  }
]
```

Alternative JSON object wrapper:

```json
{
  "operations": [
    { "action": "add-income", "income_date": "2026-02-05", "amount": 12418, "category": "Pagamento", "description": "Salário" }
  ]
}
```

## CSV format

Single CSV can mix actions. Required columns depend on each action.

Common column:

- `action`

Action-specific columns:

- `add-expense`: `expense_date,amount,category,description`
- `add-income`: `income_date,amount,category,description`
- `add-subscription`: `name,amount,category,frequency,start_date`
- `set-budget`: `month,category,amount`

## Execution

```bash
# Validate payload without writes
python scripts/api_batch.py --input operations.json --dry-run

# Execute all operations
python scripts/api_batch.py --input operations.json

# Keep going after row-level errors
python scripts/api_batch.py --input operations.csv --continue-on-error
```
