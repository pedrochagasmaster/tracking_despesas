import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import MonthPicker from '../components/MonthPicker'
import DataHealthBadge from '../components/DataHealthBadge'
import StatePanel from '../components/StatePanel'
import { RefreshCw, Plus, X, PenSquare, Trash2, AlertCircle } from 'lucide-react'
import { currentMonthKey } from '../utils/date'
import { currency, formatMonthLabel } from '../utils/format'

function BudgetRow({ item, onEdit, onDelete, busy }) {
  const over = item.remaining < 0
  const pct = item.pct

  const barColor = pct >= 90 ? 'bg-[var(--color-expense)]' : pct >= 70 ? 'bg-[var(--color-warn)]' : 'bg-[var(--color-income)]'
  const textColor = pct >= 90 ? 'text-[var(--color-expense)]' : pct >= 70 ? 'text-[var(--color-warn)]' : 'text-[var(--color-income)]'

  return (
    <div className="interactive-card p-6 border-b border-[var(--border-color)] last:border-b-0 hover:bg-[var(--bg-surface)] group">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-1.5 h-1.5 ${barColor}`} />
          <span className="font-semibold text-white tracking-wide">{item.category}</span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="font-mono text-xs text-[var(--text-secondary)]">{currency(item.spent)} / <span className="text-[#ccc]">{currency(item.budgeted)}</span></span>
          <span className={`font-mono text-sm font-bold ${textColor}`}>{pct.toFixed(0)}%</span>
          {over && <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-expense)] border border-[var(--color-expense)] px-1.5 py-0.5">ACIMA</span>}
          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity ml-2">
            <button type="button" disabled={busy} onClick={() => onEdit(item)} className="btn-ghost tap-target p-1.5" title="Editar">
              <PenSquare size={14} />
            </button>
            <button type="button" disabled={busy} onClick={() => onDelete(item)} className="btn-ghost tap-target p-1.5 text-[var(--color-expense)] hover:text-red-300" title="Excluir">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
      <div className="bg-[#1a1a1a] h-1 w-full overflow-hidden">
        <div
          className={`h-full transition-all duration-700 ${barColor}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <div className="flex justify-between mt-3 text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">
        <span>{over ? 'Excedeu em' : 'Restante'}: {currency(Math.abs(item.remaining))}</span>
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
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="panel w-full max-w-sm p-8 animate-slide-up">
        <div className="flex items-center justify-between mb-6 border-b border-[var(--border-color)] pb-4">
          <h3 className="text-xl text-white" style={{ fontFamily: '"DM Serif Text", serif' }}>{editing ? 'Editar Orçamento' : 'Definir Orçamento'}</h3>
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

export default function Budgets({ offlineBanner: OfflineBanner }) {
  const [month, setMonth] = useState(currentMonthKey)
  const [budgets, setBudgets] = useState([])
  const [meta, setMeta] = useState(null)
  const [offlineInfo, setOfflineInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modalState, setModalState] = useState({ open: false, initial: null })
  const [busyCategory, setBusyCategory] = useState(null)
  const [actionError, setActionError] = useState('')
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    if (!month) return
    setLoading(true)
    setLoadError('')
    try {
      const response = await api.budgets(month)
      setBudgets(response.items || [])
      setMeta(response.meta || null)
      setOfflineInfo(response.__offline ? { cachedAt: response.__offlineCachedAt, source: response.__offlineSource } : null)
    } catch (err) {
      setLoadError(err.message || 'Falha ao carregar orçamentos.')
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
  const monthLabel = formatMonthLabel(month)
  const offlineSources = offlineInfo ? [offlineInfo] : []

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 border-b border-[var(--border-color)] pb-6 mt-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl text-white tracking-tight leading-none" style={{ fontFamily: '"DM Serif Text", serif' }}>Orçamentos</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-3">Ver o que está sob controle, o que está perto do limite e o que já passou dele.</p>
          </div>
          <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            {month && <MonthPicker value={month} onChange={setMonth} className="w-full sm:w-auto justify-center sm:justify-start" />}
            <button onClick={() => setModalState({ open: true, initial: null })} className="btn-primary flex items-center justify-center gap-2 whitespace-nowrap w-full sm:w-auto">
              <Plus size={15} /> Orçamento
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="stat-chip">Competência: {monthLabel}</div>
          {meta && <DataHealthBadge meta={meta} />}
        </div>
      </div>

      {offlineSources.length > 0 && OfflineBanner ? <OfflineBanner sources={offlineSources} /> : null}

      {actionError && (
        <div className="glass-card p-3 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          <span>{actionError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-[var(--border-color)] pb-6">
        <div className="panel p-6 border-t-2 border-t-[#333]">
          <div className="label mb-2" style={{ fontFamily: '"Space Mono", monospace' }}>Total orçado</div>
          <div className="text-3xl text-white" style={{ fontFamily: '"DM Serif Text", serif' }}>{currency(totalBudget)}</div>
        </div>
        <div className="panel p-6 border-t-2 border-t-[var(--color-info)]">
          <div className="label mb-2" style={{ fontFamily: '"Space Mono", monospace' }}>Total gasto</div>
          <div className="text-3xl text-[var(--color-info)]" style={{ fontFamily: '"DM Serif Text", serif' }}>{currency(totalSpent)}</div>
        </div>
        <div className="panel p-6 border-t-2 border-t-[var(--color-warn)]">
          <div className="label mb-2" style={{ fontFamily: '"Space Mono", monospace' }}>Categorias acima</div>
          <div className={`text-3xl ${overBudget > 0 ? 'text-[var(--color-expense)]' : 'text-[var(--color-income)]'}`} style={{ fontFamily: '"DM Serif Text", serif' }}>{overBudget}</div>
          <div className="text-xs text-[var(--text-muted)] mt-2">Urgências aparecem aqui antes de virar surpresa ruim no fim do mês.</div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-40"><RefreshCw size={24} className="text-violet-500 animate-spin" /></div>
      )}

      {!loading && loadError && (
        <StatePanel
          kind="error"
          title="Falha ao carregar orçamentos"
          description={loadError}
          action={<button onClick={load} className="btn-primary">Tentar novamente</button>}
        />
      )}

      {!loading && !loadError && budgets.length === 0 && (
        <StatePanel
          kind="empty"
          title="Nenhum orçamento definido"
          description="Sem orçamento, o painel não consegue dizer com clareza onde você está dentro ou fora do limite. Vale cadastrar pelo menos as categorias principais."
          action={<button onClick={() => setModalState({ open: true, initial: null })} className="btn-primary">Definir orçamento</button>}
        />
      )}

      {!loading && budgets.length > 0 && (
        <div className="panel overflow-hidden border-[var(--border-color)]">
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
