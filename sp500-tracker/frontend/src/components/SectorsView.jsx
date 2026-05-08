import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label, Sector } from 'recharts'
import './SectorsView.css'

const SECTOR_ETF_MAP = {
  'Information Technology': 'XLK',
  'Financials':             'XLF',
  'Health Care':            'XLV',
  'Consumer Discretionary': 'XLY',
  'Communication Services': 'XLC',
  'Industrials':            'XLI',
  'Consumer Staples':       'XLP',
  'Energy':                 'XLE',
  'Utilities':              'XLU',
  'Real Estate':            'XLRE',
  'Materials':              'XLB',
}

const SHORT_NAME = {
  'Information Technology': 'Info Tech',
  'Consumer Discretionary': 'Consumer Disc.',
  'Communication Services': 'Comm. Services',
  'Consumer Staples':       'Cons. Staples',
}

const GRID_PERIODS = [
  { key: 'change_1d',    label: '1D'    },
  { key: 'change_1w',    label: '1W'    },
  { key: 'change_90d',   label: '90D'   },
  { key: 'change_180d',  label: '180D'  },
  { key: 'change_52w',   label: '1Y'    },
  { key: 'change_ytd',   label: 'YTD'   },
  { key: 'ath_drawdown', label: 'ATH ↓' },
]

const ALL_FIELDS = ['change_1d', 'change_1w', 'change_90d', 'change_180d', 'change_52w', 'change_ytd', 'ath_drawdown']

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

function buildAllData(stocks) {
  const byTicker = Object.fromEntries(stocks.map(s => [s.ticker, s]))
  const sectorCaps = {}, sectorCounts = {}
  for (const s of stocks) {
    if (s.sector && s.sector !== 'ETF') {
      sectorCaps[s.sector] = (sectorCaps[s.sector] || 0) + (s.market_cap || 0)
      sectorCounts[s.sector] = (sectorCounts[s.sector] || 0) + 1
    }
  }
  const base = Object.entries(SECTOR_ETF_MAP).map(([sector, etfTicker]) => {
    const etf = byTicker[etfTicker]
    if (!etf) return null
    return {
      sector, etfTicker,
      count: sectorCounts[sector] ?? 0,
      weight: sectorCaps[sector] || 1,
      ...Object.fromEntries(ALL_FIELDS.map(f => [f, etf[f] ?? null])),
    }
  }).filter(Boolean)

  return GRID_PERIODS.map(period => ({
    ...period,
    data: base.map(d => ({
      ...d,
      value: d[period.key],
      color: sliceColor(d[period.key], period.key === 'ath_drawdown'),
    })),
  }))
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
      innerRadius={innerRadius - 4}
      outerRadius={outerRadius + 12}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      stroke="var(--bg)"
      strokeWidth={2}
    />
  )
}

function CenterLabel({ viewBox, avg }) {
  const { cx, cy } = viewBox
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
      fill={avg == null ? 'var(--text-secondary)' : avg >= 0 ? '#4ade80' : '#f87171'}
      fontSize={26} fontWeight={800} letterSpacing="-0.5">
      {fmtPct(avg)}
    </text>
  )
}

function OutsideLabel({ cx, cy, midAngle, outerRadius, payload, athMode }) {
  const RADIAN = Math.PI / 180
  const r = outerRadius + 30
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  const anchor = x > cx ? 'start' : 'end'
  const { sector, value } = payload
  const name = SHORT_NAME[sector] || sector
  const isGreen = athMode ? value >= -5 : value >= 0
  const pctColor = value == null ? '#6b7280' : isGreen ? '#4ade80' : '#f87171'
  return (
    <text fontSize={11} textAnchor={anchor}>
      <tspan x={x} y={y - 6} fill="var(--text-secondary)">{name}</tspan>
      <tspan x={x} y={y + 8} fill={pctColor}>{fmtPct(value)}</tspan>
    </text>
  )
}

function RichTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="sv-tooltip">
      <div className="sv-tt-title">{d.sector}</div>
      <div className="sv-tt-sub">{d.etfTicker} · {d.count} companies</div>
      <div className="sv-tt-metrics">
        {GRID_PERIODS.map(({ key, label }) => (
          <div key={key} className="sv-tt-row">
            <span className="sv-tt-label">{label}</span>
            <span className={`sv-tt-val ${d[key] == null ? '' : d[key] >= 0 ? 'c-pos' : 'c-neg'}`}>
              {fmtPct(d[key])}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SectorPie({ label, data, onSectorClick, athMode }) {
  const [activeIndex, setActiveIndex] = useState(null)
  const avg = useMemo(() => weightedAvg(data), [data])

  return (
    <div className="sv-pie-card">
      <div className="sv-pie-title">{label}</div>
      <ResponsiveContainer width="100%" height={420}>
        <PieChart>
          <Pie data={data} dataKey="weight" cx="50%" cy="50%"
            innerRadius="32%" outerRadius="50%"
            paddingAngle={1.5}
            label={props => <OutsideLabel {...props} athMode={athMode} />}
            labelLine={{ stroke: 'var(--border)', strokeWidth: 1 }}
            activeIndex={activeIndex}
            activeShape={ActiveSlice}
            onMouseEnter={(_, idx) => setActiveIndex(idx)}
            onMouseLeave={() => setActiveIndex(null)}
            onClick={(_, idx) => onSectorClick(data[idx].etfTicker)}
            style={{ cursor: 'pointer' }}>
            {data.map(entry => (
              <Cell key={entry.sector} fill={entry.color} stroke="var(--bg)" strokeWidth={2} />
            ))}
            <Label content={<CenterLabel avg={avg} />} />
          </Pie>
          <Tooltip content={<RichTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function SectorsView({ stocks, onSectorClick }) {
  const periodData = useMemo(() => buildAllData(stocks), [stocks])

  return (
    <div className="sectors-view">
      <div className="sv-grid">
        {periodData.map(({ key, label, data }) => (
          <SectorPie key={key} label={label} data={data} onSectorClick={onSectorClick} athMode={key === 'ath_drawdown'} />
        ))}
      </div>
    </div>
  )
}
