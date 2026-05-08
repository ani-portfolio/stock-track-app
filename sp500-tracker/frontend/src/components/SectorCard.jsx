import './SectorCard.css'

function fmtPct(v) {
  if (v == null) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
}

function heatBg(value, absMax = 40) {
  if (value == null) return 'var(--surface-hover)'
  const intensity = Math.min(Math.abs(value) / absMax, 1)
  const alpha = (0.12 + intensity * 0.4).toFixed(2)
  return value >= 0
    ? `rgba(52, 199, 123, ${alpha})`
    : `rgba(240, 83, 74, ${alpha})`
}

const SUB_METRICS = [
  { key: 'change_1w',  label: '1W'  },
  { key: 'change_90d', label: '90D' },
  { key: 'change_ytd', label: 'YTD' },
  { key: 'change_52w', label: '1Y'  },
  { key: 'change_5y',  label: '5Y'  },
]

export default function SectorCard({ data, onClick }) {
  const { sector, etfTicker, count, change_52w, price } = data

  return (
    <div className="sector-card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}>

      <div className="sc-header">
        <span className="sc-name">{sector}</span>
        <div className="sc-badges">
          {etfTicker && <span className="sc-etf">{etfTicker}</span>}
          {count > 0 && <span className="sc-count">{count} co.</span>}
        </div>
      </div>

      <div className="sc-hero" style={{ backgroundColor: heatBg(change_52w) }}>
        <span className={`sc-big ${change_52w == null ? '' : change_52w >= 0 ? 'c-pos' : 'c-neg'}`}>
          {fmtPct(change_52w)}
        </span>
        <span className="sc-hero-label">52-week · {price != null ? `$${price.toFixed(2)}` : etfTicker}</span>
      </div>

      <div className="sc-metrics">
        {SUB_METRICS.map(({ key, label }) => (
          <div key={key} className="sc-metric">
            <span className="sc-metric-label">{label}</span>
            <span className={`sc-metric-val ${data[key] == null ? '' : data[key] >= 0 ? 'c-pos' : 'c-neg'}`}>
              {fmtPct(data[key])}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
