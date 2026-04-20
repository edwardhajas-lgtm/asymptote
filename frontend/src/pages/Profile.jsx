import { useState, useEffect } from 'react'
import { api } from '../api.js'

export default function Profile() {
  const [user, setUser] = useState(null)
  const [settings, setSettings] = useState([])
  const [cycleLog, setCycleLog] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [section, setSection] = useState('profile')

  useEffect(() => {
    Promise.all([api.getMe(), api.getSettings()])
      .then(([u, s]) => { setUser(u); setSettings(s) })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (user?.menstrual_tracking_enabled) {
      api.getMenstrualCycle().then(setCycleLog).catch(() => null)
    }
  }, [user?.menstrual_tracking_enabled])

  if (loading) return <p style={styles.muted}>Loading...</p>
  if (error) return <p style={styles.error}>{error}</p>

  const tabs = ['profile', 'settings', ...(user?.menstrual_tracking_enabled ? ['cycle'] : [])]

  return (
    <div>
      <h2 style={styles.heading}>Profile</h2>
      <div style={styles.tabs}>
        {tabs.map((t) => (
          <button
            key={t}
            style={{ ...styles.tab, ...(section === t ? styles.tabActive : {}) }}
            onClick={() => setSection(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {section === 'profile' && (
        <ProfileForm user={user} onSave={(updated) => setUser(updated)} />
      )}
      {section === 'settings' && (
        <AlgorithmSettings settings={settings} onSave={setSettings} />
      )}
      {section === 'cycle' && (
        <MenstrualSection log={cycleLog} onLog={(entry) => setCycleLog((prev) => [entry, ...prev])} />
      )}
    </div>
  )
}

function ProfileForm({ user, onSave }) {
  const [form, setForm] = useState({
    bodyweight: user.bodyweight ?? '',
    date_of_birth: user.date_of_birth ?? '',
    sex: user.sex ?? '',
    training_goal: user.training_goal ?? '',
    tracking_preset: user.tracking_preset ?? '',
    is_public: user.is_public ?? false,
    menstrual_tracking_enabled: user.menstrual_tracking_enabled ?? false,
    data_research_consent: user.data_research_consent ?? false,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  function set(key, val) {
    setForm((prev) => ({ ...prev, [key]: val }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const body = {
        ...form,
        bodyweight: form.bodyweight ? parseFloat(form.bodyweight) : null,
        date_of_birth: form.date_of_birth || null,
        sex: form.sex || null,
        training_goal: form.training_goal || null,
        tracking_preset: form.tracking_preset || null,
      }
      const updated = await api.updateMe(body)
      onSave(updated)
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Field label="Bodyweight (lbs)">
        <input style={styles.input} type="number" value={form.bodyweight}
          onChange={(e) => set('bodyweight', e.target.value)} />
      </Field>
      <Field label="Date of birth">
        <input style={styles.input} type="date" value={form.date_of_birth}
          onChange={(e) => set('date_of_birth', e.target.value)} />
      </Field>
      <Field label="Sex">
        <select style={styles.input} value={form.sex} onChange={(e) => set('sex', e.target.value)}>
          <option value="">—</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="Training goal">
        <select style={styles.input} value={form.training_goal} onChange={(e) => set('training_goal', e.target.value)}>
          <option value="">—</option>
          <option value="strength">Strength</option>
          <option value="fitness">Fitness</option>
          <option value="movement">Movement</option>
        </select>
      </Field>
      <Field label="Tracking preset">
        <select style={styles.input} value={form.tracking_preset} onChange={(e) => set('tracking_preset', e.target.value)}>
          <option value="">—</option>
          <option value="simple">Simple (weight + reps only)</option>
          <option value="full">Full (RPE + wellness)</option>
          <option value="custom">Custom</option>
        </select>
      </Field>
      <Field label="Menstrual tracking">
        <Toggle
          value={form.menstrual_tracking_enabled}
          onChange={(v) => set('menstrual_tracking_enabled', v)}
        />
      </Field>
      <Field label="Data research consent">
        <Toggle
          value={form.data_research_consent}
          onChange={(v) => set('data_research_consent', v)}
        />
      </Field>
      <Field label="Public profile">
        <Toggle value={form.is_public} onChange={(v) => set('is_public', v)} />
      </Field>

      {error && <p style={styles.error}>{error}</p>}
      <button onClick={save} disabled={saving} style={styles.saveBtn}>
        {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
      </button>
    </div>
  )
}

function AlgorithmSettings({ settings, onSave }) {
  const [values, setValues] = useState(
    Object.fromEntries(settings.map((s) => [s.name, s.value]))
  )
  const [saving, setSaving] = useState(null)
  const [errors, setErrors] = useState({})

  const labels = {
    deload_lookback_weeks: { label: 'Deload lookback (weeks)', min: 1, max: 52, step: 1 },
    deload_volume_reduction: { label: 'Deload volume reduction', min: 0, max: 1, step: 0.05 },
    deload_intensity_reduction: { label: 'Deload intensity reduction', min: 0, max: 1, step: 0.05 },
    reset_percentage: { label: 'Reset percentage', min: 0, max: 1, step: 0.05 },
  }

  async function save(name) {
    setSaving(name)
    setErrors((prev) => ({ ...prev, [name]: null }))
    try {
      const updated = await api.updateSetting(name, parseFloat(values[name]))
      onSave((prev) => prev.map((s) => s.name === name ? { ...s, value: updated.value, is_custom: true } : s))
    } catch (err) {
      setErrors((prev) => ({ ...prev, [name]: err.message }))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div>
      {settings.map((s) => {
        const meta = labels[s.name]
        if (!meta) return null
        return (
          <div key={s.name} style={styles.settingRow}>
            <div style={styles.settingLabel}>
              {meta.label}
              {s.is_custom && <span style={styles.customTag}>custom</span>}
              <span style={styles.defaultHint}>(default: {s.default})</span>
            </div>
            <div style={styles.settingInputRow}>
              <input
                style={{ ...styles.input, width: 80 }}
                type="number"
                min={meta.min}
                max={meta.max}
                step={meta.step}
                value={values[s.name]}
                onChange={(e) => setValues((prev) => ({ ...prev, [s.name]: e.target.value }))}
              />
              <button
                onClick={() => save(s.name)}
                disabled={saving === s.name}
                style={styles.smallBtn}
              >
                {saving === s.name ? '...' : 'Save'}
              </button>
            </div>
            {errors[s.name] && <p style={styles.error}>{errors[s.name]}</p>}
          </div>
        )
      })}
    </div>
  )
}

function MenstrualSection({ log, onLog }) {
  const [form, setForm] = useState({ cycle_start_date: '', cycle_length_days: '', phase: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const entry = await api.logMenstrualCycle({
        cycle_start_date: form.cycle_start_date,
        cycle_length_days: form.cycle_length_days ? parseInt(form.cycle_length_days) : null,
        phase: form.phase || null,
        notes: form.notes || null,
      })
      onLog(entry)
      setForm({ cycle_start_date: '', cycle_length_days: '', phase: '', notes: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <form onSubmit={submit} style={styles.cycleForm}>
        <Field label="Cycle start date">
          <input style={styles.input} type="date" value={form.cycle_start_date} required
            onChange={(e) => setForm((p) => ({ ...p, cycle_start_date: e.target.value }))} />
        </Field>
        <Field label="Cycle length (days)">
          <input style={styles.input} type="number" min={1} max={60} value={form.cycle_length_days}
            onChange={(e) => setForm((p) => ({ ...p, cycle_length_days: e.target.value }))} />
        </Field>
        <Field label="Phase">
          <select style={styles.input} value={form.phase}
            onChange={(e) => setForm((p) => ({ ...p, phase: e.target.value }))}>
            <option value="">—</option>
            <option value="menstruation">Menstruation</option>
            <option value="follicular">Follicular</option>
            <option value="ovulation">Ovulation</option>
            <option value="luteal">Luteal</option>
          </select>
        </Field>
        <Field label="Notes">
          <input style={styles.input} type="text" value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
        </Field>
        {error && <p style={styles.error}>{error}</p>}
        <button type="submit" disabled={saving} style={styles.saveBtn}>
          {saving ? 'Logging...' : 'Log cycle'}
        </button>
      </form>

      {log.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <p style={styles.sectionLabel}>Recent entries</p>
          {log.slice(0, 10).map((entry) => (
            <div key={entry.id} style={styles.cycleEntry}>
              <span style={styles.cycleDate}>{entry.cycle_start_date}</span>
              {entry.phase && <span style={styles.cyclePhase}>{entry.phase}</span>}
              {entry.cycle_length_days && <span style={styles.cycleMeta}>{entry.cycle_length_days}d</span>}
              {entry.notes && <span style={styles.cycleNotes}>{entry.notes}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={styles.fieldRow}>
      <label style={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  )
}

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{ ...styles.toggleBtn, ...(value ? styles.toggleOn : {}) }}
    >
      {value ? 'On' : 'Off'}
    </button>
  )
}

const styles = {
  heading: { fontSize: 20, fontWeight: 700, marginBottom: 16 },
  muted: { color: '#888', fontSize: 14 },
  error: { color: '#ff6b6b', fontSize: 13, margin: '4px 0' },
  tabs: { display: 'flex', gap: 6, marginBottom: 20 },
  tab: {
    background: 'none', border: '1px solid #2a2a2a', borderRadius: 6,
    color: '#888', cursor: 'pointer', fontSize: 13, padding: '5px 12px',
  },
  tabActive: { background: '#2a2a2a', color: '#e8e8e8' },
  fieldRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' },
  fieldLabel: { color: '#888', fontSize: 13, minWidth: 160 },
  input: {
    background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6,
    color: '#e8e8e8', fontSize: 14, padding: '6px 10px', flex: 1, minWidth: 120,
  },
  saveBtn: {
    marginTop: 8, background: '#e8e8e8', border: 'none', borderRadius: 6,
    color: '#0f0f0f', cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: '8px 20px',
  },
  toggleBtn: {
    background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 4,
    color: '#888', cursor: 'pointer', fontSize: 13, padding: '4px 12px',
  },
  toggleOn: { background: '#1a2a1a', border: '1px solid #3a5a3a', color: '#5a9a5a' },
  settingRow: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: 12, marginBottom: 8 },
  settingLabel: { color: '#aaa', fontSize: 13, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  settingInputRow: { display: 'flex', gap: 8, alignItems: 'center' },
  customTag: { background: '#2a2a1a', border: '1px solid #4a4a2a', borderRadius: 3, color: '#aaa', fontSize: 10, padding: '1px 5px' },
  defaultHint: { color: '#555', fontSize: 11 },
  smallBtn: {
    background: '#2a2a2a', border: 'none', borderRadius: 4,
    color: '#e8e8e8', cursor: 'pointer', fontSize: 12, padding: '4px 10px',
  },
  sectionLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#888', marginBottom: 8 },
  cycleForm: {},
  cycleEntry: {
    display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
    padding: '6px 0', borderBottom: '1px solid #1a1a1a',
  },
  cycleDate: { color: '#e8e8e8', fontSize: 13, fontWeight: 500 },
  cyclePhase: { background: '#1a1a2a', border: '1px solid #2a2a3a', borderRadius: 3, color: '#aaa', fontSize: 11, padding: '1px 6px' },
  cycleMeta: { color: '#666', fontSize: 12 },
  cycleNotes: { color: '#888', fontSize: 12, fontStyle: 'italic' },
}
