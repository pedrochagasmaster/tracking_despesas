const CACHE_VERSION = 'tracking-despesas-v1'
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/offline.html',
  '/pwa-192.png',
  '/pwa-512.png',
  '/pwa-maskable-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys
      .filter((key) => key !== CACHE_VERSION)
      .map((key) => caches.delete(key))
    )).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  const isNavigation = request.mode === 'navigate'
  const isApi = url.pathname.startsWith('/api/') || url.port === '8000'

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_VERSION).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(async () => {
          const cachedApp = await caches.match('/')
          return cachedApp || caches.match('/offline.html')
        })
    )
    return
  }

  if (isApi) {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => new Response(JSON.stringify({
          offline: true,
          detail: 'Sem conexão com a API no momento.',
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }))
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') return response
          const copy = response.clone()
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() => caches.match('/offline.html'))
    })
  )
})
