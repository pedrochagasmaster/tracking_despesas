import { Download, X } from 'lucide-react'

export default function InstallPwaPopup({ open, onInstall, onDismiss, installing = false }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-end sm:items-center justify-center p-4">
      <div className="panel w-full max-w-md p-6 animate-slide-up relative">
        <button
          type="button"
          onClick={onDismiss}
          className="btn-ghost p-2 absolute top-3 right-3"
          aria-label="Fechar sugestão de instalação"
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-4 pr-10">
          <div className="w-11 h-11 border border-[var(--border-strong)] flex items-center justify-center bg-[var(--bg-surface)] shrink-0">
            <Download size={18} className="text-[var(--color-info)]" />
          </div>
          <div>
            <div className="text-xl text-white mb-2" style={{ fontFamily: '"DM Serif Text", serif' }}>
              Instalar app no celular
            </div>
            <div className="text-sm text-[var(--text-secondary)] leading-6">
              Instala o painel como app para abrir mais rápido, sem barra do navegador e com suporte melhor a uso offline.
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button type="button" onClick={onDismiss} className="btn-ghost">
            Agora não
          </button>
          <button type="button" onClick={onInstall} className="btn-primary flex items-center justify-center gap-2" disabled={installing}>
            <Download size={15} />
            {installing ? 'Abrindo instalação...' : 'Instalar app'}
          </button>
        </div>
      </div>
    </div>
  )
}
