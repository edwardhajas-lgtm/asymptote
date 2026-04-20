import { useState, useEffect } from 'react'
import Login from './pages/Login.jsx'
import Setup from './pages/Setup.jsx'
import Train from './pages/Train.jsx'
import Forecast from './pages/Forecast.jsx'
import Metrics from './pages/Metrics.jsx'
import History from './pages/History.jsx'
import Profile from './pages/Profile.jsx'
import { api } from './api.js'

const NAV = ['train', 'forecast', 'metrics', 'history', 'setup', 'profile']

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [page, setPage] = useState('train')

  useEffect(() => {
    if (token) localStorage.setItem('token', token)
    else localStorage.removeItem('token')
  }, [token])

  function handleLogin(t) {
    setToken(t)
    setPage('train')
  }

  function handleLogout() {
    setToken(null)
  }

  if (!token) return <Login onLogin={handleLogin} />

  return (
    <div>
      <header style={styles.header}>
        <span style={styles.logo}>Asymptote</span>
        <nav style={styles.nav}>
          {NAV.map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              style={{ ...styles.navBtn, ...(page === p ? styles.navActive : {}) }}
            >
              {p}
            </button>
          ))}
          <button onClick={handleLogout} style={{ ...styles.navBtn, color: '#555' }}>
            out
          </button>
        </nav>
      </header>

      <main style={{ paddingTop: 16 }}>
        {page === 'train' && <Train />}
        {page === 'forecast' && <Forecast />}
        {page === 'metrics' && <Metrics />}
        {page === 'history' && <History />}
        {page === 'setup' && <Setup />}
        {page === 'profile' && <Profile />}
      </main>
    </div>
  )
}

const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #2a2a2a',
    paddingBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  logo: { fontWeight: 700, fontSize: 18, letterSpacing: 1 },
  nav: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  navBtn: {
    background: 'none',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    fontSize: 13,
    padding: '4px 8px',
    borderRadius: 4,
    textTransform: 'lowercase',
  },
  navActive: { color: '#e8e8e8', background: '#2a2a2a' },
}
