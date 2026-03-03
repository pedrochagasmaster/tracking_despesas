import { useState, useEffect } from 'react'
import { api } from '../api/client'
import MonthPicker from '../components/MonthPicker'
import { RefreshCw, Plus, X, CalendarDays, Repeat, Tag, PenSquare, Trash2 } from 'lucide-react'
import { currentMonthKey } from '../utils/date'

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtMonth = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) + '/mês'

function AddSubModal({ onClose, onSave, initial = null }) {
    const editing = Boolean(initial)
    const [form, setForm] = useState(() => ({
        name: initial?.name ?? '',
        amount: initial?.amount != null ? String(initial.amount) : '',
        category: initial?.category ?? 'Assinaturas',
        frequency: initial?.frequency ?? 'monthly',
        start_date: initial?.start_date ?? new Date().toISOString().slice(0, 10),
        end_date: initial?.end_date ?? '',
        active: initial?.active ?? true,
    }))
    function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
    async function submit(e) {
        e.preventDefault()
        const body = {
            name: form.name,
            amount: parseFloat(form.amount),
            category: form.category,
            frequency: form.frequency,
            start_date: form.start_date,
            end_date: form.end_date || null,
            active: form.active,
        }
        if (editing) {
            await api.updateSubscription(initial.id, body)
        } else {
            await api.addSubscription(body)
        }
        onSave()
    }
    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="panel w-full max-w-md p-8 animate-slide-up">
                <div className="flex items-center justify-between mb-6 border-b border-[var(--border-color)] pb-4">
                    <h3 className="text-xl text-white" style={{ fontFamily: '"DM Serif Text", serif' }}>{editing ? 'Editar Assinatura' : 'Nova Assinatura'}</h3>
                    <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
                </div>
                <form onSubmit={submit} className="space-y-3">
                    <div><label className="label block mb-1">Nome</label>
                        <input className="input-field" placeholder="Netflix" value={form.name} onChange={e => set('name', e.target.value)} /></div>
                    <div><label className="label block mb-1">Valor (R$)</label>
                        <input type="number" step="0.01" className="input-field" placeholder="0,00" value={form.amount} onChange={e => set('amount', e.target.value)} /></div>
                    <div><label className="label block mb-1">Categoria</label>
                        <input className="input-field" value={form.category} onChange={e => set('category', e.target.value)} /></div>
                    <div><label className="label block mb-1">Frequência</label>
                        <select className="input-field" value={form.frequency} onChange={e => set('frequency', e.target.value)}>
                            <option value="monthly">Mensal</option>
                            <option value="yearly">Anual</option>
                        </select></div>
                    <div><label className="label block mb-1">Data de início</label>
                        <input type="date" className="input-field" value={form.start_date} onChange={e => set('start_date', e.target.value)} /></div>
                    <div><label className="label block mb-1">Data de fim (opcional)</label>
                        <input type="date" className="input-field" value={form.end_date} onChange={e => set('end_date', e.target.value)} /></div>
                    <div>
                        <label className="label block mb-1">Status</label>
                        <select className="input-field" value={form.active ? 'yes' : 'no'} onChange={e => set('active', e.target.value === 'yes')}>
                            <option value="yes">Ativa</option>
                            <option value="no">Inativa</option>
                        </select>
                    </div>
                    <button type="submit" className="btn-primary w-full mt-2 py-2.5">{editing ? 'Salvar alterações' : 'Salvar'}</button>
                </form>
            </div>
        </div>
    )
}

function SubCard({ sub, onEdit, onDelete }) {
    const monthly = sub.frequency === 'monthly' ? sub.amount : sub.amount / 12
    const freqLabel = sub.frequency === 'monthly' ? 'Mensal' : 'Anual'

    return (
        <div className={`panel interactive-card p-6 flex flex-col group ${!sub.active ? 'opacity-40 grayscale' : ''}`}>
            <div className="flex items-start justify-between gap-3 mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 border border-[var(--border-color)] flex items-center justify-center">
                        <Repeat size={16} className="text-[var(--text-secondary)] group-hover:text-white transition-colors" />
                    </div>
                    <div>
                        <div className="font-semibold text-white tracking-wide">{sub.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                            <Tag size={10} className="text-[var(--text-muted)]" />
                            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)]">{sub.category}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={() => onEdit(sub)} className="btn-ghost tap-target p-1.5" title="Editar">
                        <PenSquare size={14} />
                    </button>
                    <button type="button" onClick={() => onDelete(sub)} className="btn-ghost tap-target p-1.5 text-[var(--color-expense)] hover:text-red-300" title="Excluir">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            <div className="flex items-end justify-between pt-4 border-t border-[var(--border-color)] mb-3">
                <div>
                    <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-1">Cobrança {freqLabel}</div>
                    <div className="text-2xl text-white" style={{ fontFamily: '"DM Serif Text", serif' }}>{fmt(sub.amount)}</div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)] mb-1">Equivalente/mês</div>
                    <div className="text-sm font-mono text-[var(--color-income)]">{fmtMonth(monthly)}</div>
                </div>
            </div>

            <div className="flex items-center justify-between mt-auto pt-1 text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)]">
                <div className="flex items-center gap-1.5">
                    <CalendarDays size={10} />
                    <span>Desde {sub.start_date}</span>
                </div>
                {!sub.active && <span className="text-[var(--color-warn)] border border-[var(--color-warn)] px-1.5 py-0.5">Inativo</span>}
            </div>
        </div>
    )
}

