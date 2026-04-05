import { AlertTriangle, DatabaseZap, SearchX } from 'lucide-react'

const ICONS = {
  empty: DatabaseZap,
  filtered: SearchX,
  error: AlertTriangle,
}

const STYLES = {
  empty: 'border-[var(--border-color)] text-[var(--text-secondary)]',
  filtered: 'status-info',
  error: 'status-error',
}

export default function StatePanel({ title, description, kind = 'empty', action }) {
  const Icon = ICONS[kind] ?? DatabaseZap

  return (
    <div className={`panel p-10 text-center ${STYLES[kind] ?? STYLES.empty}`}>
      <Icon size={28} className="mx-auto mb-4" />
      <div className="text-lg text-white mb-2" style={{ fontFamily: '"DM Serif Text", serif' }}>{title}</div>
      <div className="text-sm max-w-xl mx-auto text-[var(--text-secondary)]">{description}</div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
