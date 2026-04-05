import {
    PieChart as RePieChart,
    Pie,
    Cell,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts'

const COLORS = [
    '#555555', '#777777', '#999999', '#bbbbbb', '#dddddd',
    '#9dad90', '#ad9090', '#ad9f90', '#90a0ad', '#9d90ad',
]

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function CustomTooltip({ active, payload }) {
    if (!active || !payload?.length) return null
    const { name, value } = payload[0]
    return (
        <div className="panel px-4 py-3 border-[var(--border-color)] flex flex-col gap-1">
            <div className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-widest">{name}</div>
            <div className="text-lg text-white" style={{ fontFamily: '"DM Serif Text", serif' }}>{fmt(value)}</div>
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
                    innerRadius="65%"
                    outerRadius="80%"
                    paddingAngle={1}
                    dataKey="value"
                    stroke="none"
                >
                    {items.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                    iconType="rect"
                    iconSize={8}
                    formatter={(v) => <span className="text-[10px] font-mono text-[var(--text-secondary)] uppercase tracking-wider">{v}</span>}
                    wrapperStyle={{ paddingTop: '16px' }}
                />
            </RePieChart>
        </ResponsiveContainer>
    )
}
