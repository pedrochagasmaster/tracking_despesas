import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

function fmt(v) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function Delta({ value, prevValue }) {
    if (prevValue == null || prevValue === 0) return null
    const pct = ((value - prevValue) / Math.abs(prevValue)) * 100
    const abs = Math.abs(pct)
    if (abs < 0.5) return <span className="badge bg-slate-700/50 text-slate-400"><Minus size={10} /> 0%</span>
    const up = pct > 0
    return (
        <span className={up ? 'badge-green' : 'badge-red'}>
            {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {abs.toFixed(1)}%
        </span>
    )
}

export default function KpiCard({ label, value, prev, icon: Icon, color = 'violet', suffix, invertDelta }) {
    const colorMap = {
        violet: 'from-violet-500/25 to-violet-600/5 border-violet-500/30 text-violet-300',
        emerald: 'from-emerald-500/25 to-emerald-600/5 border-emerald-500/30 text-emerald-300',
        red: 'from-red-500/25 to-red-600/5 border-red-500/30 text-red-300',
        amber: 'from-amber-500/25 to-amber-600/5 border-amber-500/30 text-amber-300',
        blue: 'from-cyan-500/25 to-blue-600/5 border-cyan-500/30 text-cyan-300',
    }

    const card = colorMap[color] ?? colorMap.violet
    const [from, to, border, iconColor] = card.split(' ')

    return (
        <div className={`kpi-card animate-slide-up bg-gradient-to-br ${from} ${to} border ${border}`}>
            <div className="flex items-start justify-between">
                <span className="label">{label}</span>
                {Icon && (
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-900/70 border border-slate-700/70">
                        <Icon size={16} className={iconColor} />
                    </div>
                )}
            </div>
            <div className="mt-2">
                <span className="text-2xl lg:text-[1.75rem] font-bold text-white tracking-tight">
                    {typeof value === 'number' ? fmt(value) : value}
                    {suffix && <span className="text-base font-medium text-slate-400 ml-1">{suffix}</span>}
                </span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
                {invertDelta
                    ? <Delta value={-value} prevValue={prev != null ? -prev : null} />
                    : <Delta value={value} prevValue={prev} />
                }
                <span className="text-xs text-slate-500">vs mês anterior</span>
            </div>
        </div>
    )
}
