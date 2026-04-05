export async function registerPwa() {
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      console.info('[PWA] service worker registrado', registration.scope)
    } catch (error) {
      console.error('[PWA] falha ao registrar service worker', error)
    }
  })
}
