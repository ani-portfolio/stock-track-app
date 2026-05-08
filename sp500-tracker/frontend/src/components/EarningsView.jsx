import { useState, useMemo } from 'react'
import './EarningsView.css'

const WINDOWS = [
  { label: '7D',  days: 7  },
  { label: '14D', days: 14 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
]

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((new Date(dateStr + 'T12:00:00') - today) / 86400000)
}

function fmtDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function urgencyColor(days) {
  if (days === 0) return '#ef4444'
  if (days <= 3)  return '#f87171'
  if (days <= 7)  return '#f59e0b'
  if (days <= 14) return '#fb923c'
  return 'var(--text-secondary)'
}

function fmtRatio(v) {
  if (v == null || v <= 0) return '—'
  return v.toFixed(1) + 'x'
}

function fmtPct(v) {
  if (v == null) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
}

export default function EarningsView({ stocks, onTickerClick }) {
  const [windowDays, setWindowDays] = useState(30)

  const upcoming = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() + windowDays)
    return stocks
      .filter(s => {
        if (!s.next_earnings) return false
        const d = new Date(s.next_earnings + 'T12:00:00')
        return d >= today && d <= cutoff
      })
      .map(s => ({ ...s, _days: daysUntil(s.next_earnings) }))
      .sort((a, b) => a._days - b._days)
  }, [stocks, windowDays])

  return (
    <div className="earnings-view">
      <div className="ev-toolbar">
        <span className="ev-title">Upcoming Earnings</span>
        <div className="ev-window-btns">
          {WINDOWS.map(w => (
            <button
              key={w.days}
              className={`pill-btn ev-window-btn ${windowDays === w.days ? 'active' : ''}`}
              onClick={() => setWindowDays(w.days)}
            >
              {w.label}
            </button>
          ))}
        </div>
        <span className="ev-count">{upcoming.length} companies</span>
      </div>

      {upcoming.length === 0 ? (
        <div className="ev-empty">No earnings in the next {windowDays} days</div>
      ) : (
        <div className="ev-table-wrap">
          <table className="ev-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Days</th>
                <th>Ticker</th>
                <th>Name</th>
                <th>Sector</th>
                <th style={{ textAlign: 'right' }}>P/E</th>
                <th style={{ textAlign: 'right' }}>Fwd P/E</th>
                <th style={{ textAlign: 'right' }}>P/E vs Sec</th>
                <th style={{ textAlign: 'right' }}>ATH ↓</th>
                <th style={{ textAlign: 'right' }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map(s => (
                <tr key={s.ticker} className="ev-row" onClick={() => onTickerClick(s.ticker)}>
                  <td className="ev-date">{fmtDate(s.next_earnings)}</td>
                  <td>
                    <span className="ev-days" style={{ color: urgencyColor(s._days) }}>
                      {s._days === 0 ? 'Today' : `${s._days}d`}
                    </span>
                  </td>
                  <td className="ev-ticker">{s.ticker}</td>
                  <td className="ev-name">{s.name}</td>
                  <td className="ev-sector">{s.sector}</td>
                  <td style={{ textAlign: 'right' }}>{fmtRatio(s.pe_trailing)}</td>
                  <td style={{ textAlign: 'right' }}>{fmtRatio(s.pe_forward)}</td>
                  <td style={{ textAlign: 'right', color: s.pe_vs_sector == null ? undefined : s.pe_vs_sector <= 0 ? '#4ade80' : '#f87171' }}>
                    {s.pe_vs_sector != null ? fmtPct(s.pe_vs_sector) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', color: s.ath_drawdown == null ? undefined : s.ath_drawdown >= -5 ? '#4ade80' : '#f87171' }}>
                    {s.ath_drawdown != null ? fmtPct(s.ath_drawdown) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--accent)' }}>
                    {s._score != null ? s._score.toFixed(1) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
