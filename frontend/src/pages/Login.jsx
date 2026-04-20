import { useState } from 'react'
import { api } from '../api.js'

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'login') {
        const data = await api.login(email, password)
        onLogin(data.access_token)
      } else {
        await api.register(email, password)
        const data = await api.login(email, password)
        onLogin(data.access_token)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Asymptote</h1>
      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(mode === 'login' ? styles.tabActive : {}) }}
          onClick={() => { setMode('login'); setError(null) }}
        >
          Log in
        </button>
        <button
          style={{ ...styles.tab, ...(mode === 'register' ? styles.tabActive : {}) }}
          onClick={() => { setMode('register'); setError(null) }}
        >
          Register
        </button>
      </div>
      <form onSubmit={handleSubmit} style={styles.form}>
        <input
          style={styles.input}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          style={styles.input}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p style={styles.error}>{error}</p>}
        <button style={styles.button} type="submit" disabled={loading}>
          {loading ? '...' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>
    </div>
  )
}

const styles = {
  container: { marginTop: 80, textAlign: 'center' },
  title: { fontSize: 32, fontWeight: 700, marginBottom: 32, letterSpacing: 2 },
  tabs: { display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 },
  tab: {
    background: 'none',
    border: '1px solid #2a2a2a',
    borderRadius: 6,
    color: '#888',
    cursor: 'pointer',
    fontSize: 14,
    padding: '6px 16px',
  },
  tabActive: { background: '#2a2a2a', color: '#e8e8e8' },
  form: { display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 320, margin: '0 auto' },
  input: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 6,
    color: '#e8e8e8',
    fontSize: 15,
    padding: '10px 12px',
  },
  button: {
    background: '#e8e8e8',
    border: 'none',
    borderRadius: 6,
    color: '#0f0f0f',
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 600,
    padding: '10px 12px',
  },
  error: { color: '#ff6b6b', fontSize: 13 },
}
