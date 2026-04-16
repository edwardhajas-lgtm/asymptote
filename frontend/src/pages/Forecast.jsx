import { useState, useEffect } from 'react'
import { api } from '../api.js'

export default function Forecast() {
  const [forecast, setForecast] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [completing, setCompleting] = useState(null)

  useEffect(() => {
    load()
  }, [])

  function load() {
    setLoading(true)
    api.getForecast()
      .then(setForecast)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  async function markDone(plannedSetId) {
    setCompleting(plannedSetId)
    try {
      await api.completePlannedSet(plannedSetId)
      setForecast((prev) =>
        prev.map((day) => ({
          ...day,
          sets: day.sets.filter((s) => s.id !== plannedSetId),
        })).filter((day) => day.sets.length > 0)
      )
    } catch (err) {
      alert(err.message)
    } finally {
      setCompleting(null)
    }
  }

  if (loading) return <p style={styles.muted}>Loading forecast...</p>
  if (error) return <p style={styles.error}>{error}</p>
  if (forecast.length === 0) return (
    <div>
      <h2 style={styles.heading}>Forecast</h2>
      <p style={styles.muted}>Nothing scheduled. Complete a session to generate your next plan.</p>
    </div>
  )

  return (
    <div>
      <h2 style={styles.heading}>Forecast</h2>
      {forecast.map((day) => (
        <div key={day.date} style={styles.dayBlock}>
          <h3 style={styles.dateLabel}>{formatDate(day.date)}</h3>
          {groupByExercise(day.sets).map(([name, sets]) => (
            <div key={name} style={styles.exerciseBlock}>
              <div style={styles.exHeader}>
                <span style={styles.exName}>{name}</span>
                <span style={styles.setCount}>{sets.length} sets</span>
              </div>
              {sets.map((s) => (
                <div key={s.id} style={styles.setRow}>
                  <span style={styles.setDetail}>
                    Set {s.set_number}: {s.weight_recommended != null ? `${s.weight_recommended}lbs` : '—'} × {s.reps_target_min}–{s.reps_target_max}
                  </span>
                  <button
                    onClick={() => markDone(s.id)}
                    disabled={completing === s.id}
                    style={styles.doneBtn}
                  >
                    {completing === s.id ? '...' : 'done'}
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function groupByExercise(sets) {
  const map = {}
  for (const s of sets) {
    if (!map[s.exercise_name]) map[s.exercise_name] = []
    map[s.exercise_name].push(s)
  }
  return Object.entries(map)
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

const styles = {
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 16 },
  muted: { color: '#888', fontSize: 14 },
  error: { color: '#ff6b6b', fontSize: 14 },
  dayBlock: { marginBottom: 24 },
  dateLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#888',
    marginBottom: 8,
  },
  exerciseBlock: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  exHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  exName: { fontWeight: 600 },
  setCount: { color: '#888', fontSize: 13 },
  setRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0',
    borderBottom: '1px solid #2a2a2a',
  },
  setDetail: { color: '#aaa', fontSize: 13 },
  doneBtn: {
    background: 'none',
    border: '1px solid #3a3a3a',
    borderRadius: 4,
    color: '#888',
    cursor: 'pointer',
    fontSize: 12,
    padding: '2px 8px',
  },
}
