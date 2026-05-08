import { useState, useEffect } from 'react'
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip
} from 'recharts'
import { fetchHistory } from '../api'
import PeriodSelector from './PeriodSelector'
import './ChartModal.css'

function formatXAxis(dateStr, period) {
  if (!dateStr) return ''
  if (period === '1d' || period === '5d') {
    // intraday: "2026-05-01T09:30:00" → "9:30"
    const t = dateStr.split('T')[1]
    if (!t) return dateStr
    const [h, m] = t.split(':')
    return `${parseInt(h, 10)}:${m}`
  }
  // daily: "2026-05-01" → "May 1"
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ChartModal({ ticker, stockName, nextEarnings, onClose }) {
  const [period, setPeriod] = useState('1mo')
  const [historyData, setHistoryData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchHistory(ticker, period)
      .then(res => {
        if (!cancelled) setHistoryData(res.data)
      })
      .catch(err => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [ticker, period])

  const first = historyData[0]?.close
  const last = historyData[historyData.length - 1]?.close
  const pctChange = (first != null && last != null && first !== 0)
    ? ((last - first) / first) * 100
    : null
  const trendColor = (first != null && last != null && last >= first)
    ? 'var(--positive)'
    : 'var(--negative)'

  const gradientId = `chartGrad-${ticker}`

  const earningsDays = nextEarnings
    ? Math.round((new Date(nextEarnings + 'T12:00:00') - new Date()) / 86400000)
    : null
  const earningsLabel = earningsDays == null ? null
    : earningsDays === 0 ? 'Earnings today'
    : earningsDays === 1 ? 'Earnings tomorrow'
    : earningsDays > 0 && earningsDays <= 60 ? `Earnings in ${earningsDays}d`
    : null

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            <span className="modal-ticker">{ticker}</span>
            {stockName && <span className="modal-stock-name">{stockName}</span>}
            {pctChange != null && (
              <span className="modal-pct" style={{ color: trendColor }}>
                {pctChange > 0 ? '+' : ''}{pctChange.toFixed(2)}%
              </span>
            )}
          </h2>
          {earningsLabel && (
            <span className="modal-earnings" title={nextEarnings}>{earningsLabel}</span>
          )}
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <PeriodSelector selectedPeriod={period} onChange={setPeriod} />

        <div className="modal-chart">
          {loading && <div className="chart-overlay">Loading…</div>}
          {error && <div className="chart-overlay chart-error">{error}</div>}
          {!loading && !error && historyData.length > 0 && historyData.some(d => d.ma_50 != null) && (
            <div className="chart-legend">
              <span className="chart-legend-item" style={{ color: '#f59e0b' }}>— 50D MA</span>
              <span className="chart-legend-item" style={{ color: '#a78bfa' }}>— 200D MA</span>
            </div>
          )}
          {!loading && !error && historyData.length > 0 && (
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={historyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={trendColor} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={trendColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={d => formatXAxis(d, period)}
                  tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tickFormatter={v => `$${v}`}
                  tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                  formatter={(val, name) => {
                    if (val == null) return [null, null]
                    const labels = { close: 'Close', ma_50: '50D MA', ma_200: '200D MA' }
                    return [`$${val.toFixed(2)}`, labels[name] || name]
                  }}
                  labelFormatter={label => formatXAxis(label, period)}
                />
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke={trendColor}
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                  dot={false}
                  activeDot={{ r: 4, fill: trendColor }}
                />
                <Line
                  type="monotone"
                  dataKey="ma_50"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={false}
                  connectNulls
                  legendType="none"
                />
                <Line
                  type="monotone"
                  dataKey="ma_200"
                  stroke="#a78bfa"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={false}
                  connectNulls
                  legendType="none"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
