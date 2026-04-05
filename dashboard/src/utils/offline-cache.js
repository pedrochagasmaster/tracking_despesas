const PREFIX = 'tracking-cache:'

function keyFor(path) {
  return `${PREFIX}${path}`
}

export function writeCachedResponse(path, data) {
  try {
    localStorage.setItem(keyFor(path), JSON.stringify({
      cachedAt: new Date().toISOString(),
      data,
    }))
  } catch {
    // ignore quota/storage errors
  }
}

export function readCachedResponse(path) {
  try {
    const raw = localStorage.getItem(keyFor(path))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function attachOfflineMeta(data, path, cachedAt) {
  if (Array.isArray(data)) {
    return Object.assign([...data], {
      __offline: true,
      __offlineCachedAt: cachedAt,
      __offlineSource: path,
    })
  }

  if (data && typeof data === 'object') {
    return {
      ...data,
      __offline: true,
      __offlineCachedAt: cachedAt,
      __offlineSource: path,
    }
  }

  return data
}
