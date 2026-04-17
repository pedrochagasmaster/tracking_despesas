import { attachOfflineMeta, readCachedResponse, writeCachedResponse } from '../utils/offline-cache'

const BASE = import.meta.env.VITE_API_BASE_URL
    || (window.location.protocol === 'https:' ? '' : `${window.location.protocol}//${window.location.hostname}:8000`)

const CACHEABLE_GET_PATHS = [
    '/api/system/meta',
    '/api/summary',
    '/api/trends',
    '/api/expenses',
    '/api/incomes',
    '/api/budgets',
    '/api/categories',
    '/api/default-month',
    '/api/subscriptions',
]

function isCacheableGet(path, opts) {
    const method = (opts.method || 'GET').toUpperCase()
    return method === 'GET' && CACHEABLE_GET_PATHS.some((prefix) => path.startsWith(prefix))
}

async function req(path, opts = {}) {
    const cacheable = isCacheableGet(path, opts)
    try {
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
        const data = await res.json()
        if (cacheable) writeCachedResponse(path, data)
        return data
    } catch (error) {
        if (cacheable) {
            const cached = readCachedResponse(path)
            if (cached?.data != null) {
                return attachOfflineMeta(cached.data, path, cached.cachedAt)
            }
        }
        throw error
    }
}

export const api = {
    defaultMonth: () => req('/api/default-month'),
    systemMeta: () => req('/api/system/meta'),
    summary: (month) => req(`/api/summary${month ? `?month=${month}` : ''}`),
    expenses: (month) => req(`/api/expenses${month ? `?month=${month}` : ''}`),
    incomes: (month) => req(`/api/incomes${month ? `?month=${month}` : ''}`),
    subscriptions: () => req('/api/subscriptions'),
    budgets: (month) => req(`/api/budgets${month ? `?month=${month}` : ''}`),
    trends: (n = 6) => req(`/api/trends?months=${n}`),
    categories: () => req('/api/categories'),

    addExpense: (body) => req('/api/expenses', { method: 'POST', body: JSON.stringify(body) }),
    addInstallment: (body) => req('/api/installments', { method: 'POST', body: JSON.stringify(body) }),
    deleteInstallment: (id) => req(`/api/installments/${id}`, { method: 'DELETE' }),
    updateExpense: (id, body) => req(`/api/expenses/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteExpense: (id) => req(`/api/expenses/${id}`, { method: 'DELETE' }),
    addIncome: (body) => req('/api/incomes', { method: 'POST', body: JSON.stringify(body) }),
    deleteIncome: (id) => req(`/api/incomes/${id}`, { method: 'DELETE' }),
    addSubscription: (body) => req('/api/subscriptions', { method: 'POST', body: JSON.stringify(body) }),
    updateSubscription: (id, body) => req(`/api/subscriptions/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteSubscription: (id) => req(`/api/subscriptions/${id}`, { method: 'DELETE' }),
    runSubscriptions: (body) => req('/api/subscriptions/run', { method: 'POST', body: JSON.stringify(body) }),
    setBudget: (body) => req('/api/budgets', { method: 'POST', body: JSON.stringify(body) }),
    updateBudget: (body) => req('/api/budgets', { method: 'PUT', body: JSON.stringify(body) }),
    deleteBudget: (category) => req(`/api/budgets?category=${encodeURIComponent(category)}`, { method: 'DELETE' }),

    inboxMeta: () => req('/api/inbox/meta'),
    inboxTransactions: ({ view = 'pending', limit = 500, dateFrom, dateTo, sortBy = 'tx_date', sortDir = 'desc' } = {}) => {
        const params = new URLSearchParams()
        params.set('view', view)
        params.set('limit', String(limit))
        if (dateFrom) params.set('date_from', dateFrom)
        if (dateTo) params.set('date_to', dateTo)
        if (sortBy) params.set('sort_by', sortBy)
        if (sortDir) params.set('sort_dir', sortDir)
        return req(`/api/inbox/transactions?${params.toString()}`)
    },
    inboxUpdate: (body) => req('/api/inbox/transactions', { method: 'POST', body: JSON.stringify(body) }),
    inboxImport: (body = {}) => req('/api/inbox/import', { method: 'POST', body: JSON.stringify(body) }),
    inboxImportExpenses: (body = {}) => req('/api/inbox/import', { method: 'POST', body: JSON.stringify(body) }),

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
