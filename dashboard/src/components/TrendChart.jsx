import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts'

const fmt = (v) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v)

function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    return (
        <div className="panel px-4 py-3 border-[var(--border-color)]">
            <div className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest mb-2 pb-2 border-b border-[var(--border-color)]">{label}</div>
            {payload.map((p) => (
                <div key={p.dataKey} className="flex items-center gap-3 mt-1.5">
                    <span className="w-1.5 h-1.5" style={{ background: p.color }} />
                    <span className="text-xs text-[#ccc] capitalize" style={{ fontFamily: '"Manrope", sans-serif' }}>{p.name}</span>
                    <span className="font-mono text-sm ml-auto" style={{ color: p.color }}>{fmt(p.value)}</span>
                </div>
            ))}
        </div>
    )
}

export default function TrendChart({ data }) {
    if (!data?.length) return (
        <div className="flex items-center justify-center h-full text-slate-600 text-sm">Sem dados</div>
    )

    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <defs>
                    <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#9dad90" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#9dad90" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gExpenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ad9090" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ad9090" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="1 4" stroke="#1a1a1a" vertical={false} />
                <XAxis
                    dataKey="month"
                    tick={{ fill: '#555', fontSize: 10, fontFamily: '"Space Mono", monospace', textTransform: 'uppercase' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => v.slice(5)}
                />
                <YAxis
                    tick={{ fill: '#555', fontSize: 10, fontFamily: '"Space Mono", monospace' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                    width={52}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                    iconType="rect"
                    iconSize={8}
                    formatter={(v) => <span className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-wider">{v}</span>}
                />
                <Area type="monotone" dataKey="income" name="Receita" stroke="#9dad90" fill="url(#gIncome)" strokeWidth={1.5} dot={false} />
                <Area type="monotone" dataKey="expenses" name="Despesas" stroke="#ad9090" fill="url(#gExpenses)" strokeWidth={1.5} dot={false} />
            </AreaChart>
        </ResponsiveContainer>
    )
}
