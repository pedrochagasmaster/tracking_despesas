import { NavLink } from 'react-router-dom'
import {
    LayoutDashboard,
    ArrowUpDown,
    RefreshCw,
    PieChart,
    TrendingUp,
    Wallet,
    Tags,
    Zap,
    X,
} from 'lucide-react'

const links = [
    { to: '/', icon: LayoutDashboard, label: 'Visão Geral' },
    { to: '/transactions', icon: ArrowUpDown, label: 'Transações' },
    { to: '/subscriptions', icon: RefreshCw, label: 'Assinaturas' },
    { to: '/budgets', icon: PieChart, label: 'Orçamentos' },
    { to: '/analytics', icon: TrendingUp, label: 'Análise' },
    { to: '/curation', icon: Tags, label: 'Curadoria CSV' },
]

export default function Sidebar({ isOpen = false, onClose = null }) {
    const shellClass = isOpen
        ? 'translate-x-0'
        : '-translate-x-full lg:translate-x-0'

    return (
        <aside className={`fixed inset-y-0 left-0 w-64 bg-slate-900/90 backdrop-blur-xl border-r border-slate-800/60 flex flex-col z-40 transition-transform duration-300 ${shellClass}`}>
            {/* Logo */}
            <div className="flex items-center justify-between gap-3 px-6 py-6 border-b border-slate-800/60">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg glow-cyan">
                        <Wallet size={18} className="text-white" />
                    </div>
                    <div>
                        <div className="font-bold text-sm text-white leading-none">Tracking</div>
                        <div className="text-xs text-slate-400 mt-0.5">Despesas</div>
                    </div>
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
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
                {links.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === '/'}
                        className={({ isActive }) => isActive ? 'nav-item-active' : 'nav-item-inactive'}
                    >
                        <Icon size={18} />
                        <span>{label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* Footer */}
            <div className="px-3 py-4 border-t border-slate-800/60">
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-600/10 to-blue-600/10 border border-cyan-500/20">
                    <div className="w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                        <Zap size={14} className="text-cyan-400" />
                    </div>
                    <div>
                        <div className="text-xs font-medium text-slate-300">SQLite connected</div>
                        <div className="text-xs text-slate-500">expenses.db</div>
                    </div>
                </div>
            </div>
        </aside>
    )
}
