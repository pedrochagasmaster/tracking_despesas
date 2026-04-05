import { useState, useEffect, useCallback, createElement } from 'react'
import { api } from '../api/client'
import KpiCard from '../components/KpiCard'
import MonthPicker from '../components/MonthPicker'
import SpendingDonut from '../components/SpendingDonut'
import TrendChart from '../components/TrendChart'
import DataHealthBadge from '../components/DataHealthBadge'
import StatePanel from '../components/StatePanel'
import { DollarSign, TrendingDown, Banknote, Percent, Plus, X, RefreshCw, AlertTriangle, ArrowRightLeft, WalletCards } from 'lucide-react'
import { currentMonthKey } from '../utils/date'
import { currency, formatMonthLabel, pctDelta } from '../utils/format'

const kindBadge = { one_off: 'badge-blue', subscription: 'badge-violet', installment: 'badge-yellow' }
const kindLabel = { one_off: 'Avulso', subscription: 'Assinatura', installment: 'Parcelado' }

function AlertStrip({ icon, title, text, tone = 'info' }) {
    const toneClass = tone === 'warn' ? 'status-warn' : tone === 'error' ? 'status-error' : 'status-info'
    return (
        <div className={`p-4 flex items-start gap-3 ${toneClass}`}>
            {icon ? createElement(icon, { size: 16, className: 'mt-0.5 shrink-0' }) : null}
            <div>
                <div className="text-xs font-mono uppercase tracking-wider mb-1">{title}</div>
                <div className="text-sm text-[var(--text-primary)]">{text}</div>
            </div>
        </div>
    )
}

function AddModal({ onClose, onSave }) {
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

    function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

    async function submit(e) {
        e.preventDefault()
        if (tab === 'expense') {
            const amount = parseFloat(form.amount)
            if (!amount || !form.category || !form.description || !form.expense_date) return
            await api.addExpense({ expense_date: form.expense_date, amount, category: form.category, description: form.description })
        } else if (tab === 'income') {
            const amount = parseFloat(form.amount)
            if (!amount || !form.category || !form.description || !form.income_date) return
            await api.addIncome({ income_date: form.income_date, amount, category: form.category, description: form.description })
        } else {
            const totalAmount = parseFloat(form.total_amount)
            const installments = parseInt(form.installments, 10)
            if (!totalAmount || !installments || !form.category || !form.description || !form.installment_start_date) return
            await api.addInstallment({
                start_date: form.installment_start_date,
                total_amount: totalAmount,
                installments,
                category: form.category,
                description: form.description,
            })
        }
        onSave()
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
                        <button key={key} onClick={() => setTab(key)}
                            className={`flex-1 py-2 text-xs font-mono uppercase tracking-wider transition-all ${tab === key ? 'bg-[var(--bg-panel)] text-white border border-[var(--border-strong)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] border border-transparent'}`}>
                            {label}
                        </button>
                    ))}
                </div>

                <form onSubmit={submit} className="space-y-3">
                    <div>
                        <label className="label block mb-1">Data</label>
                        {tab === 'expense' && (
                            <input type="date" className="input-field" value={form.expense_date} onChange={e => set('expense_date', e.target.value)} />
                        )}
                        {tab === 'income' && (
                            <input type="date" className="input-field" value={form.income_date} onChange={e => set('income_date', e.target.value)} />
                        )}
                        {tab === 'installment' && (
                            <input type="date" className="input-field" value={form.installment_start_date} onChange={e => set('installment_start_date', e.target.value)} />
                        )}
                    </div>
                    {tab !== 'installment' && (
                        <div>
                            <label className="label block mb-1">Valor (R$)</label>
                            <input type="number" step="0.01" min="0" className="input-field" placeholder="0,00"
                                value={form.amount} onChange={e => set('amount', e.target.value)} />
                        </div>
                    )}
                    {tab === 'installment' && (
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="label block mb-1">Valor Total (R$)</label>
                                <input type="number" step="0.01" min="0" className="input-field"
                                    value={form.total_amount} onChange={e => set('total_amount', e.target.value)} />
                            </div>
                            <div>
                                <label className="label block mb-1">Parcelas</label>
                                <input type="number" min="2" max="120" className="input-field"
                                    value={form.installments} onChange={e => set('installments', e.target.value)} />
                            </div>
                        </div>
                    )}
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

