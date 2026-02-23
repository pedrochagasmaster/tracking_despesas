const BASE = import.meta.env.VITE_API_BASE_URL
    || `${window.location.protocol}//${window.location.hostname}:8000`

async function req(path, opts = {}) {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
    })
    if (!res.ok) {
        const err = await res.text()
        throw new Error(err || res.statusText)
    }
    return res.json()
}

export const api = {
    defaultMonth: () => req('/api/default-month'),
    summary: (month) => req(`/api/summary${month ? `?month=${month}` : ''}`),
    expenses: (month) => req(`/api/expenses${month ? `?month=${month}` : ''}`),
    incomes: (month) => req(`/api/incomes${month ? `?month=${month}` : ''}`),
    subscriptions: () => req('/api/subscriptions'),
    budgets: (month) => req(`/api/budgets${month ? `?month=${month}` : ''}`),
    trends: (n = 6) => req(`/api/trends?months=${n}`),
    categories: () => req('/api/categories'),

    addExpense: (body) => req('/api/expenses', { method: 'POST', body: JSON.stringify(body) }),
    addIncome: (body) => req('/api/incomes', { method: 'POST', body: JSON.stringify(body) }),
    addSubscription: (body) => req('/api/subscriptions', { method: 'POST', body: JSON.stringify(body) }),
    setBudget: (body) => req('/api/budgets', { method: 'POST', body: JSON.stringify(body) }),
}
