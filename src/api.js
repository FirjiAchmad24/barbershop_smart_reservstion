export class ApiError extends Error {
  constructor(message, status, details) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration))

export async function api(path, options = {}, attempt = 0) {
  let response
  try {
    response = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      headers: options.body ? { 'Content-Type': 'application/json', ...options.headers } : options.headers,
      ...options,
      body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body,
    })
  } catch (error) {
    const method = options.method || 'GET'
    if (method === 'GET' && attempt < 2) {
      await wait(350 * (attempt + 1))
      return api(path, options, attempt + 1)
    }
    throw new ApiError('Server API tidak tersambung. Pastikan npm run dev masih berjalan.', 0, { cause: error.message })
  }
  if (response.status === 204) return null
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login') window.dispatchEvent(new Event('auth-expired'))
    throw new ApiError(data.message || 'Permintaan tidak berhasil.', response.status, data)
  }
  return data
}

export function subscribeToEvents(onEvent) {
  const source = new EventSource('/api/events')
  const eventNames = ['queue-updated', 'rating-created', 'master-updated', 'waitlist-updated', 'notification-created']
  const handler = (event) => onEvent(event.type, JSON.parse(event.data || '{}'))
  eventNames.forEach((name) => source.addEventListener(name, handler))
  return () => source.close()
}
