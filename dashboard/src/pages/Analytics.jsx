import { useState, useEffect } from 'react'
import { api } from '../api/client'
import TrendChart from '../components/TrendChart'
import SpendingDonut from '../components/SpendingDonut'
import MonthPicker from '../components/MonthPicker'
import DataHealthBadge from '../components/DataHealthBadge'
import StatePanel from '../components/StatePanel'
import { RefreshCw, AlertCircle, Zap, PiggyBank } from 'lucide-react'
import { currentMonthKey } from '../utils/date'
import { currency, formatMonthLabel } from '../utils/format'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

function NetBarTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    const net = payload[0]?.value ?? 0
    return (
        <div className="panel px-4 py-3 border-[var(--border-color)] flex flex-col gap-1">
            <div className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest">{label}</div>
            <span style={{ color: net >= 0 ? '#9dad90' : '#ad9090', fontFamily: '"DM Serif Text", serif' }} className="text-lg">{currency(net)}</span>
        </div>
    )
}

export default function Analytics({ offlineBanner: OfflineBanner }) {
    const [month, setMonth] = useState(currentMonthKey)
    const [trends, setTrends] = useState([])
    const [summary, setSummary] = useState(null)
    const [offlineInfo, setOfflineInfo] = useState([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')

    useEffect(() => {
        if (!month) return
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true)
        setLoadError('')
        Promise.all([api.trends(12), api.summary(month)])
            .then(([t, s]) => {
                setTrends(t)
                setSummary(s)
                setOfflineInfo([
                    t?.__offline ? { cachedAt: t.__offlineCachedAt, source: t.__offlineSource } : null,
                    s?.__offline ? { cachedAt: s.__offlineCachedAt, source: s.__offlineSource } : null,
                ].filter(Boolean))
            })
            .catch((err) => setLoadError(err.message || 'Falha ao carregar análise financeira.'))
            .finally(() => setLoading(false))
    }, [month])

    const avgExpenses = trends.length ? trends.reduce((s, t) => s + t.expenses, 0) / trends.length : 0
    const avgIncome = trends.length ? trends.reduce((s, t) => s + t.income, 0) / trends.length : 0
    const savingsRates = trends.filter(t => t.income > 0).map(t => ((t.income - t.expenses) / t.income) * 100)
    const avgSavingsRate = savingsRates.length ? savingsRates.reduce((a, b) => a + b, 0) / savingsRates.length : 0

    const netData = trends.map(t => ({ ...t, netColor: t.net >= 0 ? '#9dad90' : '#ad9090' }))
    const monthLabel = formatMonthLabel(month)

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
            <div className="flex flex-col gap-4 border-b border-[var(--border-color)] pb-6 mt-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-4xl text-white tracking-tight leading-none" style={{ fontFamily: '"DM Serif Text", serif' }}>Análise Financeira</h1>
                        <p className="text-sm text-[var(--text-secondary)] mt-3">Tendência, comparação e concentração de gastos. Menos “insight mágico”, mais leitura útil.</p>
                    </div>
                    {month && <MonthPicker value={month} onChange={setMonth} className="w-full sm:w-auto justify-center sm:justify-start" />}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="stat-chip">Competência: {monthLabel}</div>
                    {summary?.meta && <DataHealthBadge meta={summary.meta} />}
                </div>
            </div>

            {offlineInfo.length > 0 && OfflineBanner ? <OfflineBanner sources={offlineInfo} /> : null}

            {loading && (
                <div className="flex items-center justify-center h-40"><RefreshCw size={24} className="text-violet-500 animate-spin" /></div>
            )}

            {!loading && loadError && (
                <StatePanel
                    kind="error"
                    title="Falha ao carregar análise financeira"
                    description={loadError}
                />
            )}

            {!loading && !loadError && (
                <>
                    {/* KPI insights */}
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-color)] pb-4">
                            <h2 className="text-xl text-white tracking-wide" style={{ fontFamily: '"DM Serif Text", serif' }}>Indicadores Estratégicos</h2>
                            <div className="text-[10px] font-mono tracking-widest uppercase text-[var(--text-muted)] border border-[var(--border-color)] px-2 py-1">Janela: 12 meses</div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                            <div className="panel p-6 border-t-2 border-t-[#333]">
                                <div className="label mb-2" style={{ fontFamily: '"Space Mono", monospace' }}>Despesa Média Mensal</div>
                                <div className="text-3xl text-white" style={{ fontFamily: '"DM Serif Text", serif' }}>{currency(avgExpenses)}</div>
                            </div>
                            <div className="panel p-6 border-t-2 border-t-[var(--color-income)]">
                                <div className="label mb-2" style={{ fontFamily: '"Space Mono", monospace' }}>Receita Média Mensal</div>
                                <div className="text-3xl text-[var(--color-income)]" style={{ fontFamily: '"DM Serif Text", serif' }}>{currency(avgIncome)}</div>
                            </div>
                            <div className="panel p-6 border-t-2 border-t-[var(--color-info)]">
                                <div className="label mb-2" style={{ fontFamily: '"Space Mono", monospace' }}>Taxa Poupança Média</div>
                                <div className={`text-3xl ${avgSavingsRate >= 20 ? 'text-[var(--color-income)]' : avgSavingsRate >= 10 ? 'text-[var(--color-warn)]' : 'text-[var(--color-expense)]'}`} style={{ fontFamily: '"DM Serif Text", serif' }}>
                                    {avgSavingsRate.toFixed(1)}%
                                </div>
                            </div>
                            <div className="panel p-6 border-t-2 border-t-[var(--color-warn)]">
                                <div className="label mb-2" style={{ fontFamily: '"Space Mono", monospace' }}>Taxa Poupança ({month})</div>
                                <div className={`text-3xl ${(summary?.savings_rate ?? 0) >= 20 ? 'text-[var(--color-income)]' : (summary?.savings_rate ?? 0) >= 10 ? 'text-[var(--color-warn)]' : 'text-[var(--color-expense)]'}`} style={{ fontFamily: '"DM Serif Text", serif' }}>
                                    {summary?.savings_rate?.toFixed(1) ?? '—'}%
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Insight alerts */}
                    <div className="flex flex-wrap gap-3">
                        {topSpike && Math.abs(topSpike.pct) > 10 && (
                            <div className={`panel px-4 py-3 flex items-center gap-2 text-sm ${topSpike.up ? 'border-[var(--color-warn)] text-[var(--color-warn)]' : 'border-[var(--color-income)] text-[var(--color-income)]'}`}>
                                <AlertCircle size={15} />
                                <span className="text-[#ccc] font-mono text-[11px] uppercase tracking-wider">
                                    Gastos {topSpike.up ? 'subiram' : 'caíram'}{' '}
                                    <span className="font-bold">
                                        {Math.abs(topSpike.pct).toFixed(0)}%
                                    </span>{' '}
                                    vs mês anterior
                                </span>
                            </div>
                        )}
                        {avgSavingsRate >= 20 && (
                            <div className="panel px-4 py-3 flex items-center gap-2 text-sm border-[var(--color-income)] text-[var(--color-income)]">
                                <PiggyBank size={15} />
                                <span className="text-[#ccc] font-mono text-[11px] uppercase tracking-wider">Parabéns! Taxa de poupança acima de <span className="font-bold">20%</span></span>
                            </div>
                        )}
                        {avgSavingsRate < 10 && avgSavingsRate > 0 && (
                            <div className="panel px-4 py-3 flex items-center gap-2 text-sm border-[var(--color-expense)] text-[var(--color-expense)]">
                                <Zap size={15} />
                                <span className="text-[#ccc] font-mono text-[11px] uppercase tracking-wider">Taxa de poupança abaixo de <span className="font-bold">10%</span> — atenção!</span>
                            </div>
                        )}
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div className="panel p-6">
                            <h3 className="text-xl text-white mb-1" style={{ fontFamily: '"DM Serif Text", serif' }}>Receita x Despesas</h3>
                            <div className="text-[10px] font-mono tracking-widest uppercase text-[var(--text-muted)] mb-6 pb-4 border-b border-[var(--border-color)]">Últimos 12 meses</div>
                            <div className="h-64"><TrendChart data={trends} /></div>
                        </div>

                        <div className="panel p-6">
                            <h3 className="text-xl text-white mb-1" style={{ fontFamily: '"DM Serif Text", serif' }}>Saldo Líquido</h3>
                            <div className="text-[10px] font-mono tracking-widest uppercase text-[var(--text-muted)] mb-6 pb-4 border-b border-[var(--border-color)]">Receita menos Despesas por mês</div>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={netData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="1 4" stroke="#1a1a1a" vertical={false} />
                                        <XAxis dataKey="month" tick={{ fill: '#555', fontSize: 10, fontFamily: '"Space Mono", monospace', textTransform: 'uppercase' }} axisLine={false} tickLine={false} tickFormatter={v => v.slice(5)} />
                                        <YAxis tick={{ fill: '#555', fontSize: 10, fontFamily: '"Space Mono", monospace' }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} width={52} />
                                        <Tooltip content={<NetBarTooltip />} />
                                        <Bar dataKey="net" radius={[0, 0, 0, 0]} fill="#555"
                                            label={false}
                                            isAnimationActive
                                            minPointSize={2}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="panel p-6">
                        <h3 className="text-xl text-white mb-1" style={{ fontFamily: '"DM Serif Text", serif' }}>Distribuição por Categoria</h3>
                        <div className="text-[10px] font-mono tracking-widest uppercase text-[var(--text-muted)] mb-6 pb-4 border-b border-[var(--border-color)]">{month}</div>
                        <div className="h-80">
                            <SpendingDonut data={summary?.spending_by_category} />
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
