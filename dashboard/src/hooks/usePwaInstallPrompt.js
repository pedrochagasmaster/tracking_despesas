import { useEffect, useState } from 'react'

const DISMISS_KEY = 'tracking-pwa-install-dismissed'

export default function usePwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [open, setOpen] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY) === 'true'

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setDeferredPrompt(event)
      if (!dismissed) setOpen(true)
    }

    const onAppInstalled = () => {
      setOpen(false)
      setDeferredPrompt(null)
      setInstalling(false)
      localStorage.removeItem(DISMISS_KEY)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  async function promptInstall() {
    if (!deferredPrompt) return false
    setInstalling(true)
    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      setDeferredPrompt(null)
      setOpen(false)
      if (choice?.outcome !== 'accepted') {
        localStorage.setItem(DISMISS_KEY, 'true')
      }
      return choice?.outcome === 'accepted'
    } finally {
      setInstalling(false)
    }
  }

  function dismiss() {
    setOpen(false)
    localStorage.setItem(DISMISS_KEY, 'true')
  }

  return {
    canInstall: Boolean(deferredPrompt),
    open,
    installing,
    promptInstall,
    dismiss,
  }
}
