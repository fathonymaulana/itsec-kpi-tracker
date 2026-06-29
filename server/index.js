const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const { initDb, getDb } = require('./db')
const { detectAnomalies } = require('./anomaly')

const app = express()
const JWT_SECRET = 'itsec-kpi-tracker-secret-2026'

app.use(cors({ origin: 'http://localhost:3000', credentials: true }))
app.use(express.json())

initDb()

function requireAuth(roles = []) {
  return (req, res, next) => {
    const token = (req.headers.authorization || '').replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'No token' })
    try {
      const decoded = jwt.verify(token, JWT_SECRET)
      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      req.user = decoded
      next()
    } catch {
      return res.status(401).json({ error: 'Invalid token' })
    }
  }
}

// ── AUTH ─────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { dept_id, pin } = req.body || {}
  if (!pin) return res.status(400).json({ error: 'PIN required' })
  const db = getDb()

  // Try dept login first
  if (dept_id && !dept_id.startsWith('__')) {
    const dept = db.prepare('SELECT * FROM departments WHERE id=? AND pin=?').get(dept_id, pin)
    if (dept) {
      const token = jwt.sign({ role: 'dept_head', dept_id: dept.id }, JWT_SECRET, { expiresIn: '8h' })
      return res.json({ token, role: 'dept_head', dept_id: dept.id, dept_name: dept.name })
    }
  }

  // Try role login (corp_planning / board)
  const role = db.prepare('SELECT * FROM roles WHERE pin=?').get(pin)
  if (role) {
    const token = jwt.sign({ role: role.role_key, dept_id: null }, JWT_SECRET, { expiresIn: '8h' })
    return res.json({ token, role: role.role_key, dept_id: null, dept_name: role.display_name })
  }

  return res.status(401).json({ error: 'Incorrect PIN. Please try again.' })
})

// ── DEPARTMENTS ───────────────────────────────────────────────────────────────
app.get('/api/departments', requireAuth(), (req, res) => {
  const db = getDb()
  const departments = db.prepare('SELECT id, name FROM departments ORDER BY name').all()
  res.json({ departments })
})

app.get('/api/departments/:id/kpis', requireAuth(), (req, res) => {
  const { id } = req.params
  if (req.user.role === 'dept_head' && req.user.dept_id !== id) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const db = getDb()
  const rawKpis = db.prepare('SELECT * FROM kpis WHERE dept_id=? ORDER BY id').all(id)
  const kpis = rawKpis.map(kpi => ({
    id: kpi.id,
    dept_id: kpi.dept_id,
    name: kpi.kpi_name,
    target_text: kpi.target_text,
    numeric_target: kpi.numeric_target,
    direction: kpi.direction,
    frequency: kpi.frequency,
    sub_metrics: db.prepare('SELECT id, name, is_calc as is_calculated, formula_key, calc_input_positions, unit, display_order FROM sub_metrics WHERE kpi_id=? ORDER BY display_order').all(kpi.id)
  }))
  res.json({ kpis })
})

// ── ACTUALS ───────────────────────────────────────────────────────────────────
// GET /api/actuals?dept_id=&year=&month= (month optional for full-year fetch)
app.get('/api/actuals', requireAuth(), (req, res) => {
  const { dept_id, year, month } = req.query
  if (!dept_id || !year) return res.status(400).json({ error: 'dept_id and year required' })
  if (req.user.role === 'dept_head' && req.user.dept_id !== dept_id) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const db = getDb()
  let rows
  if (month) {
    rows = db.prepare(`
      SELECT a.id, a.sub_metric_id, a.year, a.month, a.value, a.data_source_url, a.data_source_note,
             sm.kpi_id, sm.name as sm_name, sm.is_calc as is_calculated, sm.formula_key
      FROM actuals a
      JOIN sub_metrics sm ON a.sub_metric_id = sm.id
      JOIN kpis k ON sm.kpi_id = k.id
      WHERE k.dept_id=? AND a.year=? AND a.month=?
    `).all(dept_id, year, month)
  } else {
    rows = db.prepare(`
      SELECT a.id, a.sub_metric_id, a.year, a.month, a.value, a.data_source_url, a.data_source_note,
             sm.kpi_id, sm.name as sm_name, sm.is_calc as is_calculated, sm.formula_key
      FROM actuals a
      JOIN sub_metrics sm ON a.sub_metric_id = sm.id
      JOIN kpis k ON sm.kpi_id = k.id
      WHERE k.dept_id=? AND a.year=?
      ORDER BY a.month, sm.display_order
    `).all(dept_id, year)
  }
  res.json({ actuals: rows })
})

