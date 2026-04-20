import { useState, useEffect, useRef } from 'react'
import { api } from '../api.js'

const ORDER_KEY = 'exercise_order'

function loadOrder() {
  try { return JSON.parse(localStorage.getItem(ORDER_KEY)) || [] }
  catch { return [] }
}

function saveOrder(ids) {
  localStorage.setItem(ORDER_KEY, JSON.stringify(ids))
}

export default function Setup() {
  const [exercises, setExercises] = useState([])
  const [preferences, setPreferences] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [order, setOrder] = useState(loadOrder)
  const dragId = useRef(null)

  useEffect(() => {
    Promise.all([api.getExercises(), api.getPreferences()])
      .then(([exs, prefs]) => {
        setExercises(exs)
        setPreferences(prefs)
        // seed order with any selected exercises not yet in saved order
        setOrder((prev) => {
          const existing = new Set(prev)
          const newIds = prefs.map((p) => p.exercise_id).filter((id) => !existing.has(id))
          return [...prev, ...newIds]
        })
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  function prefFor(exerciseId) {
    return preferences.find((p) => p.exercise_id === exerciseId) || null
  }

  async function handleCheck(exercise, checked) {
    setBusy(exercise.id)
    try {
      if (checked) {
        const created = await api.createPreference({
          exercise_id: exercise.id,
          target_sets_per_session: 3,
          target_sessions_per_week: 2,
        })
        setPreferences((prev) => [...prev, created])
        setOrder((prev) => {
          if (prev.includes(exercise.id)) return prev
          const updated = [...prev, exercise.id]
          saveOrder(updated)
          return updated
        })
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(null)
    }
  }

  async function handleUpdate(exerciseId, sets, sessionsPerWeek, estimated1rm) {
    const pref = prefFor(exerciseId)
    if (!pref) return
    setBusy(exerciseId)
    try {
      const body = { target_sets_per_session: sets, target_sessions_per_week: sessionsPerWeek }
      if (estimated1rm) body.estimated_1rm = parseFloat(estimated1rm)
      const updated = await api.updatePreference(pref.id, body)
      setPreferences((prev) => prev.map((p) => (p.exercise_id === exerciseId ? updated : p)))
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(null)
    }
  }

  // drag-to-reorder
  function onDragStart(e, exerciseId) {
    dragId.current = exerciseId
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(e, exerciseId) {
    e.preventDefault()
    if (dragId.current === exerciseId) return
    setOrder((prev) => {
      const from = prev.indexOf(dragId.current)
      const to = prev.indexOf(exerciseId)
      if (from === -1 || to === -1) return prev
      const next = [...prev]
      next.splice(from, 1)
      next.splice(to, 0, dragId.current)
      return next
    })
  }

  function onDragEnd() {
    saveOrder(order)
    dragId.current = null
  }

  if (loading) return <p style={styles.muted}>Loading...</p>
  if (error) return <p style={styles.error}>{error}</p>

  const selectedIds = new Set(preferences.map((p) => p.exercise_id))
  const orderedSelected = order
    .filter((id) => selectedIds.has(id))
    .map((id) => exercises.find((e) => e.id === id))
    .filter(Boolean)

  const unselected = exercises.filter((e) => !selectedIds.has(e.id))
  const byMuscle = unselected.reduce((acc, ex) => {
    const g = ex.muscle_group || 'Other'
    if (!acc[g]) acc[g] = []
    acc[g].push(ex)
    return acc
  }, {})

  return (
    <div>
      <h2 style={styles.heading}>Exercise Setup</h2>

      {orderedSelected.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p style={styles.sectionLabel}>Your exercises — drag to reorder</p>
          {orderedSelected.map((ex) => (
            <SelectedRow
              key={ex.id}
              exercise={ex}
              pref={prefFor(ex.id)}
              busy={busy === ex.id}
              onUpdate={handleUpdate}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}

      {Object.keys(byMuscle).length > 0 && (
        <div>
          <p style={styles.sectionLabel}>Add exercises</p>
          {Object.entries(byMuscle).sort().map(([group, exs]) => (
            <div key={group} style={{ marginBottom: 16 }}>
              <p style={styles.groupLabel}>{group}</p>
              {exs.map((ex) => (
                <UnselectedRow
                  key={ex.id}
                  exercise={ex}
                  busy={busy === ex.id}
                  onCheck={() => handleCheck(ex, true)}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SelectedRow({ exercise, pref, busy, onUpdate, onDragStart, onDragOver, onDragEnd }) {
  const [sets, setSets] = useState(pref?.target_sets_per_session ?? 3)
  const [sessionsPerWeek, setSessionsPerWeek] = useState(pref?.target_sessions_per_week ?? 2)
  const [estimated1rm, setEstimated1rm] = useState(pref?.estimated_1rm ?? '')
  const [dirty, setDirty] = useState(false)

  function change(setter) {
    return (e) => { setter(e.target.type === 'number' ? Number(e.target.value) : e.target.value); setDirty(true) }
  }

  async function save() {
    await onUpdate(exercise.id, sets, sessionsPerWeek, estimated1rm)
    setDirty(false)
  }

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, exercise.id)}
      onDragOver={(e) => onDragOver(e, exercise.id)}
      onDragEnd={onDragEnd}
      style={styles.selectedRow}
    >
      <span style={styles.dragHandle}>⠿</span>
      <span style={styles.exName}>{exercise.name}</span>
      <span style={styles.repRange}>{exercise.target_rep_min}–{exercise.target_rep_max}</span>
      <label style={styles.label}>
        sets
        <input type="number" min={1} max={10} value={sets} onChange={change(setSets)} style={styles.numInput} />
      </label>
      <label style={styles.label}>
        /wk
        <input type="number" min={1} max={7} value={sessionsPerWeek} onChange={change(setSessionsPerWeek)} style={styles.numInput} />
      </label>
      <label style={styles.label}>
        1RM
        <input type="number" min={0} step={0.5} placeholder="lbs" value={estimated1rm}
          onChange={(e) => { setEstimated1rm(e.target.value); setDirty(true) }}
          style={{ ...styles.numInput, width: 52 }} />
      </label>
      {dirty && (
        <button onClick={save} disabled={busy} style={styles.saveBtn}>
          {busy ? '...' : 'save'}
        </button>
      )}
    </div>
  )
}

function UnselectedRow({ exercise, busy, onCheck }) {
  return (
    <div style={styles.unselectedRow}>
      <label style={styles.checkLabel}>
        <input
          type="checkbox"
          checked={false}
          onChange={onCheck}
          disabled={busy}
          style={{ accentColor: '#e8e8e8' }}
        />
        <span>{exercise.name}</span>
      </label>
      <span style={styles.repRange}>{exercise.target_rep_min}–{exercise.target_rep_max} reps</span>
    </div>
  )
}

const styles = {
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 16 },
  muted: { color: '#888', fontSize: 14 },
  error: { color: '#ff6b6b', fontSize: 14 },
  sectionLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#888', marginBottom: 8 },
  groupLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#555', marginBottom: 4 },
  selectedRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 8,
    padding: '8px 10px',
    marginBottom: 6,
    cursor: 'grab',
  },
  dragHandle: { color: '#555', fontSize: 16, cursor: 'grab', userSelect: 'none' },
  exName: { flex: 1, fontWeight: 500, fontSize: 14 },
  repRange: { color: '#555', fontSize: 12, whiteSpace: 'nowrap' },
  label: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#888', whiteSpace: 'nowrap' },
  numInput: {
    background: '#0f0f0f',
    border: '1px solid #2a2a2a',
    borderRadius: 4,
    color: '#e8e8e8',
    fontSize: 13,
    padding: '2px 4px',
    width: 40,
    textAlign: 'center',
  },
  saveBtn: {
    background: '#e8e8e8',
    border: 'none',
    borderRadius: 4,
    color: '#0f0f0f',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    padding: '3px 8px',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: '#555',
    cursor: 'pointer',
    fontSize: 14,
    padding: '2px 4px',
  },
  unselectedRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 4px',
    borderBottom: '1px solid #1a1a1a',
  },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 },
}
