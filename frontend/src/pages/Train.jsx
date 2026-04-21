import { useState, useEffect } from 'react'
import { api } from '../api.js'

const PHASES = { idle: 'idle', active: 'active', done: 'done', shock: 'shock' }

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
  const [sessionType, setSessionType] = useState('normal')
  const [wellness, setWellness] = useState({ readiness_score: null, stress_level: null, sleep_hours: '', sleep_quality: null })
  const [notes, setNotes] = useState('')
  const [loggedSets, setLoggedSets] = useState([])
  const [results, setResults] = useState(null)
  const [shockResult, setShockResult] = useState(null)
  const [shockSuggestion, setShockSuggestion] = useState(null)
  const [forecast, setForecast] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      api.getPreferences(),
      api.getShockSuggestion().catch(() => null),
      api.getForecast().catch(() => []),
    ]).then(([prefs, shock, fc]) => {
      setPreferences(sortByOrder(prefs))
      if (shock) setShockSuggestion(shock)
      setForecast(fc)
    }).catch((err) => setError(err.message))
  }, [])

  function todayRecs() {
    const today = new Date().toISOString().slice(0, 10)
    const recs = {}
    for (const day of forecast) {
      if (day.date === today) {
        for (const s of day.sets) {
          if (!recs[s.exercise_id] && s.weight_recommended) {
            recs[s.exercise_id] = s.weight_recommended
          }
        }
      }
    }
    return recs
  }

  async function startSession() {
    setLoading(true)
    setError(null)
    try {
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
      const body = {
        session_datetime: now,
        session_type: sessionType,
        readiness_score: wellness.readiness_score || null,
        stress_level: wellness.stress_level || null,
        sleep_hours: wellness.sleep_hours ? parseFloat(wellness.sleep_hours) : null,
        sleep_quality: wellness.sleep_quality || null,
        notes: notes.trim() || null,
      }
      const s = await api.createSession(body)
      setSession(s)
      setLoggedSets([])
      setPhase(PHASES.active)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogSet(exerciseId, setNumber, weight, reps, rpe, painFlag, failedReps) {
    try {
      const set = await api.logSet(session.id, {
        exercise_id: exerciseId,
        set_number: setNumber,
        weight_used: weight,
        reps_completed: reps,
        rpe: rpe || null,
        pain_flag: painFlag || false,
        failed_reps: failedReps || 0,
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
      if (sessionType === 'shock') {
        const shockRes = await api.completeShockScreen(session.id)
        setShockResult(shockRes)
        setPhase(PHASES.shock)
      } else {
        setResults({ ...res, sessionId: session.id })
        setPhase(PHASES.done)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setPhase(PHASES.idle)
    setSession(null)
    setResults(null)
    setShockResult(null)
    setSessionType('normal')
    setWellness({ readiness_score: null, stress_level: null, sleep_hours: '', sleep_quality: null })
    setNotes('')
    setLoggedSets([])
    api.getShockSuggestion().then(setShockSuggestion).catch(() => null)
    api.getForecast().then(setForecast).catch(() => null)
  }

  if (phase === PHASES.shock && shockResult) {
    return <ShockResults result={shockResult} loggedSets={loggedSets} onDone={reset} />
  }

  if (phase === PHASES.done) {
    return <SessionResults results={results} preferences={preferences} onDone={reset} />
  }

  if (phase === PHASES.active) {
    const recs = todayRecs()
    return (
      <div>
        <div style={styles.sessionHeader}>
          <span style={styles.heading}>
            {sessionType === 'shock' ? 'Go Nuts' : `Session #${session.sequence_number}`}
          </span>
          <button onClick={finishSession} disabled={loading} style={styles.finishBtn}>
            {loading ? '...' : 'Finish'}
          </button>
        </div>
        {error && <p style={styles.error}>{error}</p>}
        {sessionType === 'shock' && (
          <p style={styles.shockHint}>Log whatever feels right. No targets — just go.</p>
        )}
        {preferences.map((pref) => (
          <ExerciseLogger
            key={pref.exercise_id}
            pref={pref}
            sessionId={session.id}
            recommendedWeight={recs[pref.exercise_id] ?? null}
            loggedSets={loggedSets.filter((s) => s.exercise_id === pref.exercise_id)}
            onLogSet={handleLogSet}
          />
        ))}
      </div>
    )
  }

  return (
    <div>
      <h2 style={styles.heading}>Ready to train?</h2>

      {shockSuggestion?.suggested && (
        <div style={styles.suggestionBanner}>
          <strong>Go Nuts?</strong>
          {shockSuggestion.reasons.map((r, i) => <p key={i} style={styles.suggestionReason}>{r}</p>)}
        </div>
      )}

      <div style={styles.sessionTypeRow}>
        <button
          onClick={() => setSessionType('normal')}
          style={{ ...styles.typeBtn, ...(sessionType === 'normal' ? styles.typeBtnActive : {}) }}
        >
          Normal
        </button>
        <button
          onClick={() => setSessionType('shock')}
          style={{ ...styles.typeBtn, ...(sessionType === 'shock' ? styles.typeBtnActive : {}) }}
        >
          Go Nuts
        </button>
      </div>

      <WellnessInputs wellness={wellness} onChange={setWellness} />

      <textarea
        placeholder="Session notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        style={styles.notesInput}
      />

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

function WellnessInputs({ wellness, onChange }) {
  const [open, setOpen] = useState(false)

  function set(key, val) {
    onChange((prev) => ({ ...prev, [key]: prev[key] === val ? null : val }))
  }

  return (
    <div style={styles.wellnessBlock}>
      <button style={styles.wellnessToggle} onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} Wellness (optional)
      </button>
      {open && (
        <div style={styles.wellnessBody}>
          <WellnessRow
            label="Readiness"
            options={[['Ready', 1], ['Half in it', 2], ['Not feeling it', 3]]}
            value={wellness.readiness_score}
            onSelect={(v) => set('readiness_score', v)}
          />
          <WellnessRow
            label="Stress"
            options={[['Low', 1], ['Moderate', 2], ['High', 3]]}
            value={wellness.stress_level}
            onSelect={(v) => set('stress_level', v)}
          />
          <div style={styles.wellnessRowWrap}>
            <span style={styles.wellnessLabel}>Sleep hours</span>
            <input
              type="number"
              min={0}
              max={24}
              step={0.5}
              placeholder="hrs"
              value={wellness.sleep_hours}
              onChange={(e) => onChange((prev) => ({ ...prev, sleep_hours: e.target.value }))}
              style={{ ...styles.setInput, width: 56 }}
            />
          </div>
          <WellnessRow
            label="Sleep quality"
            options={[['Good', 1], ['OK', 2], ['Poor', 3]]}
            value={wellness.sleep_quality}
            onSelect={(v) => set('sleep_quality', v)}
          />
        </div>
      )}
    </div>
  )
}

function WellnessRow({ label, options, value, onSelect }) {
  return (
    <div style={styles.wellnessRowWrap}>
      <span style={styles.wellnessLabel}>{label}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {options.map(([text, val]) => (
          <button
            key={val}
            onClick={() => onSelect(val)}
            style={{ ...styles.wellnessBtn, ...(value === val ? styles.wellnessBtnActive : {}) }}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}

function ExerciseLogger({ pref, sessionId, recommendedWeight, loggedSets, onLogSet }) {
  const total = pref.target_sets_per_session
  const nextSetNumber = loggedSets.length + 1

  const [weight, setWeight] = useState(recommendedWeight != null ? String(recommendedWeight) : '')
  const [reps, setReps] = useState('')
  const [rpe, setRpe] = useState('')
  const [painFlag, setPainFlag] = useState(false)
  const [failedReps, setFailedReps] = useState('')
  const [extraSets, setExtraSets] = useState(false)
  const [saving, setSaving] = useState(false)

  const done = loggedSets.length >= total && !extraSets

  async function log() {
    if (!weight || !reps) return
    setSaving(true)
    const set = await onLogSet(
      pref.exercise_id,
      nextSetNumber,
      parseFloat(weight),
      parseInt(reps),
      rpe ? parseFloat(rpe) : null,
      painFlag,
      failedReps ? parseInt(failedReps) : 0,
    )
    if (set) {
      setWeight(String(parseFloat(weight)))
      setReps('')
      setRpe('')
      setPainFlag(false)
      setFailedReps('')
    }
    setSaving(false)
  }

  return (
    <div style={styles.exerciseBlock}>
      <div style={styles.exHeader}>
        <span style={styles.exName}>{pref.exercise_name}</span>
        <span style={styles.setCount}>{loggedSets.length}/{total} sets</span>
      </div>
      <div style={styles.repTarget}>
        Target: {pref.target_rep_min}–{pref.target_rep_max} reps
        {recommendedWeight != null && (
          <span style={styles.recWeight}> · {recommendedWeight} lbs recommended</span>
        )}
      </div>

      {loggedSets.map((s, i) => (
        <div key={s.id} style={styles.loggedSet}>
          Set {i + 1}: {s.weight_used} lbs × {s.reps_completed}
          {s.rpe != null ? ` @ RPE ${s.rpe}` : ''}
          {s.pain_flag ? ' ⚠ pain' : ''}
          {s.failed_reps > 0 ? ` (${s.failed_reps} failed)` : ''}
        </div>
      ))}

      {!done && (
        <>
          <div style={styles.inputRow}>
            <input style={styles.setInput} type="number" placeholder="lbs" value={weight}
              onChange={(e) => setWeight(e.target.value)} />
            <input style={styles.setInput} type="number" placeholder="reps" value={reps}
              onChange={(e) => setReps(e.target.value)} />
            <input style={{ ...styles.setInput, width: 52 }} type="number" placeholder="RPE"
              min={1} max={10} step={0.5} value={rpe} onChange={(e) => setRpe(e.target.value)} />
            <button onClick={log} disabled={saving || !weight || !reps} style={styles.logBtn}>
              {saving ? '...' : `Set ${nextSetNumber}`}
            </button>
          </div>
          <div style={styles.extrasRow}>
            <label style={styles.checkLabel}>
              <input type="checkbox" checked={painFlag} onChange={(e) => setPainFlag(e.target.checked)} />
              <span>Pain</span>
            </label>
            <label style={styles.checkLabel}>
              <span>Failed reps</span>
              <input style={{ ...styles.setInput, width: 40 }} type="number" min={0} value={failedReps}
                onChange={(e) => setFailedReps(e.target.value)} />
            </label>
          </div>
        </>
      )}

      {loggedSets.length >= total && !extraSets && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <p style={styles.doneTag}>✓ done</p>
          <button onClick={() => setExtraSets(true)} style={styles.addSetBtn}>+ extra set</button>
        </div>
      )}
    </div>
  )
}

function SessionResults({ results, preferences, onDone }) {
  const [deloadState, setDeloadState] = useState(null)
  const exerciseMap = Object.fromEntries(preferences.map((p) => [p.exercise_id, p.exercise_name]))
  const anyDeload = results?.algorithm_results &&
    Object.values(results.algorithm_results).some((r) => r.deload_recommended)

  async function handleGenerateDeload() {
    setDeloadState('loading')
    try {
      await api.generateDeload(results.sessionId)
      setDeloadState('done')
    } catch (err) {
      setDeloadState('error:' + err.message)
    }
  }

  return (
    <div>
      <h2 style={styles.heading}>Session complete</h2>
      {results?.algorithm_results && Object.entries(results.algorithm_results).map(([exId, r]) => {
        if (r.skipped) return null
        return (
          <div key={exId} style={styles.resultBlock}>
            <div style={styles.resultExName}>{exerciseMap[exId] || `Exercise ${exId}`}</div>
            {r.next_weight_recommended && (
              <div style={styles.resultLine}>
                Next session: <strong>{r.next_weight_recommended} lbs</strong>
              </div>
            )}
            {r.estimated_1rm && (
              <div style={styles.resultLine}>
                Est. 1RM: {r.estimated_1rm} lbs
                {r.estimated_1rm_pr && <span style={styles.prTag}> NEW PR</span>}
              </div>
            )}
            {r.personal_records?.length > 0 && r.personal_records.map((pr, i) => (
              <div key={i} style={{ ...styles.resultLine, color: '#9ae89a' }}>
                New {pr.reps}-rep PR: {pr.weight} lbs
              </div>
            ))}
            {r.deload_recommended && (
              <div style={{ ...styles.resultLine, color: '#ffaa55' }}>
                ⚠ Deload recommended
              </div>
            )}
            {r.failure_detected && !r.bad_session && !r.deload_recommended && (
              <div style={{ ...styles.resultLine, color: '#ff9999' }}>
                Weight reset applied
              </div>
            )}
            {r.bad_session && (
              <div style={{ ...styles.resultLine, color: '#aaa' }}>
                Tough session — weight held steady
              </div>
            )}
            {r.recovery_hours && (
              <div style={{ ...styles.resultLine, color: '#888' }}>
                Recovery: ~{r.recovery_hours}h
              </div>
            )}
          </div>
        )
      })}

      {anyDeload && (
        <div style={styles.deloadBlock}>
          {deloadState === 'done' ? (
            <p style={styles.deloadSuccess}>Deload plan added to your forecast</p>
          ) : deloadState?.startsWith('error:') ? (
            <p style={styles.error}>{deloadState.slice(6)}</p>
          ) : (
            <button
              onClick={handleGenerateDeload}
              disabled={deloadState === 'loading'}
              style={styles.deloadBtn}
            >
              {deloadState === 'loading' ? 'Generating...' : 'Generate deload plan'}
            </button>
          )}
        </div>
      )}

      <button onClick={onDone} style={styles.primaryBtn}>Done</button>
    </div>
  )
}

function ShockResults({ result, loggedSets, onDone }) {
  return (
    <div>
      {result.show_quote && (
        <div style={styles.quoteBlock}>
          <p style={styles.quoteText}>"{result.quote}"</p>
          <p style={styles.quoteAttrib}>— {result.quote_attribution}</p>
        </div>
      )}
      <h2 style={styles.heading}>Shock session complete</h2>
      <div style={styles.resultBlock}>
        <div style={styles.resultLine}>Sets logged: <strong>{result.summary.sets_completed}</strong></div>
        <div style={styles.resultLine}>Total volume: <strong>{result.summary.total_volume?.toLocaleString()} lbs</strong></div>
        {result.summary.duration_minutes && (
          <div style={styles.resultLine}>Duration: <strong>{result.summary.duration_minutes} min</strong></div>
        )}
      </div>
      {result.recovery && Object.keys(result.recovery).length > 0 && (
        <div style={styles.resultBlock}>
          <div style={styles.resultExName}>Recovery estimate</div>
          {Object.entries(result.recovery).map(([muscle, hours]) => (
            <div key={muscle} style={styles.resultLine}>{muscle}: ~{hours}h</div>
          ))}
        </div>
      )}
      <button onClick={onDone} style={styles.primaryBtn}>Done</button>
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
  sessionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  finishBtn: {
    background: '#3a6b3a', border: 'none', borderRadius: 6, color: '#e8e8e8',
    cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: '6px 14px',
  },
  shockHint: { color: '#888', fontSize: 13, marginBottom: 12, fontStyle: 'italic' },
  sessionTypeRow: { display: 'flex', gap: 8, marginBottom: 16 },
  typeBtn: {
    flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6,
    color: '#888', cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: '8px',
  },
  typeBtnActive: { background: '#2a3a2a', border: '1px solid #4a7a4a', color: '#e8e8e8' },
  wellnessBlock: { marginBottom: 16 },
  wellnessToggle: {
    background: 'none', border: 'none', color: '#888', cursor: 'pointer',
    fontSize: 13, padding: 0, marginBottom: 8,
  },
  wellnessBody: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: 12 },
  wellnessRowWrap: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  wellnessLabel: { color: '#888', fontSize: 13, minWidth: 90 },
  wellnessBtn: {
    background: 'none', border: '1px solid #2a2a2a', borderRadius: 4,
    color: '#888', cursor: 'pointer', fontSize: 12, padding: '3px 8px',
  },
  wellnessBtnActive: { background: '#2a2a2a', color: '#e8e8e8', borderColor: '#4a4a4a' },
  notesInput: {
    background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6,
    color: '#e8e8e8', fontSize: 13, padding: '8px 10px', width: '100%',
    boxSizing: 'border-box', resize: 'vertical', minHeight: 60,
    marginBottom: 12,
  },
  suggestionBanner: {
    background: '#1a2a1a', border: '1px solid #3a5a3a', borderRadius: 8,
    padding: 12, marginBottom: 16,
  },
  suggestionReason: { color: '#aaa', fontSize: 13, margin: '4px 0 0' },
  exerciseBlock: {
    background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8,
    padding: 12, marginBottom: 12,
  },
  exHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  exName: { fontWeight: 600 },
  setCount: { color: '#888', fontSize: 13 },
  repTarget: { color: '#666', fontSize: 12, marginBottom: 8 },
  recWeight: { color: '#5a9a5a' },
  loggedSet: {
    color: '#aaa', fontSize: 13, padding: '3px 0',
    borderBottom: '1px solid #2a2a2a', marginBottom: 4,
  },
  inputRow: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' },
  extrasRow: { display: 'flex', gap: 16, alignItems: 'center', marginTop: 6 },
  setInput: {
    background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 4,
    color: '#e8e8e8', fontSize: 14, padding: '5px 8px', width: 64,
  },
  logBtn: {
    background: '#2a4a2a', border: 'none', borderRadius: 4,
    color: '#e8e8e8', cursor: 'pointer', fontSize: 13, padding: '5px 10px', whiteSpace: 'nowrap',
  },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#888', cursor: 'pointer' },
  doneTag: { color: '#5a9a5a', fontSize: 13, margin: 0 },
  addSetBtn: {
    background: 'none', border: '1px solid #2a2a2a', borderRadius: 4,
    color: '#888', cursor: 'pointer', fontSize: 12, padding: '2px 8px',
  },
  resultBlock: {
    background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8,
    padding: 12, marginBottom: 10,
  },
  resultExName: { fontWeight: 600, marginBottom: 6 },
  resultLine: { color: '#aaa', fontSize: 14, margin: '3px 0' },
  prTag: { color: '#9ae89a', fontWeight: 700, fontSize: 12 },
  quoteBlock: {
    background: '#1a1a2a', border: '1px solid #3a3a6a', borderRadius: 8,
    padding: 16, marginBottom: 16,
  },
  quoteText: { color: '#e8e8e8', fontSize: 15, fontStyle: 'italic', lineHeight: 1.6, margin: '0 0 8px' },
  quoteAttrib: { color: '#888', fontSize: 13, margin: 0, textAlign: 'right' },
  deloadBlock: { marginBottom: 12 },
  deloadBtn: {
    background: '#2a1f00', border: '1px solid #7a5500', borderRadius: 6,
    color: '#ffaa55', cursor: 'pointer', fontSize: 14, fontWeight: 600,
    padding: '10px 20px', width: '100%',
  },
  deloadSuccess: { color: '#ffaa55', fontSize: 14, textAlign: 'center', margin: '8px 0' },
}
