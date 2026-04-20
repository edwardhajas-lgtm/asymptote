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
  if (loading) return <p style={styles.muted}>Loading...</p>
  if (!metrics) return null

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
        <span style={styles.detailVal}>{metrics['1rm_tracking_enabled'] ? 'Enabled' : 'Disabled'}</span>
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
}
