import { AlertTriangle, Clock3, Database, DatabaseBackup } from 'lucide-react'
import { formatRelativeTime } from '../utils/format'

export default function DataHealthBadge({ meta, className = '' }) {
  if (!meta) return null

  const stale = meta.is_stale
  const offline = meta.__offline
  const Icon = offline ? DatabaseBackup : stale ? AlertTriangle : Database
  const tone = offline || stale ? 'status-warn' : 'status-info'
  const label = offline ? 'snapshot offline' : stale ? 'dados desatualizados' : 'dados atualizados'
  const timeRef = offline ? meta.__offlineCachedAt : meta.data_updated_at

  return (
    <div className={`inline-flex items-center gap-2 border px-3 py-2 text-xs font-mono uppercase tracking-wider ${tone} ${className}`}>
      <Icon size={14} />
      <span>{label}</span>
      <span className="opacity-70">•</span>
      <Clock3 size={12} />
      <span>{formatRelativeTime(timeRef)}</span>
    </div>
  )
}
