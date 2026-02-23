import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import MonthPicker from '../components/MonthPicker'
import { RefreshCw, Plus, X, Target, PenSquare, Trash2, AlertCircle } from 'lucide-react'
import { currentMonthKey } from '../utils/date'

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function BudgetRow({ item, onEdit, onDelete, busy }) {
  const over = item.remaining < 0
  const pct = item.pct

  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
  const textColor = pct >= 90 ? 'text-red-400' : pct >= 70 ? 'text-amber-400' : 'text-emerald-400'

  return (
    <div className="p-5 border-b border-slate-800/30 last:border-b-0 hover:bg-slate-800/20 transition-colors">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className={`w-2 h-2 rounded-full ${barColor}`} />
          <span className="font-medium text-slate-200">{item.category}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-slate-500">{fmt(item.spent)} / {fmt(item.budgeted)}</span>
          <span className={`font-bold ${textColor}`}>{pct.toFixed(0)}%</span>
          {over && <span className="badge-red">ACIMA</span>}
          <button type="button" disabled={busy} onClick={() => onEdit(item)} className="btn-ghost p-1.5" title="Editar orçamento">
            <PenSquare size={14} />
          </button>
          <button type="button" disabled={busy} onClick={() => onDelete(item)} className="btn-ghost p-1.5 text-red-300 hover:text-red-200" title="Excluir orçamento">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="bg-slate-900/60 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-xs text-slate-600">
        <span>{over ? 'Excedeu em' : 'Restante'}: {fmt(Math.abs(item.remaining))}</span>
      </div>
    </div>
  )
}

function BudgetModal({ initial, onClose, onSave }) {
  const editing = Boolean(initial)
  const [form, setForm] = useState(() => ({
    category: initial?.category ?? '',
    amount: initial ? String(initial.budgeted) : '',
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit(e) {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!amount || !form.category) {
      setError('Preencha todos os campos.')
      return
    }

    setSaving(true)
    setError('')
    try {
      if (editing) {
        await api.updateBudget({ category: form.category, amount })
      } else {
        await api.setBudget({ category: form.category, amount })
      }
      onSave()
    } catch (err) {
      setError(err.message || 'Falha ao salvar orçamento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-sm p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-slate-100">{editing ? 'Editar Orçamento' : 'Definir Orçamento'}</h3>
          <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div><label className="label block mb-1">Categoria</label>
            <input className="input-field" readOnly={editing} placeholder="ex: Alimentação" value={form.category} onChange={(e) => set('category', e.target.value)} /></div>
          <div><label className="label block mb-1">Orçamento (R$)</label>
            <input type="number" step="0.01" className="input-field" placeholder="0,00" value={form.amount} onChange={(e) => set('amount', e.target.value)} /></div>
          {error && <div className="text-xs text-red-400">{error}</div>}
          <button disabled={saving} type="submit" className="btn-primary w-full mt-2 py-2.5 disabled:opacity-60">{saving ? 'Salvando...' : 'Salvar'}</button>
        </form>
      </div>
    </div>
  )
}

export default function Budgets() {
  const [month, setMonth] = useState(currentMonthKey)
  const [budgets, setBudgets] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalState, setModalState] = useState({ open: false, initial: null })
  const [busyCategory, setBusyCategory] = useState(null)
  const [actionError, setActionError] = useState('')

  const load = useCallback(async () => {
    if (!month) return
    setLoading(true)
    try {
      setBudgets(await api.budgets(month))
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { load() }, [load])

  async function onDeleteBudget(item) {
    const ok = window.confirm(`Excluir orçamento de "${item.category}"?`)
    if (!ok) return

    setBusyCategory(item.category)
    setActionError('')
    try {
      await api.deleteBudget(item.category)
      await load()
    } catch (err) {
      setActionError(err.message || 'Falha ao excluir orçamento.')
    } finally {
      setBusyCategory(null)
    }
  }

  const totalBudget = budgets.reduce((s, b) => s + b.budgeted, 0)
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0)
  const overBudget = budgets.filter((b) => b.remaining < 0).length

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Orçamentos</h1>
          <p className="text-sm text-slate-400 mt-0.5">Metas de gasto por categoria</p>
        </div>
        <div className="flex items-center gap-3">
          {month && <MonthPicker value={month} onChange={setMonth} />}
          <button onClick={() => setModalState({ open: true, initial: null })} className="btn-primary flex items-center gap-2 whitespace-nowrap">
            <Plus size={15} /> Orçamento
          </button>
        </div>
      </div>

      {actionError && (
        <div className="glass-card p-3 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{actionError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card px-5 py-4">
          <div className="label mb-1">Total Orçado</div>
          <div className="text-2xl font-bold text-white">{fmt(totalBudget)}</div>
        </div>
        <div className="glass-card px-5 py-4">
          <div className="label mb-1">Total Gasto</div>
          <div className="text-2xl font-bold text-violet-400">{fmt(totalSpent)}</div>
        </div>
        <div className="glass-card px-5 py-4">
          <div className="label mb-1">Categorias Acima</div>
          <div className={`text-2xl font-bold ${overBudget > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{overBudget}</div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40"><RefreshCw size={24} className="text-violet-500 animate-spin" /></div>
      )}

      {!loading && budgets.length === 0 && (
        <div className="glass-card p-12 text-center">
          <Target size={36} className="mx-auto text-slate-700 mb-3" />
          <div className="text-slate-500">Nenhum orçamento definido para a conta</div>
          <button onClick={() => setModalState({ open: true, initial: null })} className="btn-primary mt-4">Definir orçamento</button>
        </div>
      )}

      {!loading && budgets.length > 0 && (
        <div className="glass-card overflow-hidden">
          {budgets.map((b) => (
            <BudgetRow
              key={b.category}
              item={b}
              busy={busyCategory === b.category}
              onEdit={(item) => setModalState({ open: true, initial: item })}
              onDelete={onDeleteBudget}
            />
          ))}
        </div>
      )}

      {modalState.open && (
        <BudgetModal
          initial={modalState.initial}
          onClose={() => setModalState({ open: false, initial: null })}
          onSave={() => {
            setModalState({ open: false, initial: null })
            load()
          }}
        />
      )}
    </div>
  )
}
