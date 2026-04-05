import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import OfflineSnapshotBanner from './components/OfflineSnapshotBanner'
import InstallPwaPopup from './components/InstallPwaPopup'
import EnableNotificationsPopup from './components/EnableNotificationsPopup'
import NotificationPreferencesCard from './components/NotificationPreferencesCard'
import Overview from './pages/Overview'
import Transactions from './pages/Transactions'
import Subscriptions from './pages/Subscriptions'
import Budgets from './pages/Budgets'
import Analytics from './pages/Analytics'
import Curation from './pages/Curation'
import { Menu, WifiOff } from 'lucide-react'
import useOnlineStatus from './hooks/useOnlineStatus'
import usePwaInstallPrompt from './hooks/usePwaInstallPrompt'
import useFinanceReminders from './hooks/useFinanceReminders'
import useNotificationPreferences from './hooks/useNotificationPreferences'

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const online = useOnlineStatus()
  const pwaInstall = usePwaInstallPrompt()
  const notificationPreferences = useNotificationPreferences()
  const notifications = useFinanceReminders(online, notificationPreferences.prefs)

  return (
    <BrowserRouter>
      <div className="min-h-screen overflow-x-hidden bg-[#050505]">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          footerContent={(
            <NotificationPreferencesCard
              permission={notifications.permission}
              prefs={notificationPreferences.prefs}
              onToggle={notificationPreferences.setPreference}
            />
          )}
        />
        {sidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-[#000]/80 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu lateral"
          />
        )}

        <main className="min-h-screen lg:ml-64 overflow-y-auto scrollbar-thin">
          <div className="sticky top-0 z-20 border-b border-[var(--border-color)] panel px-4 py-3 lg:hidden backdrop-blur">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="btn-ghost flex items-center gap-2 px-3 py-2"
              aria-label="Abrir menu lateral"
            >
              <Menu size={16} />
              <span className="font-mono text-xs uppercase tracking-wider">Menu</span>
            </button>
          </div>

          <div className="max-w-6xl mx-auto px-4 py-5 lg:p-8 space-y-4">
            {!online && (
              <div className="status-warn p-3 flex items-center gap-2 text-sm">
                <WifiOff size={16} />
                <span>Sem conexão agora. O app vai tentar usar os últimos dados salvos localmente.</span>
              </div>
            )}

            <Routes>
              <Route path="/" element={<Overview offlineBanner={OfflineSnapshotBanner} />} />
              <Route path="/transactions" element={<Transactions offlineBanner={OfflineSnapshotBanner} />} />
              <Route path="/subscriptions" element={<Subscriptions />} />
              <Route path="/budgets" element={<Budgets offlineBanner={OfflineSnapshotBanner} />} />
              <Route path="/analytics" element={<Analytics offlineBanner={OfflineSnapshotBanner} />} />
              <Route path="/inbox" element={<Curation />} />
              <Route path="/curation" element={<Curation />} />
            </Routes>
          </div>

          <InstallPwaPopup
            open={pwaInstall.open && pwaInstall.canInstall}
            installing={pwaInstall.installing}
            onInstall={pwaInstall.promptInstall}
            onDismiss={pwaInstall.dismiss}
          />

          <EnableNotificationsPopup
            open={notifications.openPrompt && notifications.permission === 'default'}
            enabling={notifications.enabling}
            onEnable={notifications.enable}
            onDismiss={notifications.dismiss}
          />
        </main>
      </div>
    </BrowserRouter>
  )
}
