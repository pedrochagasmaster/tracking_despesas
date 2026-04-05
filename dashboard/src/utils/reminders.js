function addMonths(date, months) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

function startOfDay(value = new Date()) {
  const d = new Date(value)
  d.setHours(0, 0, 0, 0)
  return d
}

export function nextSubscriptionDueDate(subscription, fromDate = new Date()) {
  if (!subscription?.start_date || !subscription?.active) return null

  const start = startOfDay(new Date(`${subscription.start_date}T00:00:00`))
  const from = startOfDay(fromDate)
  const end = subscription.end_date ? startOfDay(new Date(`${subscription.end_date}T00:00:00`)) : null
  if (Number.isNaN(start.getTime())) return null
  if (end && from > end) return null

  let cursor = start
  const step = subscription.frequency === 'yearly' ? 12 : 1
  while (cursor < from) {
    cursor = addMonths(cursor, step)
    if (end && cursor > end) return null
  }
  return cursor
}

export function diffInDays(targetDate, fromDate = new Date()) {
  const target = startOfDay(targetDate)
  const from = startOfDay(fromDate)
  return Math.round((target.getTime() - from.getTime()) / 86400000)
}

export function buildFinanceReminders({ subscriptions = [], budgets = [], preferences = { budget: true, subscription: true } } = {}) {
  const reminders = []
  const now = new Date()

  if (preferences.subscription) subscriptions
    .filter((sub) => sub?.active)
    .forEach((sub) => {
      const due = nextSubscriptionDueDate(sub, now)
      if (!due) return
      const days = diffInDays(due, now)
      if (days < 0 || days > 3) return
      reminders.push({
        id: `subscription:${sub.id}:${due.toISOString().slice(0, 10)}`,
        title: days === 0 ? `Assinatura vence hoje: ${sub.name}` : `Assinatura chegando: ${sub.name}`,
        body: days === 0
          ? `Cobrança de ${sub.name} prevista para hoje.`
          : `Cobrança de ${sub.name} prevista em ${days} dia(s).`,
        kind: 'subscription',
        severity: days === 0 ? 'warn' : 'info',
      })
    })

  if (preferences.budget) budgets.forEach((budget) => {
    if (!budget?.category) return
    const pct = Number(budget.pct || 0)
    if (pct >= 100) {
      reminders.push({
        id: `budget:${budget.category}:over`,
        title: `Orçamento estourado: ${budget.category}`,
        body: `${budget.category} já passou do limite definido.`,
        kind: 'budget',
        severity: 'warn',
      })
    } else if (pct >= 90) {
      reminders.push({
        id: `budget:${budget.category}:near`,
        title: `Orçamento perto do limite: ${budget.category}`,
        body: `${budget.category} já consumiu ${pct.toFixed(0)}% do orçamento.`,
        kind: 'budget',
        severity: 'info',
      })
    }
  })

  return reminders
}
