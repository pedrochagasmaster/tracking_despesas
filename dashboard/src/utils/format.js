export const currency = (value) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(value ?? 0)

export function compactCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value ?? 0)
}

export function formatMonthLabel(monthKey) {
  if (!monthKey) return '—'
  const [year, month] = String(monthKey).split('-').map(Number)
  if (!year || !month) return monthKey
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

export function formatRelativeTime(isoString) {
  if (!isoString) return 'sem registro'
  const target = new Date(isoString)
  if (Number.isNaN(target.getTime())) return 'sem registro'

  const diffMs = Date.now() - target.getTime()
  const diffMin = Math.round(diffMs / 60000)
  if (Math.abs(diffMin) < 1) return 'agora'
  if (Math.abs(diffMin) < 60) return `há ${diffMin} min`

  const diffHours = Math.round(diffMin / 60)
  if (Math.abs(diffHours) < 24) return `há ${diffHours}h`

  const diffDays = Math.round(diffHours / 24)
  return `há ${diffDays}d`
}

export function pctDelta(current, previous) {
  if (previous == null || previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}
