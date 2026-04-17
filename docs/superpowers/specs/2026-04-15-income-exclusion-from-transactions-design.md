# Income Exclusion From Transactions Design

## Goal

Allow users to exclude income entries from the Transactions page in a way that returns imported incomes to the Inbox excluded tab, while still allowing manually added incomes to be permanently deleted from the Transactions page.

## Current State

- `dashboard/src/pages/Transactions.jsx` shows delete actions only for expenses.
- `api.py` supports deleting expenses and installments, but not incomes.
- The Inbox excluded tab is driven by `inbox_transactions.status = 'excluded'`.
- Imported incomes already persist a reverse link through `inbox_transactions.imported_income_id`.

## Chosen Approach

Add a dedicated income deletion/exclusion backend path and expose it in the Transactions income tab.

- If the income row is linked to an inbox row through `imported_income_id`, the action will:
  - delete the ledger row from `incomes`
  - set the linked `inbox_transactions` row to `excluded`
  - set `exclude_reason` to a manual marker
  - clear `imported_income_id`
- If the income row has no linked inbox row, the action will permanently delete the income row.

## UI Behavior

- The Transactions income tab will show a trash action on mobile cards and desktop table rows.
- Confirmation text will differ by row type:
  - imported income: explain that it will move back to Inbox as excluded
  - manual income: explain that it will be permanently deleted
- After success, the Transactions page reloads.

## Data Rules

- The operation is atomic in a single database mutation.
- Imported incomes should no longer remain in `incomes` after exclusion.
- The linked inbox row should become visible in the Inbox excluded view immediately after reload.
- Manual incomes without inbox linkage should not create or mutate inbox rows.

## Testing

- Add backend regression tests for:
  - imported income: delete from `incomes`, restore linked inbox row to `excluded`
  - manual income: delete only the income row
- Validate frontend build after the UI change.

## Non-Goals

- No soft-delete state for ledger incomes.
- No change to expense deletion behavior.
- No change to inbox import semantics beyond restoring linked rows on exclusion.
