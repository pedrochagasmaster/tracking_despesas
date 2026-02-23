import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function pad(n) { return String(n).padStart(2, '0') }

export default function MonthPicker({ value, onChange }) {
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
        <div className="flex items-center gap-2 glass-card px-3 py-2">
            <button onClick={() => shift(-1)} className="btn-ghost p-1.5 rounded-lg">
                <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold text-slate-200 min-w-[84px] text-center">
                {labels[month - 1]} {year}
            </span>
            <button onClick={() => shift(1)} className="btn-ghost p-1.5 rounded-lg">
                <ChevronRight size={15} />
            </button>
        </div>
    )
}