export default function Overview({ offlineBanner: OfflineBanner }) {
    const [month, setMonth] = useState(currentMonthKey)
    const [summary, setSummary] = useState(null)
    const [trends, setTrends] = useState([])
    const [expenses, setExpenses] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [loadError, setLoadError] = useState('')

    const load = useCallback(async () => {
        if (!month) return
        setLoading(true)
        setLoadError('')
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
            setLoadError(err.message || 'Falha ao carregar a visão geral.')
        } finally {
            setLoading(false)
        }
    }, [month])

    useEffect(() => { load() }, [load])

    const monthLabel = formatMonthLabel(month)
    const expenseDelta = pctDelta(summary?.expenses ?? 0, summary?.prev_expenses ?? 0)
    const topCategoryEntries = Object.entries(summary?.spending_by_category || {}).slice(0, 4)
    const totalCategorySpend = topCategoryEntries.reduce((acc, [, value]) => acc + value, 0)
    const offlineSources = [summary, trends, expenses]
        .filter((item) => item?.__offline || item?.__offlineCachedAt)
        .map((item) => ({ cachedAt: item.__offlineCachedAt, source: item.__offlineSource }))

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col gap-4 border-b border-[var(--border-color)] pb-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-4xl text-white tracking-tight leading-none" style={{ fontFamily: '"DM Serif Text", serif' }}>Visão Geral</h1>
                        <p className="text-sm text-[var(--text-secondary)] mt-3">Estado atual, comparação com o mês anterior e o que merece atenção agora.</p>
                    </div>
                    <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                        {month && <MonthPicker value={month} onChange={setMonth} className="w-full sm:w-auto justify-center sm:justify-start" />}
                        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center justify-center gap-2 whitespace-nowrap w-full sm:w-auto">
                            <Plus size={15} /> Lançamento
                        </button>
                    </div>
                </div>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="stat-chip">Competência: {monthLabel}</div>
                        {summary?.meta && <DataHealthBadge meta={summary.meta} />}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] font-mono uppercase tracking-wider">
                        Prioridade: confiança nos números → contexto → ação
                    </div>
                </div>
            </div>

            {offlineSources.length > 0 && OfflineBanner ? <OfflineBanner sources={offlineSources} /> : null}

            {loadError && (
                <StatePanel
                    kind="error"
                    title="Falha ao carregar a visão geral"
                    description={loadError}
                    action={<button onClick={load} className="btn-primary">Tentar novamente</button>}
                />
            )}

            {/* KPIs */}
            {summary && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="section-title">Resumo do Mês</div>
                        <div className="stat-chip">{month}</div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                        <KpiCard label="Receita recebida" value={summary.income} prev={summary.prev_income} icon={Banknote} color="emerald" />
                        <KpiCard label="Despesas do mês" value={summary.expenses} prev={summary.prev_expenses} icon={TrendingDown} color="violet" invertDelta />
                        <KpiCard label="Resultado do mês" value={summary.net} prev={summary.prev_net} icon={DollarSign} color={summary.net >= 0 ? 'emerald' : 'red'} />
                        <KpiCard label="Taxa de poupança" value={`${summary.savings_rate.toFixed(1)}%`} icon={Percent} color="blue" />
                    </div>
                </div>
            )}

            {summary && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                    <AlertStrip
                        icon={ArrowRightLeft}
                        title="Comparação"
                        tone={expenseDelta != null && expenseDelta > 10 ? 'warn' : 'info'}
                        text={expenseDelta == null
                            ? 'Ainda não há base suficiente para comparar as despesas com o mês anterior.'
                            : `Despesas ${expenseDelta > 0 ? 'subiram' : 'caíram'} ${Math.abs(expenseDelta).toFixed(1)}% vs mês anterior.`}
                    />
                    <AlertStrip
                        icon={WalletCards}
                        title="Categoria que mais pesa"
                        text={summary.top_category
                            ? `${summary.top_category} lidera os gastos deste mês.`
                            : 'Ainda não há despesas categorizadas neste mês.'}
                    />
                    <AlertStrip
                        icon={AlertTriangle}
                        title={summary.meta?.is_stale ? 'Atenção com a atualização' : 'Confiabilidade'}
                        tone={summary.meta?.is_stale ? 'warn' : 'info'}
                        text={summary.meta?.is_stale
                            ? 'Os dados parecem desatualizados. Vale revisar a sincronização antes de tomar decisão.'
                            : 'Base recente. Dá para usar esta visão como referência operacional.'}
                    />
                </div>
            )}

            {loading && !summary && !loadError && (
                <div className="flex items-center justify-center h-40">
                    <RefreshCw size={24} className="text-violet-500 animate-spin" />
                </div>
            )}

            {/* Charts row */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
                <div className="xl:col-span-3 section-shell">
                    <div className="mb-4">
                        <div className="section-title">Evolução mensal</div>
                        <div className="section-subtitle">Receita x despesas nos últimos 7 meses. O importante aqui é tendência, não decoração.</div>
                    </div>
                    <div className="h-52">
                        <TrendChart data={trends} />
                    </div>
                </div>

                <div className="xl:col-span-2 section-shell flex flex-col">
                    <div className="mb-2">
                        <div className="section-title mb-1">Gasto por categoria</div>
                        <div className="section-subtitle">{monthLabel}</div>
                    </div>
                    <div className="flex-1 min-h-[260px] mt-2 mb-2">
                        <SpendingDonut data={summary?.spending_by_category} />
                    </div>
                    <div className="space-y-2 border-t border-[var(--border-color)] pt-4 mt-2">
                        {topCategoryEntries.length === 0 && (
                            <div className="text-sm text-[var(--text-muted)]">Sem despesas categorizadas neste mês.</div>
                        )}
                        {topCategoryEntries.map(([category, amount]) => {
                            const pct = totalCategorySpend > 0 ? (amount / (summary?.expenses || totalCategorySpend)) * 100 : 0
                            return (
                                <div key={category} className="flex items-center justify-between gap-3 text-sm">
                                    <div className="min-w-0">
                                        <div className="text-white truncate">{category}</div>
                                        <div className="text-xs text-[var(--text-muted)]">{pct.toFixed(1)}% das despesas do mês</div>
                                    </div>
                                    <div className="font-mono text-right text-white whitespace-nowrap">{currency(amount)}</div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Recent transactions */}
            <div className="panel">
                <div className="flex items-center justify-between px-4 sm:px-6 py-5 border-b border-[var(--border-color)]">
                    <div className="text-xl text-white" style={{ fontFamily: '"DM Serif Text", serif' }}>Últimas Transações</div>
                    <a href="/transactions" className="text-[10px] font-mono uppercase tracking-widest text-[var(--text-muted)] hover:text-white transition-colors">Ver Todas →</a>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-[var(--bg-panel)]">
                            <tr>
                                <th className="table-header text-left">Data</th>
                                <th className="table-header text-left">Descrição</th>
                                <th className="table-header text-left">Categoria</th>
                                <th className="table-header text-left">Tipo</th>
                                <th className="table-header text-right">Valor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1a1a1a]">
                            {expenses.length === 0 && !loading && (
                                <tr><td colSpan={5} className="table-cell text-center text-[var(--text-muted)] font-mono text-xs uppercase py-8">Nenhuma despesa este mês.</td></tr>
                            )}
                            {expenses.map((e) => (
                                <tr key={e.id} className="hover:bg-[var(--bg-surface)] transition-colors group">
                                    <td className="table-cell text-[var(--text-muted)] font-mono text-[11px] group-hover:text-[var(--text-secondary)] whitespace-nowrap">{e.expense_date}</td>
                                    <td className="table-cell text-[#ccc] group-hover:text-white">{e.description}</td>
                                    <td className="table-cell"><span className="badge-blue">{e.category}</span></td>
                                    <td className="table-cell"><span className={kindBadge[e.kind] ?? 'badge-blue'}>{kindLabel[e.kind] ?? e.kind}</span></td>
                                    <td className="table-cell text-right font-mono text-sm text-[var(--color-expense)] group-hover:opacity-80">-{currency(e.amount)}</td>
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
