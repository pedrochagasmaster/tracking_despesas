import { useState, useEffect } from 'react'
import { api } from '../api/client'
import TrendChart from '../components/TrendChart'
import SpendingDonut from '../components/SpendingDonut'
import MonthPicker from '../components/MonthPicker'
import { RefreshCw, TrendingUp, AlertCircle, Zap, PiggyBank } from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function NetBarTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    const net = payload[0]?.value ?? 0
    return (
        <div className="glass-card px-3 py-2 text-xs">
            <div className="font-semibold text-slate-300 mb-1">{label}</div>
            <span style={{ color: net >= 0 ? '#10b981' : '#f87171' }} className="font-bold">{fmt(net)}</span>
        </div>
    )
}

export default function Analytics() {
    const [month, setMonth] = useState('')
    const [trends, setTrends] = useState([])
    const [summary, setSummary] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        api.defaultMonth().then(({ month }) => setMonth(month)).catch(console.error)
    }, [])

    useEffect(() => {
        if (!month) return
        setLoading(true)
        Promise.all([api.trends(12), api.summary(month)])
            .then(([t, s]) => { setTrends(t); setSummary(s) })
            .finally(() => setLoading(false))
    }, [month])

    const avgExpenses = trends.length ? trends.reduce((s, t) => s + t.expenses, 0) / trends.length : 0
    const avgIncome = trends.length ? trends.reduce((s, t) => s + t.income, 0) / trends.length : 0
    const savingsRates = trends.filter(t => t.income > 0).map(t => ((t.income - t.expenses) / t.income) * 100)
    const avgSavingsRate = savingsRates.length ? savingsRates.reduce((a, b) => a + b, 0) / savingsRates.length : 0

    const netData = trends.map(t => ({ ...t, netColor: t.net >= 0 ? '#10b981' : '#ef4444' }))

    const topSpike = (() => {
        if (trends.length < 2) return null
        const last = trends[trends.length - 1]
        const prev = trends[trends.length - 2]
        if (!prev.expenses) return null
        const pct = ((last.expenses - prev.expenses) / prev.expenses) * 100
        return { pct, up: pct > 0, month: last.month }
    })()

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Análise Financeira</h1>
                    <p className="text-sm text-slate-400 mt-0.5">Tendências e insights dos últimos 12 meses</p>
                </div>
                {month && <MonthPicker value={month} onChange={setMonth} />}
            </div>

            {loading && (
                <div className="flex items-center justify-center h-40"><RefreshCw size={24} className="text-violet-500 animate-spin" /></div>
            )}

            {!loading && (
                <>
                    {/* KPI insights */}
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="section-title">Indicadores Estratégicos</div>
                            <div className="stat-chip">Janela: 12 meses</div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                            <div className="section-shell">
                                <div className="label mb-1">Despesa Média Mensal</div>
                                <div className="text-xl font-bold text-cyan-300">{fmt(avgExpenses)}</div>
                            </div>
                            <div className="section-shell">
                                <div className="label mb-1">Receita Média Mensal</div>
                                <div className="text-xl font-bold text-emerald-400">{fmt(avgIncome)}</div>
                            </div>
                            <div className="section-shell">
                                <div className="label mb-1">Taxa Poupança Média</div>
                                <div className={`text-xl font-bold ${avgSavingsRate >= 20 ? 'text-emerald-400' : avgSavingsRate >= 10 ? 'text-amber-400' : 'text-red-400'}`}>
                                    {avgSavingsRate.toFixed(1)}%
                                </div>
                            </div>
                            <div className="section-shell">
                                <div className="label mb-1">Taxa Poupança ({month})</div>
                                <div className={`text-xl font-bold ${(summary?.savings_rate ?? 0) >= 20 ? 'text-emerald-400' : (summary?.savings_rate ?? 0) >= 10 ? 'text-amber-400' : 'text-red-400'}`}>
                                    {summary?.savings_rate?.toFixed(1) ?? '—'}%
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Insight alerts */}
                    <div className="flex flex-wrap gap-3">
                        {topSpike && Math.abs(topSpike.pct) > 10 && (
                            <div className={`glass-card px-4 py-3 flex items-center gap-2 text-sm ${topSpike.up ? 'border-amber-500/30' : 'border-emerald-500/30'}`}>
                                <AlertCircle size={15} className={topSpike.up ? 'text-amber-400' : 'text-emerald-400'} />
                                <span className="text-slate-300">
                                    Gastos {topSpike.up ? 'subiram' : 'caíram'}{' '}
                                    <span className={`font-bold ${topSpike.up ? 'text-amber-400' : 'text-emerald-400'}`}>
                                        {Math.abs(topSpike.pct).toFixed(0)}%
                                    </span>{' '}
                                    vs mês anterior
                                </span>
                            </div>
                        )}
                        {avgSavingsRate >= 20 && (
                            <div className="glass-card px-4 py-3 flex items-center gap-2 text-sm border-emerald-500/30">
                                <PiggyBank size={15} className="text-emerald-400" />
                                <span className="text-slate-300">Parabéns! Taxa de poupança acima de <span className="font-bold text-emerald-400">20%</span></span>
                            </div>
                        )}
                        {avgSavingsRate < 10 && avgSavingsRate > 0 && (
                            <div className="glass-card px-4 py-3 flex items-center gap-2 text-sm border-red-500/30">
                                <Zap size={15} className="text-red-400" />
                                <span className="text-slate-300">Taxa de poupança abaixo de <span className="font-bold text-red-400">10%</span> — atenção!</span>
                            </div>
                        )}
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div className="section-shell">
                            <div className="section-title mb-1">Receita x Despesas</div>
                            <div className="section-subtitle mb-4">Últimos 12 meses</div>
                            <div className="h-56"><TrendChart data={trends} /></div>
                        </div>

                        <div className="section-shell">
                            <div className="section-title mb-1">Saldo Líquido</div>
                            <div className="section-subtitle mb-4">Receita menos Despesas por mês</div>
                            <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={netData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                        <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => v.slice(5)} />
                                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} width={52} />
                                        <Tooltip content={<NetBarTooltip />} />
                                        <Bar dataKey="net" radius={[4, 4, 0, 0]} fill="#06b6d4"
                                            label={false}
                                            isAnimationActive
                                            // color cells individually
                                            minPointSize={2}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="section-shell">
                        <div className="section-title mb-1">Distribuição por Categoria</div>
                        <div className="section-subtitle mb-4">{month}</div>
                        <div className="h-64">
                            <SpendingDonut data={summary?.spending_by_category} />
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
