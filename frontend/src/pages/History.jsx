import { useState, useEffect } from 'react'
import { api } from '../api.js'

export default function History() {
  const [sessions, setSessions] = useState([])
  const [exercises, setExercises] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [sets, setSets] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([api.getSessions(), api.getExercises()])
      .then(([sess, exs]) => {
        setSessions(sess)
        setExercises(exs)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function toggleExpand(id) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!sets[id]) {
      try {
        const s = await api.getSessionSets(id)
        setSets((prev) => ({ ...prev, [id]: s }))
      } catch {
        setSets((prev) => ({ ...prev, [id]: [] }))
      }
    }
  }

  const exMap = Object.fromEntries(exercises.map((e) => [e.id, e.name]))

  if (loading) return <p style={styles.muted}>Loading...</p>
  if (error) return <p style={styles.error}>{error}</p>
  if (sessions.length === 0) return (
    <div>
      <h2 style={styles.heading}>History</h2>
      <p style={styles.muted}>No sessions logged yet.</p>
    </div>
  )

  const byMonth = {}
  for (const s of [...sessions].reverse()) {
    const month = (s.session_datetime || '').slice(0, 7)
    if (!byMonth[month]) byMonth[month] = []
    byMonth[month].push(s)
  }

  return (
    <div>
      <h2 style={styles.heading}>History</h2>
      {Object.entries(byMonth).map(([month, monthSessions]) => (
        <div key={month} style={{ marginBottom: 24 }}>
          <p style={styles.monthLabel}>{formatMonth(month)}</p>
          {monthSessions.map((s) => (
            <div key={s.id} style={styles.sessionBlock}>
              <button style={styles.sessionHeader} onClick={() => toggleExpand(s.id)}>
                <div>
                  <span style={styles.sessionDate}>{formatDate(s.session_datetime)}</span>
                  {s.session_type !== 'normal' && (
                    <span style={styles.sessionType}>{s.session_type}</span>
                  )}
                </div>
                <div style={styles.sessionMeta}>
                  {s.completed_at ? (
                    <span style={styles.completedTag}>done</span>
                  ) : (
                    <span style={styles.incompleteTag}>incomplete</span>
                  )}
                  <span style={styles.chevron}>{expandedId === s.id ? '▾' : '▸'}</span>
                </div>
              </button>

              {expandedId === s.id && (
                <SessionDetail session={s} sets={sets[s.id]} exMap={exMap} />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function SessionDetail({ session, sets, exMap }) {
  if (!sets) return <p style={styles.muted}>Loading sets...</p>

  const wellness = []
  if (session.readiness_score) wellness.push(`Readiness: ${['', 'Ready', 'Half in it', 'Not feeling it'][session.readiness_score]}`)
  if (session.stress_level) wellness.push(`Stress: ${['', 'Low', 'Moderate', 'High'][session.stress_level]}`)
  if (session.sleep_hours) wellness.push(`Sleep: ${session.sleep_hours}h`)
  if (session.sleep_quality) wellness.push(`Sleep quality: ${['', 'Good', 'OK', 'Poor'][session.sleep_quality]}`)

  const byExercise = {}
  for (const s of (sets || [])) {
    const name = exMap[s.exercise_id] || `Exercise ${s.exercise_id}`
    if (!byExercise[name]) byExercise[name] = []
    byExercise[name].push(s)
  }

  return (
    <div style={styles.detail}>
      {wellness.length > 0 && (
        <div style={styles.wellnessLine}>{wellness.join(' · ')}</div>
      )}
      {session.notes && <div style={styles.notes}>{session.notes}</div>}
      {sets?.length === 0 && <p style={styles.muted}>No sets logged.</p>}
      {Object.entries(byExercise).map(([name, exSets]) => (
        <div key={name} style={styles.exBlock}>
          <div style={styles.exName}>{name}</div>
          {exSets.map((s) => (
            <div key={s.id} style={styles.setRow}>
              Set {s.set_number}:
              {s.weight_used != null ? ` ${s.weight_used} lbs` : ''}
              {s.reps_completed != null ? ` × ${s.reps_completed}` : ''}
              {s.rpe != null ? ` @ RPE ${s.rpe}` : ''}
              {s.pain_flag ? ' ⚠ pain' : ''}
              {s.failed_reps > 0 ? ` (${s.failed_reps} failed)` : ''}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function formatMonth(str) {
  const [y, m] = str.split('-')
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatDate(str) {
  if (!str) return ''
  const d = new Date(str.replace(' ', 'T'))
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

const styles = {
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 16 },
  muted: { color: '#888', fontSize: 14 },
  error: { color: '#ff6b6b', fontSize: 14 },
  monthLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#888', marginBottom: 8 },
  sessionBlock: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, marginBottom: 6, overflow: 'hidden' },
  sessionHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', background: 'none', border: 'none', color: '#e8e8e8',
    cursor: 'pointer', padding: '10px 12px', textAlign: 'left',
  },
  sessionDate: { fontSize: 14, fontWeight: 500 },
  sessionType: {
    marginLeft: 8, fontSize: 11, background: '#2a2a3a', borderRadius: 3,
    padding: '1px 6px', color: '#aaa', textTransform: 'uppercase',
  },
  sessionMeta: { display: 'flex', alignItems: 'center', gap: 8 },
  completedTag: { fontSize: 12, color: '#5a9a5a' },
  incompleteTag: { fontSize: 12, color: '#888' },
  chevron: { color: '#555', fontSize: 14 },
  detail: { padding: '0 12px 12px' },
  wellnessLine: { color: '#888', fontSize: 12, marginBottom: 8 },
  notes: { color: '#aaa', fontSize: 13, fontStyle: 'italic', marginBottom: 8 },
  exBlock: { marginBottom: 10 },
  exName: { fontWeight: 600, fontSize: 13, marginBottom: 4 },
  setRow: { color: '#aaa', fontSize: 13, padding: '2px 0' },
}