export default function Subscriptions() {
    const [subs, setSubs] = useState([])
    const [loading, setLoading] = useState(true)
    const [modalState, setModalState] = useState({ open: false, initial: null })
    const [runMonth, setRunMonth] = useState(currentMonthKey)
    const [running, setRunning] = useState(false)
    const [runStatus, setRunStatus] = useState('')
    const [runError, setRunError] = useState('')

    async function load() {
        setLoading(true)
        try { setSubs(await api.subscriptions()) } finally { setLoading(false) }
    }

    useEffect(() => { load() }, [])

    async function onDeleteSub(sub) {
        const ok = window.confirm(`Excluir assinatura "${sub.name}"?`)
        if (!ok) return
        try {
            await api.deleteSubscription(sub.id)
            await load()
        } catch (err) {
            setRunError(err.message || 'Falha ao excluir assinatura.')
        }
    }

    async function runForMonth() {
        setRunning(true)
        setRunStatus('')
        setRunError('')
        try {
            const res = await api.runSubscriptions({ month: runMonth })
            setRunStatus(
                `Mês ${res.month}: ${res.materialized} cobrança(s) lançada(s), `
                + `${res.already_charged} já existentes.`
            )
        } catch (err) {
            setRunError(err.message || 'Falha ao lançar assinaturas.')
        } finally {
            setRunning(false)
        }
    }

    const active = subs.filter(s => s.active)
    const inactive = subs.filter(s => !s.active)
    const totalMonthly = active.reduce((s, sub) => s + (sub.frequency === 'monthly' ? sub.amount : sub.amount / 12), 0)
    const totalYearly = totalMonthly * 12

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-[var(--border-color)] pb-6 mt-4">
                <div>
                    <h1 className="text-4xl text-white tracking-tight leading-none" style={{ fontFamily: '"DM Serif Text", serif' }}>Assinaturas</h1>
                    <p className="text-[11px] text-[var(--text-muted)] mt-3 font-mono uppercase tracking-widest">Serviços recorrentes ativos</p>
                </div>
                <div className="w-full sm:w-auto flex flex-col gap-2 sm:flex-row sm:items-center">
                    <MonthPicker value={runMonth} onChange={setRunMonth} className="w-full sm:w-auto justify-center sm:justify-start" />
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                        <button
                            onClick={runForMonth}
                            disabled={running}
                            className="btn-primary min-h-11 px-4 flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-60"
                        >
                            <RefreshCw size={15} className={running ? 'animate-spin' : ''} />
                            {running ? 'Lançando...' : 'Lançar mês'}
                        </button>
                        <button
                            onClick={() => setModalState({ open: true, initial: null })}
                            className="btn-primary min-h-11 px-4 flex items-center justify-center gap-2 whitespace-nowrap"
                        >
                            <Plus size={15} /> Nova Assinatura
                        </button>
                    </div>
                </div>
            </div>

            {runStatus && (
                <div className="status-success px-4 py-3 text-sm">
                    {runStatus}
                </div>
            )}
            {runError && (
                <div className="status-error px-4 py-3 text-sm">
                    {runError}
                </div>
            )}

            {/* Totals */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-[var(--border-color)] pb-6">
                <div className="panel p-6 border-t-2 border-t-[#333]">
                    <div className="label mb-2" style={{ fontFamily: '"Space Mono", monospace' }}>Assinaturas Ativas</div>
                    <div className="text-3xl text-white" style={{ fontFamily: '"DM Serif Text", serif' }}>{active.length}</div>
                </div>
                <div className="panel p-6 border-t-2 border-t-[var(--color-income)]">
                    <div className="label mb-2" style={{ fontFamily: '"Space Mono", monospace' }}>Custo Mensal</div>
                    <div className="text-3xl text-[var(--color-income)]" style={{ fontFamily: '"DM Serif Text", serif' }}>{fmt(totalMonthly)}</div>
                </div>
                <div className="panel p-6 border-t-2 border-t-[#90a0ad]">
                    <div className="label mb-2" style={{ fontFamily: '"Space Mono", monospace' }}>Custo Anual</div>
                    <div className="text-3xl text-[#90a0ad]" style={{ fontFamily: '"DM Serif Text", serif' }}>{fmt(totalYearly)}</div>
                </div>
            </div>

            {loading && (
                <div className="flex items-center justify-center h-40">
                    <RefreshCw size={24} className="text-violet-500 animate-spin" />
                </div>
            )}

            {!loading && active.length === 0 && (
                <div className="panel p-16 text-center">
                    <Repeat size={32} className="mx-auto text-[#333] mb-4" />
                    <div className="text-[var(--text-muted)] font-mono text-xs uppercase tracking-widest">Nenhuma assinatura ativa</div>
                    <button onClick={() => setModalState({ open: true, initial: null })} className="btn-primary mt-6">Adicionar assinatura</button>
                </div>
            )}

            {!loading && active.length > 0 && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {active.map(s => <SubCard key={s.id} sub={s} onEdit={(item) => setModalState({ open: true, initial: item })} onDelete={onDeleteSub} />)}
                    </div>
                    {inactive.length > 0 && (
                        <>
                            <div className="text-[11px] font-mono tracking-widest uppercase text-[var(--text-muted)] pt-4 pb-2 border-b border-[var(--border-color)]">Inativas ({inactive.length})</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {inactive.map(s => <SubCard key={s.id} sub={s} onEdit={(item) => setModalState({ open: true, initial: item })} onDelete={onDeleteSub} />)}
                            </div>
                        </>
                    )}
                </>
            )}

            {modalState.open && <AddSubModal onClose={() => setModalState({ open: false, initial: null })} initial={modalState.initial} onSave={() => { setModalState({ open: false, initial: null }); load() }} />}
        </div>
    )
}
