import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { Check, CircleSlash2, RefreshCw, Inbox, Upload } from 'lucide-react'

const fmt = (value) => {
  const n = Number(value)
  if (Number.isNaN(n)) return value
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

function normalizeLoadError(err) {
  const text = String(err?.message || '')
  if (text === 'Not Found' || text.includes('404')) {
    return 'API de inbox não encontrada. Reinicie o backend para carregar os endpoints /api/inbox/*.'
  }
  return text || 'Falha ao carregar inbox.'
}

export default function Curation() {
  const [meta, setMeta] = useState({
    categories: [],
    expense_categories: [],
    income_categories: [],
    stats: { pending: 0, excluded: 0, imported: 0, total: 0 },
  })
  const [rows, setRows] = useState([])
  const [view, setView] = useState('pending')
  const [sortBy, setSortBy] = useState('tx_date')
  const [sortDir, setSortDir] = useState('desc')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingRow, setSavingRow] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importStatus, setImportStatus] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [metaRes, rowsRes] = await Promise.all([
        api.inboxMeta(),
        api.inboxTransactions({ view, limit: 1200, sortBy, sortDir }),
      ])
      setMeta(metaRes)
      setRows(rowsRes.items || [])
    } catch (err) {
      setError(normalizeLoadError(err))
    } finally {
      setLoading(false)
    }
  }, [view, sortBy, sortDir])

  useEffect(() => {
    load()
  }, [load])

  const expenseCategories = meta.expense_categories || meta.categories || []
  const incomeCategories = meta.income_categories || []

  const stats = useMemo(() => {
    const pending = rows.filter((r) => r.status === 'pending').length
    const uncategorizedExpense = rows.filter((r) => r.status === 'pending' && r.direction === 'expense' && !r.category).length
    const uncategorizedIncome = rows.filter((r) => r.status === 'pending' && r.direction === 'income' && !r.category).length
    return {
      pending,
      uncategorizedExpense,
      uncategorizedIncome,
      uncategorizedTotal: uncategorizedExpense + uncategorizedIncome,
    }
  }, [rows])

  async function updateRow(rowId, patch) {
    setSavingRow(rowId)
    setError('')
    try {
      await api.inboxUpdate({ updates: [{ id: rowId, ...patch }] })
      setRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)))
    } catch (err) {
      setError(err.message || 'Falha ao salvar alteração.')
    } finally {
      setSavingRow(null)
    }
  }

  async function importPendingTransactions() {
    const missingParts = []
    if (stats.uncategorizedExpense > 0) missingParts.push(`${stats.uncategorizedExpense} despesa(s)`)
    if (stats.uncategorizedIncome > 0) missingParts.push(`${stats.uncategorizedIncome} receita(s)`)
    const confirmMsg = missingParts.length > 0
      ? `Existem ${missingParts.join(' e ')} sem categoria válida. Elas serão ignoradas na importação. Continuar?`
      : 'Importar transações pendentes categorizadas para o razão final?'
    if (!window.confirm(confirmMsg)) return

    setImporting(true)
    setImportStatus('Importando transações...')
    setError('')
    try {
      const res = await api.inboxImport({ require_category: true })
      const months = Object.entries(res.imported_by_month || {})
        .map(([month, counts]) => {
          const expenseCount = counts?.expenses ?? 0
          const incomeCount = counts?.incomes ?? 0
          const total = counts?.total ?? (expenseCount + incomeCount)
          const parts = []
          if (expenseCount > 0) parts.push(`${expenseCount} desp.`)
          if (incomeCount > 0) parts.push(`${incomeCount} rec.`)
          return `${month}: ${total}${parts.length ? ` (${parts.join(', ')})` : ''}`
        })
        .join(', ')
      setImportStatus(
        `Importadas ${res.imported_transactions ?? 0} transações ` +
        `(${res.imported_expenses ?? 0} despesas, ${res.imported_incomes ?? 0} receitas). ` +
        (months ? `Meses: ${months}. ` : '') +
        `Ignoradas sem categoria: ${res.skipped?.missing_category ?? 0}.`
      )
      await load()
    } catch (err) {
      setImportStatus('')
      setError(err.message || 'Falha ao importar transações.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between border-b border-[var(--border-color)] pb-6 mt-4">
        <div>
          <h1 className="text-4xl text-white tracking-tight leading-none" style={{ fontFamily: '"DM Serif Text", serif' }}>Inbox de Transações</h1>
          <p className="text-[11px] text-[var(--text-muted)] mt-3 font-mono uppercase tracking-widest">API ingestão → revisar/excluir/categorizar → importar transações</p>
        </div>
        <button type="button" className="btn-ghost" onClick={load}>
          <span className="inline-flex items-center gap-2"><RefreshCw size={15} /> Atualizar</span>
        </button>
      </div>

      {error && (
        <div className="status-error px-4 py-3 text-sm">
          <div>{error}</div>
          <button type="button" onClick={load} className="btn-ghost mt-2 px-3 py-1.5 text-xs">Tentar novamente</button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-[var(--border-color)] pb-6">
        <div className="panel p-5 border-t-2 border-t-[#333]">
          <div className="label mb-1 uppercase tracking-widest text-[10px] font-mono">Total</div>
          <div className="text-3xl text-white" style={{ fontFamily: '"DM Serif Text", serif' }}>{meta.stats.total}</div>
        </div>
        <div className="panel p-5 border-t-2 border-t-[var(--color-warn)]">
          <div className="label mb-1 uppercase tracking-widest text-[10px] font-mono">Pendentes</div>
          <div className="text-3xl text-[var(--color-warn)]" style={{ fontFamily: '"DM Serif Text", serif' }}>{meta.stats.pending}</div>
        </div>
        <div className="panel p-5 border-t-2 border-t-[var(--color-expense)]">
          <div className="label mb-1 uppercase tracking-widest text-[10px] font-mono">Excluídas</div>
          <div className="text-3xl text-[var(--color-expense)]" style={{ fontFamily: '"DM Serif Text", serif' }}>{meta.stats.excluded}</div>
        </div>
        <div className="panel p-5 border-t-2 border-t-[var(--color-income)]">
          <div className="label mb-1 uppercase tracking-widest text-[10px] font-mono">Importadas</div>
          <div className="text-3xl text-[var(--color-income)]" style={{ fontFamily: '"DM Serif Text", serif' }}>{meta.stats.imported}</div>
        </div>
      </div>

      <div className="panel p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="w-full sm:w-auto overflow-x-auto scrollbar-thin">
          <div className="inline-flex min-w-max border border-[#333] p-1">
          {[
            { key: 'pending', label: 'Pendentes' },
            { key: 'excluded', label: 'Excluídas' },
            { key: 'imported', label: 'Importadas' },
            { key: 'all', label: 'Todas' },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setView(item.key)}
              className={`px-4 py-2 text-[11px] font-mono tracking-widest uppercase transition whitespace-nowrap ${view === item.key ? 'bg-white text-black font-bold' : 'text-[var(--text-secondary)] hover:text-white'}`}
            >
              {item.label}
            </button>
          ))}
          </div>
        </div>

        <button
          type="button"
          onClick={importPendingTransactions}
          disabled={importing}
          className="btn-primary w-full sm:w-auto sm:ml-auto"
        >
          <span className="inline-flex items-center gap-2">
            {importing ? 'Importando...' : <><Upload size={14} /> Importar transações</>}
          </span>
        </button>
      </div>

      <div className="panel p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label block mb-1.5">Ordenar por</label>
          <select
            className="input-field"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
          >
            <option value="tx_date">Data da transação</option>
            <option value="amount">Valor</option>
            <option value="status">Status</option>
            <option value="category">Categoria</option>
            <option value="provider">Provedor</option>
            <option value="created_at">Data de ingestão</option>
          </select>
        </div>
        <div>
          <label className="label block mb-1.5">Direção</label>
          <select
            className="input-field"
            value={sortDir}
            onChange={(event) => setSortDir(event.target.value)}
          >
            <option value="desc">Decrescente</option>
            <option value="asc">Crescente</option>
          </select>
        </div>
      </div>

      {stats.uncategorizedTotal > 0 && (
        <div className="status-warn px-4 py-3 text-xs">
          {stats.uncategorizedExpense > 0 && `${stats.uncategorizedExpense} despesa(s)`}
          {stats.uncategorizedExpense > 0 && stats.uncategorizedIncome > 0 && ' e '}
          {stats.uncategorizedIncome > 0 && `${stats.uncategorizedIncome} receita(s)`}
          {' '}pendente(s) sem categoria válida serão ignoradas na importação.
        </div>
      )}

      {importStatus && (
        <div className="status-success px-4 py-3 text-xs">{importStatus}</div>
      )}

      <div className="space-y-3">
        {loading && (
          <div className="glass-card p-10 text-center text-slate-400">
            <RefreshCw size={20} className="inline animate-spin" />
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="glass-card p-10 text-center text-slate-400">Nenhuma transação no filtro atual.</div>
        )}

        {!loading && rows.map((row) => {
          const busy = savingRow === row.id
          const isExpense = row.direction === 'expense'
          const isIncome = row.direction === 'income'
          const categoryOptions = isIncome ? incomeCategories : expenseCategories

          return (
            <article key={row.id} className={`panel p-4 sm:p-6 flex flex-col gap-4 transition-all ${row.status === 'excluded' ? 'opacity-50 grayscale' : ''}`}>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl text-white tracking-wide leading-tight truncate-2 break-words" style={{ fontFamily: '"DM Serif Text", serif' }}>{row.description || '(sem descrição)'}</h3>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-2 text-[11px] font-mono tracking-widest uppercase text-[var(--text-muted)]">
                    <span>{row.tx_date || 'sem data'}</span>
                    <span className="border border-[#333] px-1.5 py-0.5">{row.provider}</span>
                    <span className="border border-[#333] px-1.5 py-0.5">{row.direction}</span>
                    <span className={row.status === 'pending' ? 'text-[var(--color-warn)]' : row.status === 'imported' ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'}>{row.status}</span>
                    {row.exclude_reason && <span className="text-[var(--color-expense)]">{row.exclude_reason}</span>}
                  </div>
                </div>
                <div className={`text-2xl whitespace-nowrap text-right ${isExpense ? 'text-[var(--color-expense)]' : 'text-[var(--color-income)]'}`} style={{ fontFamily: '"DM Serif Text", serif' }}>
                  {isExpense ? '-' : '+'}{fmt(row.amount)}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-center">
                <div>
                  <label className="label block mb-1.5">Categoria {isIncome ? '(receita)' : '(despesa)'}</label>
                  <select
                    className="input-field"
                    value={row.category || ''}
                    disabled={busy}
                    onChange={(event) => updateRow(row.id, { category: event.target.value, status: row.status === 'excluded' ? 'pending' : row.status })}
                  >
                    <option value="">Sem categoria</option>
                    {categoryOptions.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>

                {row.status !== 'imported' && (
                    <div className="inline-flex border border-[#333] p-1 justify-self-start sm:justify-self-end">
                      <button
                        type="button"
                        onClick={() => updateRow(row.id, { status: 'pending', exclude_reason: '' })}
                        disabled={busy}
                        className={`px-3 py-2 text-[11px] font-mono uppercase tracking-widest transition ${row.status === 'pending' ? 'bg-[var(--color-income)] text-black font-bold' : 'text-[var(--text-secondary)] hover:text-white'}`}
                      >
                        <span className="inline-flex items-center gap-1.5"><Check size={12} /> Manter</span>
                      </button>
                    <button
                      type="button"
                      onClick={() => updateRow(row.id, { status: 'excluded', exclude_reason: row.exclude_reason || 'manual_exclusion' })}
                      disabled={busy}
                        className={`px-3 py-2 text-[11px] font-mono uppercase tracking-widest transition ${row.status === 'excluded' ? 'bg-[var(--color-expense)] text-black font-bold' : 'text-[var(--text-secondary)] hover:text-white'}`}
                      >
                      <span className="inline-flex items-center gap-1.5"><CircleSlash2 size={12} /> Excluir</span>
                    </button>
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>

      <div className="text-[11px] font-mono uppercase tracking-widest text-[var(--text-muted)] border-t border-[var(--border-color)] pt-4 inline-flex items-center gap-2">
        <Inbox size={14} /> A Inbox recebe transações via API e substitui o fluxo de curadoria CSV.
      </div>
    </div>
  )
}
