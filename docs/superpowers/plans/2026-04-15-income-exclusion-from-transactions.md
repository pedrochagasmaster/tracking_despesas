# Income Exclusion From Transactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Transactions page exclude imported incomes back into Inbox and permanently delete manually created incomes.

**Architecture:** Add a dedicated `DELETE /api/incomes/{income_id}` path that detects whether the income is linked to an inbox row and either restores that row to `excluded` or deletes the income permanently. Then wire the Transactions income tab to call that endpoint with row-type-specific confirmation copy.

**Tech Stack:** FastAPI, SQLite, React, Vite, Python `unittest`

---

### Task 1: Backend Income Exclusion Contract

**Files:**
- Modify: `api.py`
- Test: `tests/test_income_deletion_behavior.py`

- [ ] **Step 1: Write the failing test**

```python
def test_delete_imported_income_restores_inbox_row(self):
    response = api.delete_income(income_id)
    self.assertEqual("ok", response["status"])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source .venv/bin/activate && python -m unittest tests.test_income_deletion_behavior`
Expected: FAIL because `delete_income` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```python
@app.delete("/api/incomes/{income_id}")
def delete_income(income_id: int):
    ...
```

- [ ] **Step 4: Run test to verify it passes**

Run: `source .venv/bin/activate && python -m unittest tests.test_income_deletion_behavior`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add api.py tests/test_income_deletion_behavior.py
git commit -m "feat: support excluding imported incomes from transactions"
```

### Task 2: Transactions Income Delete UI

**Files:**
- Modify: `dashboard/src/api/client.js`
- Modify: `dashboard/src/pages/Transactions.jsx`

- [ ] **Step 1: Add client method for income deletion**

```js
deleteIncome: (id) => req(`/api/incomes/${id}`, { method: 'DELETE' }),
```

- [ ] **Step 2: Add income action flow in Transactions**

```js
async function onDeleteIncome(row) {
  ...
}
```

- [ ] **Step 3: Render delete buttons for income rows**

```jsx
{tab === 'incomes' && (
  <button onClick={() => onDeleteIncome(row)}>...</button>
)}
```

- [ ] **Step 4: Verify frontend build**

Run: `npm --prefix dashboard run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/api/client.js dashboard/src/pages/Transactions.jsx
git commit -m "feat: add income exclusion action to transactions page"
```

### Task 3: End-to-End Verification

**Files:**
- Modify: none

- [ ] **Step 1: Run focused backend tests**

Run: `source .venv/bin/activate && python -m unittest tests.test_income_deletion_behavior tests.test_inbox_category_updates`
Expected: PASS

- [ ] **Step 2: Restart API**

Run: `pkill -f "uvicorn api:app --host 0.0.0.0 --port 8000" && source .venv/bin/activate && nohup python -m uvicorn api:app --host 0.0.0.0 --port 8000 > api.log 2>&1 &`
Expected: server restarts cleanly

- [ ] **Step 3: Verify live schema**

Run: `curl -sSf http://127.0.0.1:8000/openapi.json | head -c 300`
Expected: JSON beginning with `"openapi":"3.1.0"`

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-15-income-exclusion-from-transactions-design.md docs/superpowers/plans/2026-04-15-income-exclusion-from-transactions.md
git commit -m "docs: capture income exclusion design and plan"
```
