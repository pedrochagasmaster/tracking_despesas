import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import MonthPicker from '../components/MonthPicker'
import { Search, Filter, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react'

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

const kindBadge = { one_off: 'badge-blue', subscription: 'badge-violet', installment: 'badge-yellow' }
const kindLabel = { one_off: 'Avulso', subscription: 'Assinatura', installment: 'Parcelado' }

export default function Transactions() {
    const [month, setMonth] = useState('')
    const [search, setSearch] = useState('')
    const [catFilter, setCatFilter] = useState('all')
    const [tab, setTab] = useState('expenses')
    const [expenses, setExpenses] = useState([])
    const [incomes, setIncomes] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        api.defaultMonth().then(({ month }) => setMonth(month)).catch(console.error)
    }, [])

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

    const filteredExpenses = expenses.filter(e =>
        (catFilter === 'all' || e.category === catFilter) &&
        (e.description.toLowerCase().includes(search.toLowerCase()) || e.category.toLowerCase().includes(search.toLowerCase()))
    )
    const filteredIncomes = incomes.filter(i =>
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

            {/* Summary strip */}
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

            {/* Filters + tabs */}
            <div className="glass-card p-4 flex flex-wrap items-center gap-3">
                <div className="flex gap-1.5 bg-slate-900/60 p-1 rounded-xl">
                    {['expenses', 'incomes'].map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-violet-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                            {t === 'expenses' ? 'Despesas' : 'Receitas'}
                        </button>
                    ))}
                </div>

                <div className="relative basis-full lg:basis-auto flex-1 min-w-52">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input className="input-field pl-8" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>

                {tab === 'expenses' && (
                    <div className="relative basis-full sm:basis-auto">
                        <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <select className="input-field pl-8 pr-8 appearance-none" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                            <option value="all">Todas categorias</option>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
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
                {!loading && displayRows.map(row => (
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
                    </div>
                ))}
            </div>

            {/* Table */}
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
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/25">
                            {loading && (
                                <tr><td colSpan={6} className="table-cell text-center py-10">
                                    <RefreshCw size={20} className="inline animate-spin text-violet-500" />
                                </td></tr>
                            )}
                            {!loading && displayRows.length === 0 && (
                                <tr><td colSpan={6} className="table-cell text-center text-slate-500 py-10">Nenhum resultado para os filtros atuais.</td></tr>
                            )}
                            {!loading && displayRows.map(row => (
                                <tr key={row.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="table-cell text-slate-400 whitespace-nowrap">{row.expense_date || row.income_date}</td>
                                    <td className="table-cell text-slate-200 font-medium max-w-xs truncate">{row.description}</td>
                                    <td className="table-cell hidden sm:table-cell"><span className="badge-blue">{row.category}</span></td>
                                    {tab === 'expenses' && <td className="table-cell hidden md:table-cell"><span className={kindBadge[row.kind] ?? 'badge-blue'}>{kindLabel[row.kind] ?? row.kind}</span></td>}
                                    {tab === 'expenses' && <td className="table-cell hidden lg:table-cell text-slate-500 text-xs">{row.installment_number ? `${row.installment_number}/${row.installment_total}` : '—'}</td>}
                                    <td className={`table-cell text-right font-semibold ${tab === 'expenses' ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {tab === 'expenses' ? '-' : '+'}{fmt(row.amount)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {!loading && displayRows.length > 0 && (
                    <div className="px-4 py-3 border-t border-slate-800/40 flex justify-end">
                        <span className="text-xs text-slate-600">{displayRows.length} registros</span>
                    </div>
                )}
            </div>
        </div>
    )
}
