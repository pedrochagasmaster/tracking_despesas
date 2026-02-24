import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import MonthPicker from '../components/MonthPicker'
import { Search, Filter, RefreshCw, TrendingDown, TrendingUp, PenSquare, Trash2, X, AlertCircle } from 'lucide-react'
import { currentMonthKey } from '../utils/date'

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const kindBadge = { one_off: 'badge-blue', subscription: 'badge-violet', installment: 'badge-yellow' }
const kindLabel = { one_off: 'Avulso', subscription: 'Assinatura', installment: 'Parcelado' }

function ExpenseEditModal({ expense, onClose, onSave }) {
  const [form, setForm] = useState({
    expense_date: expense.expense_date,
    amount: String(expense.amount),
    category: expense.category,
    description: expense.description,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit(e) {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!amount || !form.category || !form.description || !form.expense_date) {
      setError('Preencha todos os campos.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await api.updateExpense(expense.id, {
        expense_date: form.expense_date,
        amount,
        category: form.category,
        description: form.description,
      })
      onSave()
    } catch (err) {
      setError(err.message || 'Falha ao salvar alteração.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-md p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-slate-100">Editar Despesa</h3>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label block mb-1">Data</label>
            <input type="date" className="input-field" value={form.expense_date} onChange={(e) => set('expense_date', e.target.value)} />
          </div>
          <div>
            <label className="label block mb-1">Valor (R$)</label>
            <input type="number" step="0.01" min="0" className="input-field" value={form.amount} onChange={(e) => set('amount', e.target.value)} />
          </div>
          <div>
            <label className="label block mb-1">Categoria</label>
            <input className="input-field" value={form.category} onChange={(e) => set('category', e.target.value)} />
          </div>
          <div>
            <label className="label block mb-1">Descrição</label>
            <input className="input-field" value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          {error && <div className="text-xs text-red-400">{error}</div>}
          <button disabled={saving} type="submit" className="btn-primary w-full mt-2 py-2.5 disabled:opacity-60">
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function Transactions() {
  const [month, setMonth] = useState(currentMonthKey)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [tab, setTab] = useState('expenses')
  const [expenses, setExpenses] = useState([])
  const [incomes, setIncomes] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState('')
  const [editingExpense, setEditingExpense] = useState(null)
  const [busyExpenseId, setBusyExpenseId] = useState(null)

  const load = useCallback(async () => {
    if (!month) return
    setLoading(true)
    try {
      const [e, i, c] = await Promise.all([api.expenses(month), api.incomes(month), api.categories()])
      setExpenses(e)
      setIncomes(i)
      setCategories(c)
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { load() }, [load])

  function canEditExpense(row) {
    return row.kind === 'one_off'
  }

  async function onDeleteExpense(row) {
    if (!canEditExpense(row)) return
    const ok = window.confirm(`Excluir a despesa "${row.description}"?`)
    if (!ok) return

    setBusyExpenseId(row.id)
    setActionError('')
    try {
      await api.deleteExpense(row.id)
      await load()
    } catch (err) {
      setActionError(err.message || 'Falha ao excluir despesa.')
    } finally {
      setBusyExpenseId(null)
    }
  }

  const filteredExpenses = expenses.filter((e) =>
    (catFilter === 'all' || e.category === catFilter) &&
    (e.description.toLowerCase().includes(search.toLowerCase()) || e.category.toLowerCase().includes(search.toLowerCase()))
  )
  const filteredIncomes = incomes.filter((i) =>
    i.description.toLowerCase().includes(search.toLowerCase()) || i.category.toLowerCase().includes(search.toLowerCase())
  )

  const displayRows = tab === 'expenses' ? filteredExpenses : filteredIncomes
  const totalExpenses = filteredExpenses.reduce((s, e) => s + e.amount, 0)
  const totalIncomes = filteredIncomes.reduce((s, i) => s + i.amount, 0)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Transações</h1>
          <p className="text-sm text-slate-400 mt-0.5">Despesas e receitas do período</p>
        </div>
        {month && <MonthPicker value={month} onChange={setMonth} />}
      </div>

      {actionError && (
        <div className="glass-card p-3 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{actionError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <TrendingDown size={18} className="text-red-400" />
          </div>
          <div>
            <div className="label">Total Despesas</div>
            <div className="text-xl font-bold text-red-400">{fmt(totalExpenses)}</div>
          </div>
          <span className="ml-auto text-xs text-slate-600">{filteredExpenses.length} itens</span>
        </div>
        <div className="glass-card px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <TrendingUp size={18} className="text-emerald-400" />
          </div>
          <div>
            <div className="label">Total Receitas</div>
            <div className="text-xl font-bold text-emerald-400">{fmt(totalIncomes)}</div>
          </div>
          <span className="ml-auto text-xs text-slate-600">{filteredIncomes.length} itens</span>
        </div>
      </div>

      <div className="glass-card p-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5 bg-slate-900/60 p-1 rounded-xl">
          {['expenses', 'incomes'].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-violet-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              {t === 'expenses' ? 'Despesas' : 'Receitas'}
            </button>
          ))}
        </div>

        <div className="relative basis-full lg:basis-auto flex-1 min-w-52">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input-field pl-8" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {tab === 'expenses' && (
          <div className="relative basis-full sm:basis-auto">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <select className="input-field pl-8 pr-8 appearance-none" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              <option value="all">Todas categorias</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="glass-card p-3 space-y-2 md:hidden">
        {loading && (
          <div className="table-cell text-center py-8">
            <RefreshCw size={20} className="inline animate-spin text-violet-500" />
          </div>
        )}
        {!loading && displayRows.length === 0 && (
          <div className="table-cell text-center text-slate-500 py-6">Nenhum resultado para os filtros atuais.</div>
        )}
        {!loading && displayRows.map((row) => (
          <div key={row.id} className="rounded-xl border border-slate-700/50 bg-slate-800/45 px-3 py-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-200 truncate">{row.description}</div>
              <div className="text-xs text-slate-400 mt-1">{row.expense_date || row.income_date}</div>
            </div>
            <div className={`mt-2 text-base font-bold ${tab === 'expenses' ? 'text-red-400' : 'text-emerald-400'}`}>
              {tab === 'expenses' ? '-' : '+'}{fmt(row.amount)}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
              <span className="badge-blue">{row.category}</span>
              {tab === 'expenses' && (
                <span className={kindBadge[row.kind] ?? 'badge-blue'}>{kindLabel[row.kind] ?? row.kind}</span>
              )}
            </div>
            {tab === 'expenses' && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  disabled={!canEditExpense(row) || busyExpenseId === row.id}
                  onClick={() => setEditingExpense(row)}
                  className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
                  title={canEditExpense(row) ? 'Editar despesa' : 'Somente despesas avulsas podem ser editadas'}
                >
                  <span className="inline-flex items-center gap-1"><PenSquare size={13} /> Editar</span>
                </button>
                <button
                  type="button"
                  disabled={!canEditExpense(row) || busyExpenseId === row.id}
                  onClick={() => onDeleteExpense(row)}
                  className="btn-ghost px-3 py-1.5 text-xs text-red-300 hover:text-red-200 disabled:opacity-40"
                  title={canEditExpense(row) ? 'Excluir despesa' : 'Somente despesas avulsas podem ser excluídas'}
                >
                  <span className="inline-flex items-center gap-1"><Trash2 size={13} /> Excluir</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="hidden md:block glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-800/60">
              <tr>
                <th className="table-header text-left">Data</th>
                <th className="table-header text-left">Descrição</th>
                <th className="table-header text-left hidden sm:table-cell">Categoria</th>
                {tab === 'expenses' && <th className="table-header text-left hidden md:table-cell">Tipo</th>}
                {tab === 'expenses' && <th className="table-header text-left hidden lg:table-cell">Parcela</th>}
                <th className="table-header text-right">Valor</th>
                {tab === 'expenses' && <th className="table-header text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/25">
              {loading && (
                <tr><td colSpan={7} className="table-cell text-center py-10">
                  <RefreshCw size={20} className="inline animate-spin text-violet-500" />
                </td></tr>
              )}
              {!loading && displayRows.length === 0 && (
                <tr><td colSpan={7} className="table-cell text-center text-slate-500 py-10">Nenhum resultado para os filtros atuais.</td></tr>
              )}
              {!loading && displayRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="table-cell text-slate-400 whitespace-nowrap">{row.expense_date || row.income_date}</td>
                  <td className="table-cell text-slate-200 font-medium max-w-xs truncate">{row.description}</td>
                  <td className="table-cell hidden sm:table-cell"><span className="badge-blue">{row.category}</span></td>
                  {tab === 'expenses' && <td className="table-cell hidden md:table-cell"><span className={kindBadge[row.kind] ?? 'badge-blue'}>{kindLabel[row.kind] ?? row.kind}</span></td>}
                  {tab === 'expenses' && <td className="table-cell hidden lg:table-cell text-slate-500 text-xs">{row.installment_number ? `${row.installment_number}/${row.installment_total}` : '—'}</td>}
                  <td className={`table-cell text-right font-semibold ${tab === 'expenses' ? 'text-red-400' : 'text-emerald-400'}`}>
                    {tab === 'expenses' ? '-' : '+'}{fmt(row.amount)}
                  </td>
                  {tab === 'expenses' && (
                    <td className="table-cell text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          disabled={!canEditExpense(row) || busyExpenseId === row.id}
                          onClick={() => setEditingExpense(row)}
                          className="btn-ghost p-1.5 disabled:opacity-40"
                          title={canEditExpense(row) ? 'Editar despesa' : 'Somente despesas avulsas podem ser editadas'}
                        >
                          <PenSquare size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={!canEditExpense(row) || busyExpenseId === row.id}
                          onClick={() => onDeleteExpense(row)}
                          className="btn-ghost p-1.5 text-red-300 hover:text-red-200 disabled:opacity-40"
                          title={canEditExpense(row) ? 'Excluir despesa' : 'Somente despesas avulsas podem ser excluídas'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && displayRows.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-800/40 flex justify-between items-center gap-2">
            {tab === 'expenses' && <span className="text-xs text-slate-500">Somente despesas avulsas podem ser editadas/excluídas.</span>}
            <span className="text-xs text-slate-600 ml-auto">{displayRows.length} registros</span>
          </div>
        )}
      </div>

      {editingExpense && (
        <ExpenseEditModal
          expense={editingExpense}
          onClose={() => setEditingExpense(null)}
          onSave={() => {
            setEditingExpense(null)
            load()
          }}
        />
      )}
    </div>
  )
}
