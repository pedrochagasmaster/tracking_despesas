import { WifiOff, DatabaseBackup } from 'lucide-react'
import { formatRelativeTime } from '../utils/format'

export default function OfflineSnapshotBanner({ sources = [] }) {
  if (!sources.length) return null

  const newest = [...sources]
    .map((item) => item?.cachedAt)
    .filter(Boolean)
    .sort()
    .at(-1)

  return (
    <div className="status-warn p-4 flex items-start gap-3">
      <WifiOff size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs font-mono uppercase tracking-wider mb-1 flex items-center gap-2">
          <span>Modo offline com snapshot</span>
          <DatabaseBackup size={12} />
        </div>
        <div className="text-sm text-[var(--text-primary)]">
          Você está vendo os últimos dados salvos localmente. Eles podem estar desatualizados.
          {newest ? ` Snapshot mais recente: ${formatRelativeTime(newest)}.` : ''}
        </div>
      </div>
    </div>
  )
}
