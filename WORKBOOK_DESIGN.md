# Robust Workbook Design

## Why this structure is more robust

- Single source of truth tables: every entity has its own table (`Categorias`, `Orcamento`, `Assinaturas`, `Parcelados`, `Transacoes`).
- Stable IDs: `category_id`, `subscription_id`, `installment_id`, `transaction_id` avoid ambiguity.
- Normalized transaction log: one `Transacoes` table with `nature` (`expense`/`income`) and `entry_type` (`one_off`/`subscription`/`installment`).
- Explicit recurrence metadata: subscriptions have `frequency`, `start_date`, `day_of_month`, and `active`.
- Explicit planning model: monthly budgets are stored as rows in `Orcamento` with `month + nature + category_name`.
- Data validation drop-downs: consistent enum values (no typo drift).

## Sheets and purpose

- `Instrucoes`: usage guide for the workbook.
- `Categorias`: controlled category catalog.
- `Orcamento`: monthly planned budget/income by category.
- `Assinaturas`: recurring charges configuration.
- `Parcelados`: installment purchase configuration.
- `Transacoes`: canonical ledger used by analytics.
- `Dashboard`: monthly KPIs from formulas (`receita`, `despesa`, `saldo`, `taxa de economia`, budget deltas).
- `Listas` (hidden): enum lists for validations.

## Generated files

- `Orcamento_Robusto_Template.xlsx`: clean template.
- `Orcamento_Robusto_Preenchido.xlsx`: prefilled using current data from `Orçamento mensal.xlsx`.

## Re-generate

```bash
python scripts/generate_workbooks.py
```
