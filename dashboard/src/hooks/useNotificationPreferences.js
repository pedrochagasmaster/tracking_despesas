import { useEffect, useMemo, useState } from 'react'

const KEY = 'tracking-notification-preferences'
const DEFAULTS = {
  budget: true,
  subscription: true,
}

export default function useNotificationPreferences() {
  const [prefs, setPrefs] = useState(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return DEFAULTS
      return { ...DEFAULTS, ...JSON.parse(raw) }
    } catch {
      return DEFAULTS
    }
  })

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  }, [prefs])

  function setPreference(key, value) {
    setPrefs((current) => ({ ...current, [key]: value }))
  }

  return useMemo(() => ({
    prefs,
    setPreference,
  }), [prefs])
}
