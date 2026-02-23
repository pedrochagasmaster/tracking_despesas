import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import KpiCard from '../components/KpiCard'
import MonthPicker from '../components/MonthPicker'
import SpendingDonut from '../components/SpendingDonut'
import TrendChart from '../components/TrendChart'
import { DollarSign, TrendingDown, Banknote, Percent, Plus, X, RefreshCw } from 'lucide-react'

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const kindBadge = { one_off: 'badge-blue', subscription: 'badge-violet', installment: 'badge-yellow' }
const kindLabel = { one_off: 'Avulso', subscription: 'Assinatura', installment: 'Parcelado' }

function AddModal({ onClose, onSave }) {
    const [tab, setTab] = useState('expense')
    const [form, setForm] = useState({
        expense_date: new Date().toISOString().slice(0, 10),
        income_date: new Date().toISOString().slice(0, 10),
        amount: '',
        category: '',
        description: '',
    })

    function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

    async function submit(e) {
        e.preventDefault()
        const amount = parseFloat(form.amount)
        if (!amount || !form.category || !form.description) return
        if (tab === 'expense') {
            await api.addExpense({ expense_date: form.expense_date, amount, category: form.category, description: form.description })
        } else {
            await api.addIncome({ income_date: form.income_date, amount, category: form.category, description: form.description })
        }
        onSave()
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card w-full max-w-md p-6 animate-slide-up">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="font-bold text-slate-100">Novo Lançamento</h3>
                    <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
                </div>

                <div className="flex gap-2 mb-5">
                    {['expense', 'income'].map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${tab === t ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>
                            {t === 'expense' ? 'Despesa' : 'Receita'}
                        </button>
                    ))}
                </div>

                <form onSubmit={submit} className="space-y-3">
                    <div>
                        <label className="label block mb-1">Data</label>
                        <input type="date" className="input-field"
                            value={tab === 'expense' ? form.expense_date : form.income_date}
                            onChange={e => set(tab === 'expense' ? 'expense_date' : 'income_date', e.target.value)} />
                    </div>
                    <div>
                        <label className="label block mb-1">Valor (R$)</label>
                        <input type="number" step="0.01" min="0" className="input-field" placeholder="0,00"
                            value={form.amount} onChange={e => set('amount', e.target.value)} />
                    </div>
                    <div>
                        <label className="label block mb-1">Categoria</label>
                        <input className="input-field" placeholder="ex: Alimentação"
                            value={form.category} onChange={e => set('category', e.target.value)} />
                    </div>
                    <div>
                        <label className="label block mb-1">Descrição</label>
                        <input className="input-field" placeholder="ex: Mercado"
                            value={form.description} onChange={e => set('description', e.target.value)} />
                    </div>
                    <button type="submit" className="btn-primary w-full mt-2 py-2.5">Salvar</button>
                </form>
            </div>
        </div>
    )
}

export default function Overview() {
    const [month, setMonth] = useState('')
    const [summary, setSummary] = useState(null)
    const [trends, setTrends] = useState([])
    const [expenses, setExpenses] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)

    useEffect(() => {
        api.defaultMonth().then(({ month }) => setMonth(month)).catch(console.error)
    }, [])

    const load = useCallback(async () => {
        if (!month) return
        setLoading(true)
        try {
            const [s, t, e] = await Promise.all([
                api.summary(month),
                api.trends(7),
                api.expenses(month),
            ])
            setSummary(s)
            setTrends(t)
            setExpenses(e.slice(0, 8))
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [month])

    useEffect(() => { load() }, [load])

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Visão Geral</h1>
                    <p className="text-sm text-slate-400 mt-0.5">Seu painel financeiro pessoal</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                    {month && <MonthPicker value={month} onChange={setMonth} />}
                    <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 whitespace-nowrap">
                        <Plus size={15} /> Lançamento
                    </button>
                </div>
            </div>

            {/* KPIs */}
            {summary && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="section-title">Resumo do Mês</div>
                        <div className="stat-chip">{month}</div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        <KpiCard label="Receita" value={summary.income} prev={summary.prev_income} icon={Banknote} color="emerald" />
                        <KpiCard label="Despesas" value={summary.expenses} prev={summary.prev_expenses} icon={TrendingDown} color="violet" invertDelta />
                        <KpiCard label="Saldo Líquido" value={summary.net} icon={DollarSign} color={summary.net >= 0 ? 'emerald' : 'red'} />
                        <KpiCard label="Taxa de Poupança" value={`${summary.savings_rate.toFixed(1)}%`} icon={Percent} color="blue" />
                    </div>
                </div>
            )}

            {loading && !summary && (
                <div className="flex items-center justify-center h-40">
                    <RefreshCw size={24} className="text-violet-500 animate-spin" />
                </div>
            )}

            {/* Charts row */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
                {/* Trend chart */}
                <div className="xl:col-span-3 section-shell">
                    <div className="mb-4">
                        <div className="section-title">Evolução Mensal</div>
                        <div className="section-subtitle">Receita x Despesas nos últimos 7 meses</div>
                    </div>
                    <div className="h-52">
                        <TrendChart data={trends} />
                    </div>
                </div>

                {/* Donut */}
                <div className="xl:col-span-2 section-shell">
                    <div className="section-title mb-1">Gasto por Categoria</div>
                    <div className="section-subtitle mb-4">{month}</div>
                    <div className="h-52">
                        <SpendingDonut data={summary?.spending_by_category} />
                    </div>
                </div>
            </div>

            {/* Recent transactions */}
            <div className="glass-card">
                <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-800/60">
                    <div className="font-semibold text-slate-200">Últimas Transações</div>
                    <a href="/transactions" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">Ver todas →</a>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-slate-800/40">
                            <tr>
                                <th className="table-header text-left">Data</th>
                                <th className="table-header text-left">Descrição</th>
                                <th className="table-header text-left">Categoria</th>
                                <th className="table-header text-left">Tipo</th>
                                <th className="table-header text-right">Valor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/30">
                            {expenses.length === 0 && !loading && (
                                <tr><td colSpan={5} className="table-cell text-center text-slate-500">Nenhuma despesa este mês. Use "Lançamento" para começar.</td></tr>
                            )}
                            {expenses.map((e) => (
                                <tr key={e.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="table-cell text-slate-400">{e.expense_date}</td>
                                    <td className="table-cell text-slate-200 font-medium">{e.description}</td>
                                    <td className="table-cell"><span className="badge-blue">{e.category}</span></td>
                                    <td className="table-cell"><span className={kindBadge[e.kind] ?? 'badge-blue'}>{kindLabel[e.kind] ?? e.kind}</span></td>
                                    <td className="table-cell text-right font-semibold text-red-400">-{fmt(e.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && <AddModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load() }} />}
        </div>
    )
}
