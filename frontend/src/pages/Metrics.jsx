import { useState, useEffect } from 'react'
import { api } from '../api.js'

export default function Metrics() {
  const [prs, setPrs] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [exercises, setExercises] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      api.getPRs(),
      api.getPreferences(),
      api.get1rmSuggestion().catch(() => ({ suggestions: [] })),
    ]).then(([prData, prefs, sug]) => {
      setPrs(prData)
      setExercises(prefs)
      setSuggestions(sug.suggestions || [])
    }).catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedId) return
    setMetricsLoading(true)
    api.getMetrics(selectedId)
      .then(setMetrics)
      .catch(() => setMetrics(null))
      .finally(() => setMetricsLoading(false))
  }, [selectedId])

  if (loading) return <p style={styles.muted}>Loading...</p>
  if (error) return <p style={styles.error}>{error}</p>

  return (
    <div>
      <h2 style={styles.heading}>Metrics</h2>

      {suggestions.length > 0 && (
        <div style={styles.suggestionBanner}>
          <strong>1RM attempt conditions met</strong>
          {suggestions.map((s, i) => (
            <div key={i} style={styles.suggestionItem}>
              <div style={styles.suggestionEx}>{s.exercise_name}</div>
              {s.reasons.map((r, j) => <div key={j} style={styles.suggestionReason}>{r}</div>)}
            </div>
          ))}
        </div>
      )}

      {prs.length === 0 ? (
        <p style={styles.muted}>No records yet. Complete some sessions first.</p>
      ) : (
        <>
          <p style={styles.sectionLabel}>Personal records</p>
          {prs.map((ex) => (
            <div key={ex.exercise_id} style={styles.prBlock}>
              <div
                style={{ ...styles.prHeader, cursor: exercises.find(e => e.exercise_id === ex.exercise_id) ? 'pointer' : 'default' }}
                onClick={() => setSelectedId(selectedId === ex.exercise_id ? null : ex.exercise_id)}
              >
                <span style={styles.prName}>{ex.exercise_name}</span>
                <span style={styles.chevron}>{selectedId === ex.exercise_id ? '▾' : '▸'}</span>
              </div>
              <div style={styles.prRow}>
                {ex.measured_1rm_pr && (
                  <div style={styles.prPill}>
                    <span style={styles.prPillLabel}>Measured 1RM</span>
                    <span style={styles.prPillVal}>{ex.measured_1rm_pr} lbs</span>
                  </div>
                )}
                {ex.estimated_1rm_pr && (
                  <div style={styles.prPill}>
                    <span style={styles.prPillLabel}>Est. 1RM</span>
                    <span style={styles.prPillVal}>{ex.estimated_1rm_pr} lbs</span>
                  </div>
                )}
                {ex.rep_records.map((r) => (
                  <div key={r.reps} style={styles.prPill}>
                    <span style={styles.prPillLabel}>{r.reps}RM</span>
                    <span style={styles.prPillVal}>{r.weight} lbs</span>
                  </div>
                ))}
              </div>

              {selectedId === ex.exercise_id && (
                <ExerciseMetricsDetail
                  exerciseId={ex.exercise_id}
                  metrics={metrics}
                  loading={metricsLoading}
                />
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function ExerciseMetricsDetail({ exerciseId, metrics, loading }) {
  const [showForm, setShowForm] = useState(false)
  const [weight, setWeight] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formResult, setFormResult] = useState(null)
  const [tracking, setTracking] = useState(null)
  const [trackingBusy, setTrackingBusy] = useState(false)

  useEffect(() => {
    if (metrics) setTracking(metrics['1rm_tracking_enabled'])
  }, [metrics])

  if (loading) return <p style={styles.muted}>Loading...</p>
  if (!metrics) return null

  async function handleToggleTracking() {
    setTrackingBusy(true)
    try {
      const res = await api.toggle1rmTracking(exerciseId, !tracking)
      setTracking(res.enabled)
    } catch (err) {
      alert(err.message)
    } finally {
      setTrackingBusy(false)
    }
  }

  async function handleLog(e) {
    e.preventDefault()
    const w = parseFloat(weight)
    if (!w || w <= 0) return
    setSubmitting(true)
    setFormResult(null)
    try {
      const now = new Date().toISOString()
      const session = await api.createSession({ session_datetime: now, session_type: '1rm_test' })
      await api.logMeasured1rm(session.id, exerciseId, w)
      await api.completeSession(session.id)
      setFormResult({ ok: true, weight: w })
      setShowForm(false)
      setWeight('')
    } catch (err) {
      setFormResult({ ok: false, msg: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  const labels = {
    estimated_1rm: 'Est. 1RM',
    weighted_rpe: 'Weighted RPE',
    tonnage: 'Tonnage',
    recovery_hours: 'Recovery (hrs)',
  }

  return (
    <div style={styles.detailBlock}>
      <div style={styles.detailRow}>
        <span style={styles.detailLabel}>1RM tracking</span>
        <button
          onClick={handleToggleTracking}
          disabled={trackingBusy}
          style={{ ...styles.trackingBtn, ...(tracking ? styles.trackingBtnOn : styles.trackingBtnOff) }}
        >
          {trackingBusy ? '...' : tracking ? 'Enabled' : 'Disabled'}
        </button>
      </div>
      {Object.entries(metrics.latest || {}).map(([key, val]) => (
        <div key={key} style={styles.detailRow}>
          <span style={styles.detailLabel}>{labels[key] || key}</span>
          <span style={styles.detailVal}>{typeof val === 'number' ? Math.round(val * 100) / 100 : val}</span>
        </div>
      ))}
      {Object.entries(metrics.history || {}).map(([key, entries]) => (
        <div key={key} style={styles.historySection}>
          <div style={styles.historyLabel}>{labels[key] || key} history</div>
          {entries.slice(0, 5).map((e, i) => (
            <div key={i} style={styles.historyRow}>
              <span style={styles.historyDate}>{e.calculated_at?.slice(0, 10)}</span>
              <span style={styles.historyVal}>{Math.round(e.value * 100) / 100}</span>
            </div>
          ))}
        </div>
      ))}

      {tracking && (
        <div style={styles.oneRmSection}>
          {formResult?.ok && (
            <p style={styles.formSuccess}>Logged {formResult.weight} lbs as measured 1RM</p>
          )}
          {formResult && !formResult.ok && (
            <p style={styles.formError}>{formResult.msg}</p>
          )}
          {!showForm ? (
            <button style={styles.logBtn} onClick={() => { setShowForm(true); setFormResult(null) }}>
              Log measured 1RM
            </button>
          ) : (
            <form onSubmit={handleLog} style={styles.form}>
              <input
                type="number"
                step="0.5"
                min="1"
                placeholder="Weight (lbs)"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                style={styles.input}
                autoFocus
              />
              <button type="submit" disabled={submitting} style={styles.submitBtn}>
                {submitting ? 'Saving...' : 'Save'}
              </button>
              <button type="button" style={styles.cancelBtn} onClick={() => { setShowForm(false); setWeight('') }}>
                Cancel
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

const styles = {
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 16 },
  muted: { color: '#888', fontSize: 14 },
  error: { color: '#ff6b6b', fontSize: 14 },
  sectionLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#888', marginBottom: 8 },
  suggestionBanner: {
    background: '#1a2a1a', border: '1px solid #3a5a3a', borderRadius: 8, padding: 12, marginBottom: 16,
  },
  suggestionItem: { marginTop: 8 },
  suggestionEx: { fontWeight: 600, fontSize: 14, marginBottom: 4 },
  suggestionReason: { color: '#aaa', fontSize: 13 },
  prBlock: {
    background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: 12, marginBottom: 8,
  },
  prHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  prName: { fontWeight: 600 },
  chevron: { color: '#555', fontSize: 14 },
  prRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  prPill: {
    background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 4,
    padding: '4px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  prPillLabel: { color: '#666', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  prPillVal: { color: '#e8e8e8', fontSize: 14, fontWeight: 600 },
  detailBlock: { marginTop: 12, borderTop: '1px solid #2a2a2a', paddingTop: 10 },
  detailRow: { display: 'flex', justifyContent: 'space-between', padding: '3px 0' },
  detailLabel: { color: '#888', fontSize: 13 },
  detailVal: { color: '#e8e8e8', fontSize: 13 },
  historySection: { marginTop: 10 },
  historyLabel: { color: '#666', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  historyRow: { display: 'flex', justifyContent: 'space-between', padding: '2px 0' },
  historyDate: { color: '#666', fontSize: 12 },
  historyVal: { color: '#aaa', fontSize: 12 },
  trackingBtn: {
    border: '1px solid', borderRadius: 4, cursor: 'pointer',
    fontSize: 12, padding: '2px 8px', fontWeight: 600,
  },
  trackingBtnOn: { background: '#1a2a1a', borderColor: '#3a7a3a', color: '#7cfc00' },
  trackingBtnOff: { background: '#1a1a1a', borderColor: '#3a3a3a', color: '#555' },
  oneRmSection: { marginTop: 14, paddingTop: 10, borderTop: '1px solid #2a2a2a' },
  logBtn: {
    background: 'transparent', border: '1px solid #3a3a3a', borderRadius: 4,
    color: '#aaa', fontSize: 13, padding: '5px 12px', cursor: 'pointer',
  },
  form: { display: 'flex', gap: 6, alignItems: 'center' },
  input: {
    background: '#0f0f0f', border: '1px solid #3a3a3a', borderRadius: 4,
    color: '#e8e8e8', fontSize: 13, padding: '5px 8px', width: 120,
  },
  submitBtn: {
    background: '#2a4a2a', border: '1px solid #3a7a3a', borderRadius: 4,
    color: '#7cfc00', fontSize: 13, padding: '5px 12px', cursor: 'pointer',
  },
  cancelBtn: {
    background: 'transparent', border: '1px solid #3a3a3a', borderRadius: 4,
    color: '#666', fontSize: 13, padding: '5px 12px', cursor: 'pointer',
  },
  formSuccess: { color: '#7cfc00', fontSize: 13, margin: '0 0 8px' },
  formError: { color: '#ff6b6b', fontSize: 13, margin: '0 0 8px' },
}
