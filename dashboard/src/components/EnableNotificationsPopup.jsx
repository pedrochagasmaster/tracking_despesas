import { BellRing, X } from 'lucide-react'

export default function EnableNotificationsPopup({ open, onEnable, onDismiss, enabling = false }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[69] bg-black/60 flex items-end sm:items-center justify-center p-4">
      <div className="panel w-full max-w-md p-6 animate-slide-up relative">
        <button
          type="button"
          onClick={onDismiss}
          className="btn-ghost p-2 absolute top-3 right-3"
          aria-label="Fechar sugestão de lembretes"
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-4 pr-10">
          <div className="w-11 h-11 border border-[var(--border-strong)] flex items-center justify-center bg-[var(--bg-surface)] shrink-0">
            <BellRing size={18} className="text-[var(--color-warn)]" />
          </div>
          <div>
            <div className="text-xl text-white mb-2" style={{ fontFamily: '"DM Serif Text", serif' }}>
              Ativar lembretes financeiros
            </div>
            <div className="text-sm text-[var(--text-secondary)] leading-6">
              Posso avisar sobre orçamentos perto do limite e assinaturas que vencem em breve.
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button type="button" onClick={onDismiss} className="btn-ghost">
            Agora não
          </button>
          <button type="button" onClick={onEnable} className="btn-primary flex items-center justify-center gap-2" disabled={enabling}>
            <BellRing size={15} />
            {enabling ? 'Ativando...' : 'Ativar lembretes'}
          </button>
        </div>
      </div>
    </div>
  )
}
