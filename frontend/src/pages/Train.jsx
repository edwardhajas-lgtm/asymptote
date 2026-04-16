import { useState, useEffect } from 'react'
import { api } from '../api.js'

const PHASES = { idle: 'idle', active: 'active', done: 'done' }

function loadOrder() {
  try { return JSON.parse(localStorage.getItem('exercise_order')) || [] }
  catch { return [] }
}

function sortByOrder(preferences) {
  const order = loadOrder()
  if (order.length === 0) return preferences
  return [...preferences].sort((a, b) => {
    const ai = order.indexOf(a.exercise_id)
    const bi = order.indexOf(b.exercise_id)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

export default function Train() {
  const [phase, setPhase] = useState(PHASES.idle)
  const [preferences, setPreferences] = useState([])
  const [session, setSession] = useState(null)
  const [loggedSets, setLoggedSets] = useState([])
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getPreferences()
      .then((prefs) => setPreferences(sortByOrder(prefs)))
      .catch((err) => setError(err.message))
  }, [])

  async function startSession() {
    setLoading(true)
    setError(null)
    try {
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
      const s = await api.createSession({ session_datetime: now })
      setSession(s)
      setLoggedSets([])
      setPhase(PHASES.active)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogSet(exerciseId, setNumber, weight, reps, rpe) {
    try {
      const set = await api.logSet(session.id, {
        exercise_id: exerciseId,
        set_number: setNumber,
        weight_used: weight,
        reps_completed: reps,
        rpe: rpe || null,
      })
      setLoggedSets((prev) => [...prev, set])
      return set
    } catch (err) {
      alert(err.message)
      return null
    }
  }

  async function finishSession() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.completeSession(session.id)
      setResults(res)
      setPhase(PHASES.done)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (phase === PHASES.idle) {
    return (
      <div>
        <h2 style={styles.heading}>Ready to train?</h2>
        {preferences.length === 0 && (
          <p style={styles.muted}>No exercises set up yet. Go to Setup to add some.</p>
        )}
        {error && <p style={styles.error}>{error}</p>}
        <button
          onClick={startSession}
          disabled={loading || preferences.length === 0}
          style={styles.primaryBtn}
        >
          {loading ? 'Starting...' : 'Start Session'}
        </button>
      </div>
    )
  }

  if (phase === PHASES.done) {
    return (
      <div>
        <h2 style={styles.heading}>Session complete</h2>
        <p style={styles.muted}>{loggedSets.length} sets logged</p>
        {results?.algorithm_results && (
          <pre style={styles.results}>
            {JSON.stringify(results.algorithm_results, null, 2)}
          </pre>
        )}
        <button
          onClick={() => { setPhase(PHASES.idle); setSession(null); setResults(null) }}
          style={styles.primaryBtn}
        >
          Done
        </button>
      </div>
    )
  }

  return (
    <div>
      <div style={styles.sessionHeader}>
        <span style={styles.heading}>Session #{session.sequence_number}</span>
        <button onClick={finishSession} disabled={loading} style={styles.finishBtn}>
          {loading ? '...' : 'Finish'}
        </button>
      </div>
      {error && <p style={styles.error}>{error}</p>}

      {preferences.map((pref) => (
        <ExerciseLogger
          key={pref.exercise_id}
          pref={pref}
          sessionId={session.id}
          loggedSets={loggedSets.filter((s) => s.exercise_id === pref.exercise_id)}
          onLogSet={handleLogSet}
        />
      ))}
    </div>
  )
}

function ExerciseLogger({ pref, sessionId, loggedSets, onLogSet }) {
  const total = pref.target_sets_per_session
  const nextSetNumber = loggedSets.length + 1
  const done = loggedSets.length >= total

  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [rpe, setRpe] = useState('')
  const [saving, setSaving] = useState(false)

  async function log() {
    if (!weight || !reps) return
    setSaving(true)
    const set = await onLogSet(
      pref.exercise_id,
      nextSetNumber,
      parseFloat(weight),
      parseInt(reps),
      rpe ? parseFloat(rpe) : null
    )
    if (set) {
      setWeight('')
      setReps('')
      setRpe('')
    }
    setSaving(false)
  }

  return (
    <div style={styles.exerciseBlock}>
      <div style={styles.exHeader}>
        <span style={styles.exName}>{pref.exercise_name}</span>
        <span style={styles.setCount}>
          {loggedSets.length}/{total} sets
        </span>
      </div>

      {loggedSets.map((s, i) => (
        <div key={s.id} style={styles.loggedSet}>
          Set {i + 1}: {s.weight_used}lbs × {s.reps_completed}
          {s.rpe != null ? ` @ RPE ${s.rpe}` : ''}
        </div>
      ))}

      {!done && (
        <div style={styles.inputRow}>
          <input
            style={styles.setInput}
            type="number"
            placeholder="lbs"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <input
            style={styles.setInput}
            type="number"
            placeholder="reps"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
          />
          <input
            style={{ ...styles.setInput, width: 52 }}
            type="number"
            placeholder="RPE"
            min={1}
            max={10}
            step={0.5}
            value={rpe}
            onChange={(e) => setRpe(e.target.value)}
          />
          <button
            onClick={log}
            disabled={saving || !weight || !reps}
            style={styles.logBtn}
          >
            {saving ? '...' : `Log set ${nextSetNumber}`}
          </button>
        </div>
      )}

      {done && <p style={styles.doneTag}>✓ done</p>}
    </div>
  )
}

const styles = {
  heading: { fontSize: 20, fontWeight: 700 },
  muted: { color: '#888', fontSize: 14, margin: '8px 0 16px' },
  error: { color: '#ff6b6b', fontSize: 14, margin: '8px 0' },
  primaryBtn: {
    marginTop: 16,
    background: '#e8e8e8',
    border: 'none',
    borderRadius: 6,
    color: '#0f0f0f',
    cursor: 'pointer',
    fontSize: 15,
    fontWeight: 600,
    padding: '10px 20px',
    width: '100%',
  },
  sessionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  finishBtn: {
    background: '#3a6b3a',
    border: 'none',
    borderRadius: 6,
    color: '#e8e8e8',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    padding: '6px 14px',
  },
  exerciseBlock: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  exHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  exName: { fontWeight: 600 },
  setCount: { color: '#888', fontSize: 13 },
  loggedSet: {
    color: '#aaa',
    fontSize: 13,
    padding: '3px 0',
    borderBottom: '1px solid #2a2a2a',
    marginBottom: 4,
  },
  inputRow: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 },
  setInput: {
    background: '#0f0f0f',
    border: '1px solid #2a2a2a',
    borderRadius: 4,
    color: '#e8e8e8',
    fontSize: 14,
    padding: '5px 8px',
    width: 64,
  },
  logBtn: {
    background: '#2a4a2a',
    border: 'none',
    borderRadius: 4,
    color: '#e8e8e8',
    cursor: 'pointer',
    fontSize: 13,
    padding: '5px 10px',
    whiteSpace: 'nowrap',
  },
  doneTag: { color: '#5a9a5a', fontSize: 13, marginTop: 8 },
  results: {
    background: '#1a1a1a',
    borderRadius: 6,
    fontSize: 12,
    margin: '12px 0',
    overflowX: 'auto',
    padding: 12,
    color: '#aaa',
  },
}
