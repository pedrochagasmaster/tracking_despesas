import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Overview from './pages/Overview'
import Transactions from './pages/Transactions'
import Subscriptions from './pages/Subscriptions'
import Budgets from './pages/Budgets'
import Analytics from './pages/Analytics'
import { Menu } from 'lucide-react'

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <BrowserRouter>
      <div className="min-h-screen overflow-x-hidden bg-slate-950 bg-gradient-to-b from-slate-950 via-slate-950 to-blue-950/40">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        {sidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-slate-950/65 backdrop-blur-[1px] lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu lateral"
          />
        )}

        <main className="min-h-screen lg:ml-64 overflow-y-auto scrollbar-thin">
          <div className="sticky top-0 z-20 border-b border-slate-800/60 bg-slate-950/85 backdrop-blur-xl px-4 py-3 lg:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="btn-ghost flex items-center gap-2 px-3 py-2"
              aria-label="Abrir menu lateral"
            >
              <Menu size={16} />
              <span>Menu</span>
            </button>
          </div>

          <div className="max-w-6xl mx-auto px-4 py-5 lg:p-8">
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/subscriptions" element={<Subscriptions />} />
              <Route path="/budgets" element={<Budgets />} />
              <Route path="/analytics" element={<Analytics />} />
            </Routes>
          </div>
        </main>
      </div>
    </BrowserRouter>
  )
}