// POST /api/actuals — body: { actuals: [{sub_metric_id, kpi_id, dept_id, year, month, value, data_source_url?, data_source_note?}] }
app.post('/api/actuals', requireAuth(['dept_head', 'corp_planning']), (req, res) => {
  const { actuals } = req.body || {}
  if (!Array.isArray(actuals) || actuals.length === 0) {
    return res.status(400).json({ error: 'actuals array required' })
  }
  const db = getDb()
  const upsert = db.prepare(`
    INSERT INTO actuals (sub_metric_id,year,month,value,data_source_url,data_source_note,submitted_by,last_updated_at)
    VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(sub_metric_id,year,month) DO UPDATE SET
      value=excluded.value,
      data_source_url=COALESCE(excluded.data_source_url, data_source_url),
      data_source_note=COALESCE(excluded.data_source_note, data_source_note),
      submitted_by=excluded.submitted_by,
      last_updated_at=CURRENT_TIMESTAMP
  `)
  const saveAll = db.transaction((rows) => {
    for (const r of rows) {
      upsert.run(r.sub_metric_id, r.year, r.month, r.value ?? null, r.data_source_url || null, r.data_source_note || null, req.user.dept_id || req.user.role)
    }
  })
  try {
    saveAll(actuals)
    const newAnomalies = []
    for (const r of actuals) {
      if (r.value !== null && r.value !== undefined) {
        const detected = detectAnomalies(db, r.sub_metric_id, r.year, r.month)
        if (detected && detected.length) newAnomalies.push(...detected)
      }
    }
    res.json({ success: true, anomalies: newAnomalies })
  } catch (err) {
    console.error('Save actuals error:', err)
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/actuals/:id/datasource
app.patch('/api/actuals/:actual_id/datasource', requireAuth(['dept_head', 'corp_planning']), (req, res) => {
  const { data_source_url, data_source_note } = req.body || {}
  const db = getDb()
  db.prepare('UPDATE actuals SET data_source_url=?,data_source_note=?,last_updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(data_source_url || null, data_source_note || null, req.params.actual_id)
  res.json({ success: true })
})

// ── VERIFICATIONS ─────────────────────────────────────────────────────────────
// GET /api/verifications?dept_id=&year=&month=
app.get('/api/verifications', requireAuth(['corp_planning', 'board']), (req, res) => {
  const { dept_id, year, month } = req.query
  if (!dept_id || !year || !month) return res.status(400).json({ error: 'dept_id, year, month required' })
  const db = getDb()
  const verifications = db.prepare(`
    SELECT v.id, v.kpi_id, v.status, v.note, v.verified_at, k.kpi_name as kpi_name
    FROM verifications v
    JOIN kpis k ON v.kpi_id = k.id
    WHERE v.dept_id=? AND v.year=? AND v.month=?
  `).all(dept_id, year, month)
  res.json({ verifications })
})

// POST /api/verifications — body: { kpi_id, dept_id, year, month, status, note }
app.post('/api/verifications', requireAuth(['corp_planning']), (req, res) => {
  const { kpi_id, dept_id, year, month, status, note } = req.body || {}
  if (!kpi_id || !dept_id || !year || !month || !status) {
    return res.status(400).json({ error: 'kpi_id, dept_id, year, month, status required' })
  }
  const db = getDb()
  db.prepare(`
    INSERT INTO verifications (kpi_id,dept_id,year,month,verified_by,status,note)
    VALUES (?,?,?,?,'corp_planning',?,?)
    ON CONFLICT(kpi_id,dept_id,year,month) DO UPDATE SET status=excluded.status,note=excluded.note,verified_at=CURRENT_TIMESTAMP
  `).run(kpi_id, dept_id, year, month, status, note || null)
  res.json({ success: true })
})

// ── ANOMALIES ─────────────────────────────────────────────────────────────────
// GET /api/anomalies?dept_id=&year=&month=
app.get('/api/anomalies', requireAuth(), (req, res) => {
  const { dept_id, year, month } = req.query
  const db = getDb()
  let rows
  if (dept_id && year && month) {
    rows = db.prepare(`
      SELECT an.id, an.sub_metric_id, an.year, an.month, an.anomaly_type as type, an.description,
             an.detected_at as created_at, an.dismissed, sm.kpi_id, k.kpi_name, k.dept_id
      FROM anomalies an
      JOIN sub_metrics sm ON an.sub_metric_id=sm.id
      JOIN kpis k ON sm.kpi_id=k.id
      WHERE k.dept_id=? AND an.year=? AND an.month=?
      ORDER BY an.detected_at DESC
    `).all(dept_id, year, month)
  } else if (dept_id) {
    rows = db.prepare(`
      SELECT an.id, an.sub_metric_id, an.year, an.month, an.anomaly_type as type, an.description,
             an.detected_at as created_at, an.dismissed, sm.kpi_id, k.kpi_name, k.dept_id
      FROM anomalies an
      JOIN sub_metrics sm ON an.sub_metric_id=sm.id
      JOIN kpis k ON sm.kpi_id=k.id
      WHERE k.dept_id=? AND an.dismissed=0
      ORDER BY an.detected_at DESC
    `).all(dept_id)
  } else {
    rows = db.prepare(`
      SELECT an.id, an.sub_metric_id, an.year, an.month, an.anomaly_type as type, an.description,
             an.detected_at as created_at, an.dismissed, sm.kpi_id, k.kpi_name, k.dept_id, d.name as department_name
      FROM anomalies an
      JOIN sub_metrics sm ON an.sub_metric_id=sm.id
      JOIN kpis k ON sm.kpi_id=k.id
      JOIN departments d ON k.dept_id=d.id
      WHERE an.dismissed=0
      ORDER BY an.detected_at DESC
    `).all()
  }
  res.json({ anomalies: rows })
})

// PATCH /api/anomalies/:id — body: { dismissed: 1 } or { resolved_note: '...' }
app.patch('/api/anomalies/:id', requireAuth(['corp_planning', 'dept_head']), (req, res) => {
  const db = getDb()
  const { dismissed, resolved_note } = req.body || {}
  if (dismissed !== undefined) {
    db.prepare('UPDATE anomalies SET dismissed=? WHERE id=?').run(dismissed ? 1 : 0, req.params.id)
  }
  if (resolved_note !== undefined) {
    db.prepare('UPDATE anomalies SET resolved_note=? WHERE id=?').run(resolved_note, req.params.id)
  }
  res.json({ success: true })
})

// ── SUBMISSIONS ───────────────────────────────────────────────────────────────
// GET /api/submissions?dept_id=&year=&month=
app.get('/api/submissions', requireAuth(), (req, res) => {
  const { dept_id, year, month } = req.query
  const db = getDb()
  let submissions
  if (month) {
    submissions = db.prepare('SELECT * FROM submissions WHERE dept_id=? AND year=? AND month=?').all(dept_id, year, month)
  } else {
    submissions = db.prepare('SELECT * FROM submissions WHERE dept_id=? AND year=?').all(dept_id, year)
  }
  res.json({ submissions })
})

// POST /api/submissions — body: { dept_id, year, month }
app.post('/api/submissions', requireAuth(['dept_head', 'corp_planning']), (req, res) => {
  const { dept_id, year, month } = req.body || {}
  if (req.user.role === 'dept_head' && req.user.dept_id !== dept_id) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const db = getDb()
  try {
    db.prepare('INSERT OR IGNORE INTO submissions (dept_id,year,month) VALUES (?,?,?)').run(dept_id, year, month)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── BOARD SUMMARY ─────────────────────────────────────────────────────────────
// GET /api/board/summary/:year?month=
app.get('/api/board/summary/:year', requireAuth(), (req, res) => {
  const { year } = req.params
  const { month } = req.query
  const db = getDb()
  const depts = db.prepare('SELECT id, name FROM departments ORDER BY name').all()

  const departments = depts.map(dept => {
    const total = db.prepare('SELECT COUNT(*) as c FROM kpis WHERE dept_id=?').get(dept.id).c
    const submitted = month
      ? db.prepare('SELECT COUNT(*) as c FROM submissions WHERE dept_id=? AND year=? AND month=?').get(dept.id, year, month).c > 0
      : false
    const anomaly_count = db.prepare(`
      SELECT COUNT(*) as c FROM anomalies an
      JOIN sub_metrics sm ON an.sub_metric_id=sm.id
      JOIN kpis k ON sm.kpi_id=k.id
      WHERE k.dept_id=? AND an.dismissed=0
    `).get(dept.id).c

    // Month statuses: compute which months have data
    const month_statuses = {}
    for (let m = 1; m <= 12; m++) {
      const actuals_count = db.prepare(`
        SELECT COUNT(*) as c FROM actuals a
        JOIN sub_metrics sm ON a.sub_metric_id=sm.id
        JOIN kpis k ON sm.kpi_id=k.id
        WHERE k.dept_id=? AND a.year=? AND a.month=?
      `).get(dept.id, year, m).c
      if (actuals_count > 0) {
        // Simple: if submitted → 'on_track', if has data but not submitted → 'watch', else no_data
        const month_submitted = db.prepare('SELECT COUNT(*) as c FROM submissions WHERE dept_id=? AND year=? AND month=?').get(dept.id, year, m).c > 0
        month_statuses[m] = month_submitted ? 'on_track' : 'watch'
      }
    }

    // For the requested month, try to compute a simple breakdown
    let on_track = 0, watch = 0, off_track = 0, no_data = 0
    if (month) {
      const kpi_ids = db.prepare('SELECT id FROM kpis WHERE dept_id=?').all(dept.id).map(k => k.id)
      for (const kpi_id of kpi_ids) {
        const has_actual = db.prepare(`
          SELECT COUNT(*) as c FROM actuals a
          JOIN sub_metrics sm ON a.sub_metric_id=sm.id
          WHERE sm.kpi_id=? AND a.year=? AND a.month=?
        `).get(kpi_id, year, month).c
        if (has_actual === 0) { no_data++; continue }
        const has_anomaly = db.prepare(`
          SELECT COUNT(*) as c FROM anomalies an
          JOIN sub_metrics sm ON an.sub_metric_id=sm.id
          WHERE sm.kpi_id=? AND an.year=? AND an.month=? AND an.dismissed=0
        `).get(kpi_id, year, month).c
        if (has_anomaly > 0) { watch++; continue }
        on_track++
      }
    } else {
      no_data = total
    }

    return { dept_id: dept.id, department_name: dept.name, total, on_track, watch, off_track, no_data, submitted, anomaly_count, month_statuses }
  })

  res.json({ departments })
})

// GET /api/board/anomalies?year=&month=
app.get('/api/board/anomalies', requireAuth(), (req, res) => {
  const { year, month } = req.query
  const db = getDb()
  let anomalies
  if (year && month) {
    anomalies = db.prepare(`
      SELECT an.id, an.anomaly_type as type, an.description, an.detected_at as created_at, an.dismissed,
             k.kpi_name, k.dept_id, d.name as department_name
      FROM anomalies an
      JOIN sub_metrics sm ON an.sub_metric_id=sm.id
      JOIN kpis k ON sm.kpi_id=k.id
      JOIN departments d ON k.dept_id=d.id
      WHERE an.year=? AND an.month=? AND an.dismissed=0
      ORDER BY an.detected_at DESC
    `).all(year, month)
  } else {
    anomalies = db.prepare(`
      SELECT an.id, an.anomaly_type as type, an.description, an.detected_at as created_at, an.dismissed,
             k.kpi_name, k.dept_id, d.name as department_name
      FROM anomalies an
      JOIN sub_metrics sm ON an.sub_metric_id=sm.id
      JOIN kpis k ON sm.kpi_id=k.id
      JOIN departments d ON k.dept_id=d.id
      WHERE an.dismissed=0
      ORDER BY an.detected_at DESC
    `).all()
  }
  res.json({ anomalies })
})

app.listen(3001, () => console.log('✓ ITSEC KPI API running on http://localhost:3001'))
