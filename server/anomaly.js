function detectAnomalies(db, sub_metric_id, year, month) {
  const detected = []
  try {
    const current = db.prepare('SELECT value FROM actuals WHERE sub_metric_id=? AND year=? AND month=?').get(sub_metric_id, year, month)
    if (!current || current.value === null || current.value === undefined) return detected

    const val = current.value
    const prev3 = db.prepare('SELECT value FROM actuals WHERE sub_metric_id=? AND year=? AND month<? AND value IS NOT NULL ORDER BY month DESC LIMIT 3').all(sub_metric_id, year, month)
    const prevMonth = prev3.length > 0 ? prev3[0].value : null

    function flag(type, desc) {
      const exists = db.prepare('SELECT id FROM anomalies WHERE sub_metric_id=? AND year=? AND month=? AND anomaly_type=? AND dismissed=0').get(sub_metric_id, year, month, type)
      if (!exists) {
        const info = db.prepare('INSERT INTO anomalies (sub_metric_id,year,month,anomaly_type,description) VALUES (?,?,?,?,?)').run(sub_metric_id, year, month, type, desc)
        detected.push({ id: info.lastInsertRowid, type, description: desc })
      }
    }

    const validPrev = prev3.filter(r => r.value !== null && r.value !== undefined).map(r => r.value)

    // 1. Spike: > 3× avg of prev 3 months
    if (validPrev.length >= 2) {
      const avg = validPrev.reduce((a, b) => a + b, 0) / validPrev.length
      if (avg > 0 && val > avg * 3) {
        flag('spike', `Value ${val.toLocaleString()} is more than 3× the previous ${validPrev.length}-month average (${avg.toFixed(2)}).`)
      }
    }

    // 2. Drop: < 25% of previous month
    if (prevMonth !== null && prevMonth !== undefined && prevMonth > 0) {
      if (val < prevMonth * 0.25) {
        flag('drop', `Value ${val.toLocaleString()} is less than 25% of previous month value (${prevMonth.toLocaleString()}).`)
      }
    }

    // 3. Zero after consecutive non-zero data
    if (val === 0 && validPrev.filter(v => v > 0).length >= 2) {
      flag('zero_after_data', `Value is 0 after ${validPrev.filter(v => v > 0).length} consecutive months of non-zero data.`)
    }

    // 4. Impossible value: rate entered as whole number, or negative count
    const sm = db.prepare('SELECT name, is_calc FROM sub_metrics WHERE id=?').get(sub_metric_id)
    if (sm && !sm.is_calc) {
      const nameLower = sm.name.toLowerCase()
      if ((nameLower.includes('%') || nameLower.includes('rate') || nameLower.includes('ratio')) && val > 1.5) {
        flag('impossible_value', `Rate/ratio value ${val} exceeds 150% — likely entered as a whole number (enter 0.85 not 85).`)
      }
      if ((nameLower.includes('no.') || nameLower.startsWith('(') || nameLower.includes('number')) && val < 0) {
        flag('impossible_value', `Count value ${val} is negative — please check data entry.`)
      }
    }

    // 5. MoM drop > 50% on revenue/sales KPIs
    if (prevMonth !== null && prevMonth !== undefined && prevMonth > 0 && val < prevMonth * 0.5) {
      const kpi = db.prepare('SELECT kpi_name FROM kpis WHERE id=(SELECT kpi_id FROM sub_metrics WHERE id=?)').get(sub_metric_id)
      const kpiName = (kpi?.kpi_name || '').toLowerCase()
      if (kpiName.includes('revenue') || kpiName.includes('sales') || kpiName.includes('target') || kpiName.includes('po')) {
        const dropPct = (((prevMonth - val) / prevMonth) * 100).toFixed(1)
        flag('mom_drop_50', `MoM drop of ${dropPct}% on a revenue/sales KPI.`)
      }
    }

  } catch (err) {
    console.error('Anomaly detection error for sub_metric_id=' + sub_metric_id + ':', err.message)
  }
  return detected
}

module.exports = { detectAnomalies }
