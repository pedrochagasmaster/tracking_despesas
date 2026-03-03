import { ChevronLeft, ChevronRight } from 'lucide-react'

function pad(n) { return String(n).padStart(2, '0') }

export default function MonthPicker({ value, onChange, className = '' }) {
    const [year, month] = value.split('-').map(Number)

    function shift(dir) {
        let m = month + dir
        let y = year
        if (m < 1) { m = 12; y-- }
        if (m > 12) { m = 1; y++ }
        onChange(`${y}-${pad(m)}`)
    }

    const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

    return (
        <div className={`flex items-center gap-2 panel px-2.5 py-2 ${className}`}>
            <button type="button" onClick={() => shift(-1)} className="btn-ghost p-1.5 min-w-9 min-h-9" aria-label="Mês anterior">
                <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold text-[var(--text-primary)] min-w-[78px] text-center">
                {labels[month - 1]} {year}
            </span>
            <button type="button" onClick={() => shift(1)} className="btn-ghost p-1.5 min-w-9 min-h-9" aria-label="Próximo mês">
                <ChevronRight size={15} />
            </button>
        </div>
    )
}
