import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label, Sector } from 'recharts'
import './MAG7View.css'

const MAG7_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'TSLA']

const SHORT_NAME = {
  'AAPL':  'Apple',
  'MSFT':  'Microsoft',
  'NVDA':  'NVIDIA',
  'AMZN':  'Amazon',
  'META':  'Meta',
  'GOOGL': 'Alphabet',
  'TSLA':  'Tesla',
}

const PERIODS = [
  { key: 'change_1d',    label: '1D'    },
  { key: 'change_1w',    label: '1W'    },
  { key: 'change_90d',   label: '90D'   },
  { key: 'change_180d',  label: '180D'  },
  { key: 'change_52w',   label: '1Y'    },
  { key: 'change_ytd',   label: 'YTD'   },
  { key: 'ath_drawdown', label: 'ATH ↓' },
]

function sliceColor(value, athMode = false) {
  if (value == null) return '#374151'
  const intensity = Math.min(Math.abs(value) / 30, 1)
  const l = Math.round(28 + intensity * 22)
  const s = Math.round(45 + intensity * 35)
  const isGreen = athMode ? value >= -5 : value >= 0
  return isGreen ? `hsl(142, ${s}%, ${l}%)` : `hsl(0, ${s}%, ${l}%)`
}

function fmtPct(v) {
  if (v == null) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
}

function weightedAvg(data) {
  const valid = data.filter(d => d.value != null)
  if (!valid.length) return null
  const totalW = valid.reduce((s, d) => s + d.weight, 0)
  return totalW ? valid.reduce((s, d) => s + d.value * d.weight / totalW, 0) : null
}

function ActiveSlice({ cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill }) {
  return (
    <Sector cx={cx} cy={cy}
      innerRadius={innerRadius - 6}
      outerRadius={outerRadius + 18}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      stroke="var(--bg)"
      strokeWidth={2}
    />
  )
}

function CenterLabel({ viewBox, avg, label }) {
  const { cx, cy } = viewBox
  return (
    <>
      <text x={cx} y={cy - 14} textAnchor="middle" dominantBaseline="middle"
        fill="var(--text-secondary)" fontSize={13} fontWeight={600} letterSpacing="0.05em">
        MAG 7
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" dominantBaseline="middle"
        fill={avg == null ? 'var(--text-secondary)' : avg >= 0 ? '#4ade80' : '#f87171'}
        fontSize={32} fontWeight={800} letterSpacing="-1">
        {fmtPct(avg)}
      </text>
      <text x={cx} y={cy + 38} textAnchor="middle" dominantBaseline="middle"
        fill="var(--text-secondary)" fontSize={11} fontWeight={500}>
        {label}
      </text>
    </>
  )
}

function OutsideLabel({ cx, cy, midAngle, outerRadius, payload, athMode }) {
  const RADIAN = Math.PI / 180
  const r = outerRadius + 40
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  const anchor = x > cx ? 'start' : 'end'
  const { ticker, value } = payload
  const name = SHORT_NAME[ticker] || ticker
  const isGreen = athMode ? value >= -5 : value >= 0
  const pctColor = value == null ? '#6b7280' : isGreen ? '#4ade80' : '#f87171'
  return (
    <text fontSize={13} textAnchor={anchor}>
      <tspan x={x} y={y - 7} fill="var(--text-primary)" fontWeight={600}>{name}</tspan>
      <tspan x={x} y={y + 10} fill={pctColor}>{fmtPct(value)}</tspan>
    </text>
  )
}

function RichTooltip({ active, payload, periodKey }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="m7-tooltip">
      <div className="m7-tt-ticker">{d.ticker}</div>
      <div className="m7-tt-name">{SHORT_NAME[d.ticker] || d.ticker}</div>
      <div className="m7-tt-metrics">
        {PERIODS.map(({ key, label }) => (
          <div key={key} className={`m7-tt-row ${key === periodKey ? 'm7-tt-active' : ''}`}>
            <span className="m7-tt-label">{label}</span>
            <span className={`m7-tt-val ${d[key] == null ? '' : d[key] >= 0 ? 'c-pos' : 'c-neg'}`}>
              {fmtPct(d[key])}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MAG7View({ stocks, onTickerClick }) {
  const [periodKey, setPeriodKey] = useState('ath_drawdown')
  const [activeIndex, setActiveIndex] = useState(null)

  const data = useMemo(() => {
    const byTicker = Object.fromEntries(stocks.map(s => [s.ticker, s]))
    return MAG7_TICKERS.map(ticker => {
      const s = byTicker[ticker]
      if (!s) return null
      const value = s[periodKey] ?? null
      return {
        ticker,
        weight: s.market_cap || 1,
        value,
        color: sliceColor(value, periodKey === 'ath_drawdown'),
        ...Object.fromEntries(PERIODS.map(p => [p.key, s[p.key] ?? null])),
      }
    }).filter(Boolean)
  }, [stocks, periodKey])

  const avg = useMemo(() => weightedAvg(data), [data])
  const periodLabel = PERIODS.find(p => p.key === periodKey)?.label ?? ''

  return (
    <div className="mag7-view">
      <div className="mag7-period-bar">
        {PERIODS.map(p => (
          <button
            key={p.key}
            className={`pill-btn mag7-period-btn ${periodKey === p.key ? 'active' : ''}`}
            onClick={() => setPeriodKey(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mag7-chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="weight"
              cx="50%"
              cy="50%"
              innerRadius="30%"
              outerRadius="52%"
              paddingAngle={1.5}
              label={props => <OutsideLabel {...props} athMode={periodKey === 'ath_drawdown'} />}
              labelLine={{ stroke: 'var(--border)', strokeWidth: 1 }}
              activeIndex={activeIndex}
              activeShape={ActiveSlice}
              onMouseEnter={(_, idx) => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={(_, idx) => onTickerClick(data[idx].ticker)}
              style={{ cursor: 'pointer' }}
            >
              {data.map(entry => (
                <Cell key={entry.ticker} fill={entry.color} stroke="var(--bg)" strokeWidth={2} />
              ))}
              <Label content={<CenterLabel avg={avg} label={periodLabel} />} />
            </Pie>
            <Tooltip content={<RichTooltip periodKey={periodKey} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
