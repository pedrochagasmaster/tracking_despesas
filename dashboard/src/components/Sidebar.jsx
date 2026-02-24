import { NavLink } from 'react-router-dom'
import { X } from 'lucide-react'

const links = [
    { to: '/', label: 'Visão Geral' },
    { to: '/transactions', label: 'Transações' },
    { to: '/subscriptions', label: 'Assinaturas' },
    { to: '/budgets', label: 'Orçamentos' },
    { to: '/analytics', label: 'Análise' },
    { to: '/curation', label: 'Curadoria CSV' },
]

export default function Sidebar({ isOpen = false, onClose = null }) {
    const shellClass = isOpen
        ? 'translate-x-0'
        : '-translate-x-full lg:translate-x-0'

    return (
        <aside className={`fixed inset-y-0 left-0 w-64 panel border-y-0 border-l-0 border-r flex flex-col z-40 transition-transform duration-300 ${shellClass}`}>
            {/* Logo */}
            <div className="flex items-center justify-between px-6 py-8 border-b border-[#1a1a1a]">
                <div>
                    <div className="text-xl text-white leading-none tracking-tight" style={{ fontFamily: '"DM Serif Text", serif' }}>TRACKING</div>
                    <div className="text-[10px] text-[#888] mt-1.5 font-mono uppercase tracking-widest" style={{ fontFamily: '"Space Mono", monospace' }}>Despesas Terminal</div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="btn-ghost p-1.5 lg:hidden"
                    aria-label="Fechar menu"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 py-6 space-y-0 overflow-y-auto scrollbar-thin">
                {links.map(({ to, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === '/'}
                        onClick={() => onClose?.()}
                        className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`}
                    >
                        <span>{label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* Footer */}
            <div className="p-6 border-t border-[#1a1a1a]">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#555] animate-pulse"></div>
                    <div>
                        <div className="text-[10px] text-[#888] uppercase tracking-wider" style={{ fontFamily: '"Space Mono", monospace' }}>System Active</div>
                        <div className="text-[10px] text-[#444] mt-0.5" style={{ fontFamily: '"Space Mono", monospace' }}>SQLite DB</div>
                    </div>
                </div>
            </div>
        </aside>
    )
}
