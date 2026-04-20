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
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
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
    return fetch(BASE + '/users/login', { method: 'POST', body: form }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(err.detail || 'Login failed')
      }
      return res.json()
    })
  },
  register: (email, password) => request('POST', '/users', { email, password }),

  getMe: () => request('GET', '/users/me'),
  updateMe: (body) => request('PATCH', '/users/me', body),

  getExercises: () => request('GET', '/exercises'),
  toggle1rmTracking: (exerciseId) => request('PATCH', `/exercises/${exerciseId}/1rm-tracking`),

  getPreferences: () => request('GET', '/preferences'),
  createPreference: (body) => request('POST', '/preferences', body),
  updatePreference: (id, body) => request('PATCH', `/preferences/${id}`, body),

  createSession: (body) => request('POST', '/sessions', body),
  getSessions: () => request('GET', '/sessions'),
  getSession: (id) => request('GET', `/sessions/${id}`),
  getSessionSets: (id) => request('GET', `/sessions/${id}/sets`),
  completeSession: (id) => request('PATCH', `/sessions/${id}/complete`),
  generateDeload: (id) => request('POST', `/sessions/${id}/generate-deload`),
  logMeasured1rm: (sessionId, exerciseId, weight) =>
    request('POST', `/sessions/${sessionId}/measured-1rm`, { exercise_id: exerciseId, weight }),
  completeShockScreen: (id) => request('GET', `/sessions/${id}/complete-shock`),
  getShockSuggestion: () => request('GET', '/sessions/shock-suggestion'),
  getShockPlan: () => request('GET', '/sessions/shock-plan'),
  get1rmSuggestion: () => request('GET', '/sessions/1rm-suggestion'),

  logSet: (sessionId, body) => request('POST', `/sessions/${sessionId}/sets`, body),

  getForecast: () => request('GET', '/forecast'),
  completePlannedSet: (id, actualSetId) =>
    request('PATCH', `/planned-sets/${id}/complete`, null,
      actualSetId != null ? { actual_set_id: actualSetId } : undefined),

  getMetrics: (exerciseId) => request('GET', `/metrics/${exerciseId}`),
  getPRs: () => request('GET', '/metrics/prs'),

  getSettings: () => request('GET', '/settings'),
  updateSetting: (setting_name, value) => request('POST', '/settings', { setting_name, value }),

  getMenstrualCycle: () => request('GET', '/menstrual-cycle'),
  logMenstrualCycle: (body) => request('POST', '/menstrual-cycle', body),
}
