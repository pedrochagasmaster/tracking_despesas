import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { RefreshCw, Plus, X, CalendarDays, Repeat, Tag } from 'lucide-react'

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtMonth = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) + '/mês'

function AddSubModal({ onClose, onSave }) {
    const [form, setForm] = useState({ name: '', amount: '', category: 'Assinaturas', frequency: 'monthly', start_date: new Date().toISOString().slice(0, 10) })
    function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
    async function submit(e) {
        e.preventDefault()
        await api.addSubscription({ ...form, amount: parseFloat(form.amount) })
        onSave()
    }
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-md p-6 animate-slide-up">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="font-bold text-slate-100">Nova Assinatura</h3>
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
                    <button type="submit" className="btn-primary w-full mt-2 py-2.5">Salvar</button>
                </form>
            </div>
        </div>
    )
}

function SubCard({ sub }) {
    const monthly = sub.frequency === 'monthly' ? sub.amount : sub.amount / 12
    const freqLabel = sub.frequency === 'monthly' ? 'Mensal' : 'Anual'
    const freqBadge = sub.frequency === 'monthly' ? 'badge-blue' : 'badge-yellow'

    return (
        <div className={`glass-card p-5 flex flex-col gap-3 hover:border-slate-600/70 transition-all ${!sub.active ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
                        <Repeat size={18} className="text-violet-400" />
                    </div>
                    <div>
                        <div className="font-semibold text-slate-100">{sub.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <Tag size={11} className="text-slate-600" />
                            <span className="text-xs text-slate-500">{sub.category}</span>
                        </div>
                    </div>
                </div>
                <span className={freqBadge}>{freqLabel}</span>
            </div>

            <div className="flex items-end justify-between pt-1 border-t border-slate-700/40">
                <div>
                    <div className="text-xs text-slate-600">Cobrança</div>
                    <div className="font-bold text-lg text-white">{fmt(sub.amount)}</div>
                </div>
                <div className="text-right">
                    <div className="text-xs text-slate-600">Equivalente/mês</div>
                    <div className="text-sm font-semibold text-violet-400">{fmtMonth(monthly)}</div>
                </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <CalendarDays size={11} />
                <span>Desde {sub.start_date}</span>
                {!sub.active && <span className="ml-auto badge bg-slate-700/50 text-slate-500">Inativo</span>}
            </div>
        </div>
    )
}

export default function Subscriptions() {
    const [subs, setSubs] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)

    async function load() {
        setLoading(true)
        try { setSubs(await api.subscriptions()) } finally { setLoading(false) }
    }

    useEffect(() => { load() }, [])

    const active = subs.filter(s => s.active)
    const inactive = subs.filter(s => !s.active)
    const totalMonthly = active.reduce((s, sub) => s + (sub.frequency === 'monthly' ? sub.amount : sub.amount / 12), 0)
    const totalYearly = totalMonthly * 12

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Assinaturas</h1>
                    <p className="text-sm text-slate-400 mt-0.5">Serviços recorrentes ativos</p>
                </div>
                <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 whitespace-nowrap">
                    <Plus size={15} /> Nova Assinatura
                </button>
            </div>

            {/* Totals */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass-card px-5 py-4">
                    <div className="label mb-1">Assinaturas Ativas</div>
                    <div className="text-2xl font-bold text-white">{active.length}</div>
                </div>
                <div className="glass-card px-5 py-4">
                    <div className="label mb-1">Custo Mensal</div>
                    <div className="text-2xl font-bold text-violet-400">{fmt(totalMonthly)}</div>
                </div>
                <div className="glass-card px-5 py-4">
                    <div className="label mb-1">Custo Anual</div>
                    <div className="text-2xl font-bold text-fuchsia-400">{fmt(totalYearly)}</div>
                </div>
            </div>

            {loading && (
                <div className="flex items-center justify-center h-40">
                    <RefreshCw size={24} className="text-violet-500 animate-spin" />
                </div>
            )}

            {!loading && active.length === 0 && (
                <div className="glass-card p-12 text-center">
                    <Repeat size={36} className="mx-auto text-slate-700 mb-3" />
                    <div className="text-slate-400">Nenhuma assinatura ativa</div>
                    <button onClick={() => setShowModal(true)} className="btn-primary mt-4">Adicionar assinatura</button>
                </div>
            )}

            {!loading && active.length > 0 && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {active.map(s => <SubCard key={s.id} sub={s} />)}
                    </div>
                    {inactive.length > 0 && (
                        <>
                            <div className="text-sm font-medium text-slate-500 pt-2">Inativas ({inactive.length})</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {inactive.map(s => <SubCard key={s.id} sub={s} />)}
                            </div>
                        </>
                    )}
                </>
            )}

            {showModal && <AddSubModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load() }} />}
        </div>
    )
}
