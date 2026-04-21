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

  function onImported() {
    api.getSessions().then(setSessions).catch(() => null)
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
      <BulkImport onImported={onImported} />
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

const EXAMPLE_JSON = `[
  {
    "session_datetime": "2024-01-15 10:00:00",
    "session_type": "normal",
    "notes": "Felt strong",
    "sets": [
      {
        "exercise_id": 1,
        "set_number": 1,
        "weight_used": 135,
        "reps_completed": 10,
        "rpe": 7
      }
    ]
  }
]`

function BulkImport({ onImported }) {
  const [open, setOpen] = useState(false)
  const [showExample, setShowExample] = useState(false)
  const [json, setJson] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setResult(null)
    let parsed
    try {
      parsed = JSON.parse(json)
    } catch {
      setResult({ ok: false, msg: 'Invalid JSON' })
      return
    }
    if (!Array.isArray(parsed)) {
      setResult({ ok: false, msg: 'Expected a JSON array of sessions' })
      return
    }
    setSubmitting(true)
    try {
      const res = await api.bulkImport(parsed)
      onImported(res.sessions_created)
      setResult({ ok: true, count: res.sessions_created })
      setJson('')
      setOpen(false)
    } catch (err) {
      setResult({ ok: false, msg: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={styles.importBlock}>
      <button style={styles.importToggle} onClick={() => { setOpen((o) => !o); setResult(null) }}>
        {open ? '▾' : '▸'} Import sessions
      </button>
      {result?.ok && (
        <p style={styles.importSuccess}>Imported {result.count} session{result.count !== 1 ? 's' : ''}</p>
      )}
      {open && (
        <div style={styles.importForm}>
          <button style={styles.exampleToggle} onClick={() => setShowExample((o) => !o)}>
            {showExample ? 'Hide' : 'Show'} format example
          </button>
          {showExample && (
            <pre style={styles.examplePre}>{EXAMPLE_JSON}</pre>
          )}
          <form onSubmit={handleSubmit}>
            <textarea
              placeholder="Paste JSON array of sessions here"
              value={json}
              onChange={(e) => setJson(e.target.value)}
              style={styles.importTextarea}
            />
            {result && !result.ok && <p style={styles.importError}>{result.msg}</p>}
            <button type="submit" disabled={submitting || !json.trim()} style={styles.importBtn}>
              {submitting ? 'Importing...' : 'Import'}
            </button>
          </form>
        </div>
      )}
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
  importBlock: { marginTop: 24 },
  importToggle: {
    background: 'none', border: 'none', color: '#888', cursor: 'pointer',
    fontSize: 13, padding: 0, marginBottom: 8,
  },
  importSuccess: { color: '#5a9a5a', fontSize: 13, margin: '4px 0' },
  importForm: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: 12 },
  exampleToggle: {
    background: 'none', border: 'none', color: '#666', cursor: 'pointer',
    fontSize: 12, padding: 0, marginBottom: 8,
  },
  examplePre: {
    background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 4,
    color: '#888', fontSize: 11, padding: 10, overflowX: 'auto',
    marginBottom: 10, whiteSpace: 'pre-wrap',
  },
  importTextarea: {
    background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 4,
    color: '#e8e8e8', fontSize: 13, padding: '8px 10px', width: '100%',
    boxSizing: 'border-box', resize: 'vertical', minHeight: 120, marginBottom: 8,
  },
  importError: { color: '#ff6b6b', fontSize: 13, margin: '0 0 8px' },
  importBtn: {
    background: '#e8e8e8', border: 'none', borderRadius: 6,
    color: '#0f0f0f', cursor: 'pointer', fontSize: 14,
    fontWeight: 600, padding: '8px 16px',
  },
}
