import { BellRing, CalendarClock, PiggyBank } from 'lucide-react'

export default function NotificationPreferencesCard({ permission, prefs, onToggle }) {
  const blocked = permission !== 'granted'

  return (
    <div className="panel p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 border border-[var(--border-color)] flex items-center justify-center bg-[var(--bg-surface)] shrink-0">
          <BellRing size={16} className="text-[var(--color-warn)]" />
        </div>
        <div>
          <div className="text-sm text-white">Lembretes do app</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            Escolha o que vale a pena avisar. Menos barulho, mais utilidade.
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className={`flex items-center justify-between gap-3 p-3 border ${blocked ? 'opacity-50' : ''}`}>
          <div className="flex items-center gap-3 min-w-0">
            <PiggyBank size={15} className="text-[var(--color-info)] shrink-0" />
            <div>
              <div className="text-sm text-white">Orçamentos</div>
              <div className="text-xs text-[var(--text-muted)]">Alertar perto do limite ou quando estourar.</div>
            </div>
          </div>
          <input type="checkbox" checked={prefs.budget} disabled={blocked} onChange={(e) => onToggle('budget', e.target.checked)} />
        </label>

        <label className={`flex items-center justify-between gap-3 p-3 border ${blocked ? 'opacity-50' : ''}`}>
          <div className="flex items-center gap-3 min-w-0">
            <CalendarClock size={15} className="text-[var(--color-warn)] shrink-0" />
            <div>
              <div className="text-sm text-white">Assinaturas</div>
              <div className="text-xs text-[var(--text-muted)]">Alertar quando uma cobrança estiver chegando.</div>
            </div>
          </div>
          <input type="checkbox" checked={prefs.subscription} disabled={blocked} onChange={(e) => onToggle('subscription', e.target.checked)} />
        </label>
      </div>

      <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
        Status: {permission === 'granted' ? 'notificações ativas' : permission === 'denied' ? 'notificações bloqueadas' : 'permissão pendente'}
      </div>
    </div>
  )
}
