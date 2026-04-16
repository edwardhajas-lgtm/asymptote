const BASE = '/api'

function getToken() {
  return localStorage.getItem('token')
}

function authHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request(method, path, body, params) {
  let url = BASE + path
  if (params) {
    const qs = new URLSearchParams(params).toString()
    if (qs) url += '?' + qs
  }

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }

  if (res.status === 204) return null
  return res.json()
}

export const api = {
  login: (username, password) => {
    const form = new URLSearchParams({ username, password })
    return fetch(BASE + '/users/login', { method: 'POST', body: form })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }))
          throw new Error(err.detail || 'Login failed')
        }
        return res.json()
      })
  },

  getMe: () => request('GET', '/users/me'),

  getExercises: () => request('GET', '/exercises'),

  getPreferences: () => request('GET', '/preferences'),
  createPreference: (body) => request('POST', '/preferences', body),
  updatePreference: (id, body) => request('PATCH', `/preferences/${id}`, body),
  deletePreference: (id) => request('DELETE', `/preferences/${id}`),

  createSession: (body) => request('POST', '/sessions', body),
  completeSession: (id) => request('PATCH', `/sessions/${id}/complete`),

  logSet: (sessionId, body) => request('POST', `/sessions/${sessionId}/sets`, body),

  getForecast: () => request('GET', '/forecast'),

  completePlannedSet: (id, actualSetId) =>
    request('PATCH', `/planned-sets/${id}/complete`, null,
      actualSetId != null ? { actual_set_id: actualSetId } : undefined),
}
