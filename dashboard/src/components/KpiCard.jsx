import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

function fmt(v) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function Delta({ value, prevValue }) {
    if (prevValue == null || prevValue === 0) return null
    const pct = ((value - prevValue) / Math.abs(prevValue)) * 100
    const abs = Math.abs(pct)
    if (abs < 0.5) return <span className="badge border-transparent text-[var(--text-muted)] px-0"><Minus size={10} /> 0%</span>
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
        violet: 'text-[#9d90ad]',
        emerald: 'text-[var(--color-income)]',
        red: 'text-[var(--color-expense)]',
        amber: 'text-[var(--color-warn)]',
        blue: 'text-[var(--color-info)]',
    }

    const iconColor = colorMap[color] ?? colorMap.violet

    return (
        <div className="kpi-card animate-slide-up">
            <div className="flex items-start justify-between">
                <span className="label" style={{ fontFamily: '"Space Mono", monospace' }}>{label}</span>
                {Icon && (
                    <div className="w-8 h-8 flex items-center justify-center border border-[var(--border-color)]">
                        <Icon size={14} className={iconColor} />
                    </div>
                )}
            </div>
            <div className="mt-4">
                <span className="text-3xl lg:text-[2rem] font-normal text-white tracking-tight" style={{ fontFamily: '"DM Serif Text", serif' }}>
                    {typeof value === 'number' ? fmt(value) : value}
                    {suffix && <span className="text-base font-medium text-[var(--text-secondary)] ml-1.5" style={{ fontFamily: '"Manrope", sans-serif' }}>{suffix}</span>}
                </span>
            </div>
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[var(--border-color)]">
                {invertDelta
                    ? <Delta value={-value} prevValue={prev != null ? -prev : null} />
                    : <Delta value={value} prevValue={prev} />
                }
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider" style={{ fontFamily: '"Space Mono", monospace' }}>vs mês anterior</span>
            </div>
        </div>
    )
}
