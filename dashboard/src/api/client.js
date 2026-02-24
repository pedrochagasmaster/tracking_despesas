const BASE = import.meta.env.VITE_API_BASE_URL
    || `${window.location.protocol}//${window.location.hostname}:8000`

async function req(path, opts = {}) {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
    })
    if (!res.ok) {
        let message = res.statusText || 'Request failed'
        const contentType = res.headers.get('content-type') || ''
        if (contentType.includes('application/json')) {
            const data = await res.json().catch(() => null)
            if (typeof data?.detail === 'string') {
                message = data.detail
            } else if (Array.isArray(data?.detail)) {
                const first = data.detail[0]
                if (first?.msg) {
                    const loc = Array.isArray(first.loc) ? first.loc.join('.') : ''
                    message = loc ? `${loc}: ${first.msg}` : first.msg
                } else {
                    message = JSON.stringify(data.detail)
                }
            } else if (data?.detail != null) {
                message = JSON.stringify(data.detail)
            }
            else if (data?.message) message = data.message
        } else {
            const text = await res.text()
            if (text) message = text
        }
        throw new Error(message)
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
    updateExpense: (id, body) => req(`/api/expenses/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteExpense: (id) => req(`/api/expenses/${id}`, { method: 'DELETE' }),
    addIncome: (body) => req('/api/incomes', { method: 'POST', body: JSON.stringify(body) }),
    addSubscription: (body) => req('/api/subscriptions', { method: 'POST', body: JSON.stringify(body) }),
    updateSubscription: (id, body) => req(`/api/subscriptions/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteSubscription: (id) => req(`/api/subscriptions/${id}`, { method: 'DELETE' }),
    runSubscriptions: (body) => req('/api/subscriptions/run', { method: 'POST', body: JSON.stringify(body) }),
    setBudget: (body) => req('/api/budgets', { method: 'POST', body: JSON.stringify(body) }),
    updateBudget: (body) => req('/api/budgets', { method: 'PUT', body: JSON.stringify(body) }),
    deleteBudget: (category) => req(`/api/budgets?category=${encodeURIComponent(category)}`, { method: 'DELETE' }),

    curationMeta: (file) => req(`/api/curation/meta${file ? `?file=${encodeURIComponent(file)}` : ''}`),
    curationTransactions: ({ file, view = 'keep', limit = 250, dateFrom, dateTo } = {}) => {
        const params = new URLSearchParams()
        if (file) params.set('file', file)
        params.set('view', view)
        params.set('limit', String(limit))
        if (dateFrom) params.set('date_from', dateFrom)
        if (dateTo) params.set('date_to', dateTo)
        return req(`/api/curation/transactions?${params.toString()}`)
    },
    curationUpdate: (body) => req('/api/curation/transactions', { method: 'POST', body: JSON.stringify(body) }),
    curationApplyDateRange: (body) => req('/api/curation/date-range', { method: 'POST', body: JSON.stringify(body) }),
    curationExport: (file) => req(`/api/curation/export${file ? `?file=${encodeURIComponent(file)}` : ''}`, { method: 'POST' }),
    curationImportExpenses: (body) => req('/api/curation/import-expenses', { method: 'POST', body: JSON.stringify(body) }),
}
