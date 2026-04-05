import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { buildFinanceReminders } from '../utils/reminders'

const DISMISS_KEY = 'tracking-notifications-dismissed'
const LAST_SENT_PREFIX = 'tracking-notification-last:'

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export default function useFinanceReminders(enabled = true, preferences = { budget: true, subscription: true }) {
  const [permission, setPermission] = useState(() => {
    if (typeof Notification === 'undefined') return 'unsupported'
    return Notification.permission
  })
  const [openPrompt, setOpenPrompt] = useState(false)
  const [enabling, setEnabling] = useState(false)
  const [lastCheck, setLastCheck] = useState(null)

  useEffect(() => {
    if (!enabled || typeof Notification === 'undefined') return
    const dismissed = localStorage.getItem(DISMISS_KEY) === 'true'
    if (Notification.permission === 'default' && !dismissed) {
      setOpenPrompt(true)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled || permission !== 'granted') return
    let cancelled = false

    async function run() {
      try {
        const [subscriptions, budgetsResponse] = await Promise.all([
          api.subscriptions(),
          api.budgets(),
        ])
        if (cancelled) return

        const reminders = buildFinanceReminders({
          subscriptions,
          budgets: budgetsResponse.items || [],
          preferences,
        })

        reminders.forEach((reminder) => {
          const key = `${LAST_SENT_PREFIX}${reminder.id}`
          if (localStorage.getItem(key) === todayKey()) return
          new Notification(reminder.title, {
            body: reminder.body,
            tag: reminder.id,
            renotify: false,
          })
          localStorage.setItem(key, todayKey())
        })
        setLastCheck(new Date().toISOString())
      } catch (error) {
        console.error('[notifications] reminder check failed', error)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [enabled, permission, preferences])

  const canNotify = permission === 'granted'

  async function enable() {
    if (typeof Notification === 'undefined') return false
    setEnabling(true)
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      setOpenPrompt(false)
      if (result !== 'granted') {
        localStorage.setItem(DISMISS_KEY, 'true')
      } else {
        localStorage.removeItem(DISMISS_KEY)
      }
      return result === 'granted'
    } finally {
      setEnabling(false)
    }
  }

  function dismiss() {
    setOpenPrompt(false)
    localStorage.setItem(DISMISS_KEY, 'true')
  }

  return useMemo(() => ({
    permission,
    canNotify,
    openPrompt,
    enabling,
    enable,
    dismiss,
    lastCheck,
  }), [permission, canNotify, openPrompt, enabling, lastCheck])
}
