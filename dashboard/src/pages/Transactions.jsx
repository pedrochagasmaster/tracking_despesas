import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import MonthPicker from '../components/MonthPicker'
import DataHealthBadge from '../components/DataHealthBadge'
import StatePanel from '../components/StatePanel'
import { Search, Filter, RefreshCw, TrendingDown, TrendingUp, PenSquare, Trash2, X, AlertCircle, Plus, Wallet } from 'lucide-react'
import { currentMonthKey } from '../utils/date'
import { currency, formatMonthLabel } from '../utils/format'

const kindBadge = { one_off: 'badge-blue', subscription: 'badge-violet', installment: 'badge-yellow' }
const kindLabel = { one_off: 'Avulso', subscription: 'Assinatura', installment: 'Parcelado' }

function AddEntryModal({ onClose, onSave, categories = [] }) {
  const [tab, setTab] = useState('expense')
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    expense_date: today,
    income_date: today,
    installment_start_date: today,
    amount: '',
    total_amount: '',
    installments: '12',
    category: '',
    description: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [customCategory, setCustomCategory] = useState(false)
  const [newCategory, setNewCategory] = useState('')

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  const effectiveCategory = customCategory ? newCategory.trim() : form.category

  async function submit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      if (tab === 'expense') {
        const amount = parseFloat(form.amount)
        if (!amount || !effectiveCategory || !form.description || !form.expense_date) throw new Error('Preencha todos os campos.')
        await api.addExpense({
          expense_date: form.expense_date,
          amount,
          category: effectiveCategory,
          description: form.description,
        })
      } else if (tab === 'income') {
        const amount = parseFloat(form.amount)
        if (!amount || !effectiveCategory || !form.description || !form.income_date) throw new Error('Preencha todos os campos.')
        await api.addIncome({
          income_date: form.income_date,
          amount,
          category: effectiveCategory,
          description: form.description,
        })
      } else {
        const totalAmount = parseFloat(form.total_amount)
        const installments = parseInt(form.installments, 10)
        if (!totalAmount || !installments || !effectiveCategory || !form.description || !form.installment_start_date) {
          throw new Error('Preencha todos os campos do parcelado.')
        }
        await api.addInstallment({
          start_date: form.installment_start_date,
          total_amount: totalAmount,
          installments,
          category: effectiveCategory,
          description: form.description,
        })
      }
      onSave()
    } catch (err) {
      setError(err.message || 'Falha ao salvar lançamento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="panel w-full max-w-md p-8 animate-slide-up">
        <div className="flex items-center justify-between mb-6 border-b border-[var(--border-color)] pb-4">
          <h3 className="text-xl text-white" style={{ fontFamily: '"DM Serif Text", serif' }}>Novo Lançamento</h3>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>

        <div className="flex gap-2 mb-6 p-1 bg-[var(--bg-surface)] border border-[var(--border-color)]">
          {[
            ['expense', 'Despesa'],
            ['income', 'Receita'],
            ['installment', 'Parcelado'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex-1 py-2 text-xs font-mono uppercase tracking-wider transition-all ${tab === key ? 'bg-[var(--bg-panel)] text-white border border-[var(--border-strong)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-transparent'
                }`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label block mb-1">Data</label>
            {tab === 'expense' && (
              <input type="date" className="input-field" value={form.expense_date} onChange={(e) => set('expense_date', e.target.value)} />
            )}
            {tab === 'income' && (
              <input type="date" className="input-field" value={form.income_date} onChange={(e) => set('income_date', e.target.value)} />
            )}
            {tab === 'installment' && (
              <input type="date" className="input-field" value={form.installment_start_date} onChange={(e) => set('installment_start_date', e.target.value)} />
            )}
          </div>

          {tab !== 'installment' && (
            <div>
              <label className="label block mb-1">Valor (R$)</label>
              <input type="number" step="0.01" min="0" className="input-field" value={form.amount} onChange={(e) => set('amount', e.target.value)} />
            </div>
          )}

          {tab === 'installment' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label block mb-1">Valor Total (R$)</label>
                <input type="number" step="0.01" min="0" className="input-field" value={form.total_amount} onChange={(e) => set('total_amount', e.target.value)} />
              </div>
              <div>
                <label className="label block mb-1">Parcelas</label>
                <input type="number" min="2" max="120" className="input-field" value={form.installments} onChange={(e) => set('installments', e.target.value)} />
              </div>
            </div>
          )}

          <div>
            <label className="label block mb-1">Categoria</label>
            <select
              className="input-field"
              value={customCategory ? '__new__' : form.category}
              onChange={(e) => {
                if (e.target.value === '__new__') {
                  setCustomCategory(true)
                  set('category', '')
                } else {
                  setCustomCategory(false)
                  setNewCategory('')
                  set('category', e.target.value)
                }
              }}
            >
              <option value="">Selecione...</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="__new__">+ Nova categoria</option>
            </select>
            {customCategory && (
              <input className="input-field mt-2" placeholder="Nome da nova categoria" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
            )}
          </div>
          <div>
            <label className="label block mb-1">Descrição</label>
            <input className="input-field" value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>

          {error && <div className="text-xs text-[var(--color-expense)]">{error}</div>}
          <button disabled={saving} type="submit" className="btn-primary w-full mt-2 py-2.5 disabled:opacity-60">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
      </div>
    </div>
  )
}

function ExpenseEditModal({ expense, onClose, onSave, categories = [] }) {
  const isExistingCategoryKnown = categories.includes(expense.category)
  const [form, setForm] = useState({
    expense_date: expense.expense_date,
    amount: String(expense.amount),
    category: expense.category,
    description: expense.description,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [customCategory, setCustomCategory] = useState(!isExistingCategoryKnown && Boolean(expense.category))
  const [newCategory, setNewCategory] = useState(!isExistingCategoryKnown ? expense.category : '')

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  const effectiveCategory = customCategory ? newCategory.trim() : form.category

  async function submit(e) {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!amount || !effectiveCategory || !form.description || !form.expense_date) {
      setError('Preencha todos os campos.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await api.updateExpense(expense.id, {
        expense_date: form.expense_date,
        amount,
        category: effectiveCategory,
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
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="panel w-full max-w-md p-8 animate-slide-up">
        <div className="flex items-center justify-between mb-6 border-b border-[var(--border-color)] pb-4">
          <h3 className="text-xl text-white" style={{ fontFamily: '"DM Serif Text", serif' }}>Editar Despesa</h3>
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
            <select
              className="input-field"
              value={customCategory ? '__new__' : form.category}
              onChange={(e) => {
                if (e.target.value === '__new__') {
                  setCustomCategory(true)
                  set('category', '')
                } else {
                  setCustomCategory(false)
                  setNewCategory('')
                  set('category', e.target.value)
                }
              }}
            >
              <option value="">Selecione...</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="__new__">+ Nova categoria</option>
            </select>
            {customCategory && (
              <input className="input-field mt-2" placeholder="Nome da nova categoria" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
            )}
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

export default function Transactions({ offlineBanner: OfflineBanner }) {
  const [month, setMonth] = useState(currentMonthKey)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [tab, setTab] = useState('expenses')
  const [expenses, setExpenses] = useState([])
  const [incomes, setIncomes] = useState([])
  const [categories, setCategories] = useState([])
  const [meta, setMeta] = useState(null)
  const [offlineInfo, setOfflineInfo] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState('')
  const [editingExpense, setEditingExpense] = useState(null)
  const [busyExpenseId, setBusyExpenseId] = useState(null)
  const [busyInstallmentId, setBusyInstallmentId] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    if (!month) return
    setLoading(true)
    setLoadError('')
    try {
      const [e, i, c, m] = await Promise.all([api.expenses(month), api.incomes(month), api.categories(), api.systemMeta()])
      setExpenses(e)
      setIncomes(i)
      setCategories(c)
      setMeta(m)
      setOfflineInfo([
        e?.__offline ? { cachedAt: e.__offlineCachedAt, source: e.__offlineSource } : null,
        i?.__offline ? { cachedAt: i.__offlineCachedAt, source: i.__offlineSource } : null,
        c?.__offline ? { cachedAt: c.__offlineCachedAt, source: c.__offlineSource } : null,
        m?.__offline ? { cachedAt: m.__offlineCachedAt, source: m.__offlineSource } : null,
      ].filter(Boolean))
    } catch (err) {
      setLoadError(err.message || 'Falha ao carregar transações.')
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { load() }, [load])

  async function onDeleteExpense(row) {
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

  async function onDeleteInstallmentGroup(row) {
    if (!row?.installment_id) return
    const label = row.installment_total ? `${row.installment_total} parcelas` : 'todas as parcelas'
    const ok = window.confirm(
      `Excluir o parcelado "${row.description}" (${label}) inteiro? Esta ação remove todas as parcelas.`,
    )
    if (!ok) return

    setBusyInstallmentId(row.installment_id)
    setActionError('')
    try {
      await api.deleteInstallment(row.installment_id)
      await load()
    } catch (err) {
      setActionError(err.message || 'Falha ao excluir parcelado completo.')
    } finally {
      setBusyInstallmentId(null)
    }
  }

  function isBusyRow(row) {
    if (busyExpenseId === row.id) return true
    return Boolean(row.installment_id) && busyInstallmentId === row.installment_id
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
  const netFiltered = totalIncomes - totalExpenses
  const monthLabel = formatMonthLabel(month)
  const hasFilters = Boolean(search) || (tab === 'expenses' && catFilter !== 'all')

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 border-b border-[var(--border-color)] pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl text-white tracking-tight leading-none" style={{ fontFamily: '"DM Serif Text", serif' }}>Transações</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-3">Lista operacional para entender o que entrou, o que saiu e corrigir rápido quando algo estiver errado.</p>
          </div>
          <div className="flex items-center gap-3">
            {month && <MonthPicker value={month} onChange={setMonth} />}
            <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 whitespace-nowrap">
              <Plus size={15} /> Lançamento
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="stat-chip">Competência: {monthLabel}</div>
          {meta && <DataHealthBadge meta={meta} />}
        </div>
      </div>

      {offlineInfo.length > 0 && OfflineBanner ? <OfflineBanner sources={offlineInfo} /> : null}

      {actionError && (
        <div className="status-error p-3 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{actionError}</span>
        </div>
      )}

      {loadError && (
        <StatePanel
          kind="error"
          title="Falha ao carregar transações"
          description={loadError}
          action={<button onClick={load} className="btn-primary">Tentar novamente</button>}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="panel p-6 flex items-center gap-5 border-l-2 border-l-[var(--color-expense)]">
          <div className="w-10 h-10 border border-[var(--border-color)] flex items-center justify-center">
            <TrendingDown size={16} className="text-[var(--color-expense)]" />
          </div>
          <div>
            <div className="label" style={{ fontFamily: '"Space Mono", monospace' }}>Total Despesas</div>
            <div className="text-3xl text-white mt-1" style={{ fontFamily: '"DM Serif Text", serif' }}>{currency(totalExpenses)}</div>
          </div>
          <span className="ml-auto text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">{filteredExpenses.length} itens</span>
        </div>
        <div className="panel p-6 flex items-center gap-5 border-l-2 border-l-[var(--color-income)]">
          <div className="w-10 h-10 border border-[var(--border-color)] flex items-center justify-center">
            <TrendingUp size={16} className="text-[var(--color-income)]" />
          </div>
          <div>
            <div className="label" style={{ fontFamily: '"Space Mono", monospace' }}>Total Receitas</div>
            <div className="text-3xl text-white mt-1" style={{ fontFamily: '"DM Serif Text", serif' }}>{currency(totalIncomes)}</div>
          </div>
          <span className="ml-auto text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">{filteredIncomes.length} itens</span>
        </div>
        <div className="panel p-6 flex items-center gap-5 border-l-2 border-l-[var(--color-info)]">
          <div className="w-10 h-10 border border-[var(--border-color)] flex items-center justify-center">
            <Wallet size={16} className="text-[var(--color-info)]" />
          </div>
          <div>
            <div className="label" style={{ fontFamily: '"Space Mono", monospace' }}>Resultado filtrado</div>
            <div className={`text-3xl mt-1 ${netFiltered >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'}`} style={{ fontFamily: '"DM Serif Text", serif' }}>{currency(netFiltered)}</div>
          </div>
          <span className="ml-auto text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-widest">receitas - despesas</span>
        </div>
      </div>

      <div className="panel p-4 flex flex-wrap items-center gap-4">
        <div className="flex gap-2 p-1 bg-[var(--bg-surface)] border border-[var(--border-color)]">
          {['expenses', 'incomes'].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-6 py-2 text-xs font-mono uppercase tracking-wider transition-all ${tab === t ? 'bg-[#1a1a1a] text-white border border-[#333]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-transparent'}`}>
              {t === 'expenses' ? 'Despesas' : 'Receitas'}
            </button>
          ))}
        </div>

        <div className="relative basis-full lg:basis-auto flex-1 min-w-52">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input className="input-field pl-9" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {tab === 'expenses' && (
          <div className="relative basis-full sm:basis-auto">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <select className="input-field pl-9 pr-8 appearance-none bg-none" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
              <option value="all">Todas categorias</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="panel p-3 space-y-2 md:hidden">
        {loading && (
          <div className="table-cell text-center py-8">
            <RefreshCw size={20} className="inline animate-spin text-[var(--text-secondary)]" />
          </div>
        )}
        {!loading && !loadError && displayRows.length === 0 && (
          <StatePanel
            kind={hasFilters ? 'filtered' : 'empty'}
            title={hasFilters ? 'Nenhum resultado para este filtro' : 'Nenhuma transação neste período'}
            description={hasFilters ? 'A busca/filtro atual não encontrou nada. Tente limpar os filtros.' : 'Não há lançamentos para a competência selecionada.'}
            action={hasFilters ? <button onClick={() => { setSearch(''); setCatFilter('all') }} className="btn-ghost">Limpar filtros</button> : null}
          />
        )}
        {!loading && !loadError && displayRows.map((row) => (
          <div key={row.id} className="interactive-card border border-[var(--border-color)] bg-[var(--bg-panel)] p-4 text-sm group hover:bg-[var(--bg-surface)]">
            <div className="min-w-0 mb-3">
              <div className="font-medium text-[#ccc] truncate group-hover:text-white">{row.description}</div>
              <div className="text-[11px] font-mono text-[var(--text-muted)] mt-1 uppercase group-hover:text-[var(--text-secondary)]">{row.expense_date || row.income_date}</div>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="badge-blue">{row.category}</span>
              {tab === 'expenses' && (
                <span className={kindBadge[row.kind] ?? 'badge-blue'}>{kindLabel[row.kind] ?? row.kind}</span>
              )}
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)]">
              <div className={`font-mono text-lg ${tab === 'expenses' ? 'text-[var(--color-expense)]' : 'text-[var(--color-income)]'}`}>
                {tab === 'expenses' ? '-' : '+'}{currency(row.amount)}
              </div>
              {tab === 'expenses' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isBusyRow(row)}
                    onClick={() => setEditingExpense(row)}
                    className="btn-ghost tap-target p-1.5 disabled:opacity-40"
                    title="Editar"
                  >
                    <PenSquare size={14} />
                  </button>
                  {row.kind === 'installment' && row.installment_id && (
                    <button
                      type="button"
                      disabled={isBusyRow(row)}
                      onClick={() => onDeleteInstallmentGroup(row)}
                      className="btn-ghost tap-target p-1.5 text-[var(--color-warn)] hover:text-yellow-200 disabled:opacity-40"
                      title="Excluir parcelado inteiro"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isBusyRow(row)}
                    onClick={() => onDeleteExpense(row)}
                    className="btn-ghost tap-target p-1.5 text-[var(--color-expense)] hover:text-red-300 disabled:opacity-40"
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--bg-panel)]">
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
            <tbody className="divide-y divide-[#1a1a1a]">
              {loading && (
                <tr><td colSpan={7} className="table-cell text-center py-10">
                  <RefreshCw size={20} className="inline animate-spin text-[var(--text-secondary)]" />
                </td></tr>
              )}
              {!loading && !loadError && displayRows.length === 0 && (
                <tr><td colSpan={7} className="table-cell text-center text-[var(--text-muted)] py-10">{hasFilters ? 'Nenhum resultado para o filtro atual.' : 'Nenhuma transação encontrada para esta competência.'}</td></tr>
              )}
              {!loading && !loadError && displayRows.map((row) => (
                <tr key={row.id} className="hover:bg-[var(--bg-surface)] transition-colors group">
                  <td className="table-cell text-[var(--text-muted)] font-mono text-[11px] group-hover:text-[var(--text-secondary)] whitespace-nowrap">{row.expense_date || row.income_date}</td>
                  <td className="table-cell text-[#ccc] group-hover:text-white max-w-xs truncate">{row.description}</td>
                  <td className="table-cell hidden sm:table-cell"><span className="badge-blue">{row.category}</span></td>
                  {tab === 'expenses' && <td className="table-cell hidden md:table-cell"><span className={kindBadge[row.kind] ?? 'badge-blue'}>{kindLabel[row.kind] ?? row.kind}</span></td>}
                  {tab === 'expenses' && <td className="table-cell hidden lg:table-cell text-[var(--text-muted)] text-[11px] font-mono">{row.installment_number ? `${row.installment_number}/${row.installment_total}` : '—'}</td>}
                  <td className={`table-cell text-right font-mono text-sm group-hover:opacity-80 ${tab === 'expenses' ? 'text-[var(--color-expense)]' : 'text-[var(--color-income)]'}`}>
                    {tab === 'expenses' ? '-' : '+'}{currency(row.amount)}
                  </td>
                  {tab === 'expenses' && (
                    <td className="table-cell text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isBusyRow(row)}
                          onClick={() => setEditingExpense(row)}
                          className="btn-ghost p-1.5 disabled:opacity-40"
                          title="Editar despesa"
                        >
                          <PenSquare size={14} />
                        </button>
                        {row.kind === 'installment' && row.installment_id && (
                          <button
                            type="button"
                            disabled={isBusyRow(row)}
                            onClick={() => onDeleteInstallmentGroup(row)}
                            className="btn-ghost p-1.5 text-[var(--color-warn)] hover:text-yellow-200 disabled:opacity-40"
                            title="Excluir parcelado inteiro"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isBusyRow(row)}
                          onClick={() => onDeleteExpense(row)}
                          className="btn-ghost p-1.5 text-[var(--color-expense)] hover:text-red-300 disabled:opacity-40"
                          title="Excluir despesa"
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
            {tab === 'expenses' && <span className="text-xs text-slate-500">Despesas avulsas e parcelas podem ser editadas/excluídas. Parcelados também podem ser excluídos em lote.</span>}
            <span className="text-xs text-slate-600 ml-auto">{displayRows.length} registros</span>
          </div>
        )}
      </div>

      {editingExpense && (
        <ExpenseEditModal
          expense={editingExpense}
          categories={categories}
          onClose={() => setEditingExpense(null)}
          onSave={() => {
            setEditingExpense(null)
            load()
          }}
        />
      )}
      {showAddModal && (
        <AddEntryModal
          categories={categories}
          onClose={() => setShowAddModal(false)}
          onSave={() => {
            setShowAddModal(false)
            load()
          }}
        />
      )}
    </div>
  )
}
