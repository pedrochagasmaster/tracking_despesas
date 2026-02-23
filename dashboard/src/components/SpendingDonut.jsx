import {
    PieChart as RePieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts'

const COLORS = [
    '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#10b981',
    '#84cc16', '#f59e0b', '#f97316', '#ef4444', '#ec4899',
]

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function CustomTooltip({ active, payload }) {
    if (!active || !payload?.length) return null
    const { name, value } = payload[0]
    return (
        <div className="glass-card px-3 py-2 text-xs">
            <div className="font-semibold text-slate-200">{name}</div>
            <div className="text-violet-400 font-bold">{fmt(value)}</div>
        </div>
    )
}

export default function SpendingDonut({ data }) {
    const items = Object.entries(data || {}).map(([name, value]) => ({ name, value }))
    if (!items.length) return (
        <div className="flex items-center justify-center h-full text-slate-600 text-sm">Sem dados</div>
    )

    return (
        <ResponsiveContainer width="100%" height="100%">
            <RePieChart>
                <Pie
                    data={items}
                    cx="50%"
                    cy="45%"
                    innerRadius="55%"
                    outerRadius="75%"
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                >
                    {items.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(v) => <span className="text-xs text-slate-400">{v}</span>}
                    wrapperStyle={{ paddingTop: '8px' }}
                />
            </RePieChart>
        </ResponsiveContainer>
    )
}
