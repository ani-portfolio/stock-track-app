import './WatchlistCard.css'

function fmt(val, prefix = '') {
  if (val == null) return 'N/A'
  return `${prefix}${val.toFixed(2)}`
}

export default function WatchlistCard({ quote, onRemove, onClick }) {
  const { ticker, price, change_pct, day_high, day_low, error } = quote
  const isPositive = change_pct != null && change_pct >= 0

  return (
    <div className="card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}>
      <button
        className="card-remove"
        onClick={e => { e.stopPropagation(); onRemove() }}
        aria-label={`Remove ${ticker}`}
      >×</button>

      <div className="card-ticker">{ticker}</div>

      {error ? (
        <div className="card-error">{error}</div>
      ) : (
        <>
          <div className="card-price">{fmt(price, '$')}</div>
          <div className={`card-change ${isPositive ? 'positive' : 'negative'}`}>
            {change_pct != null
              ? `${isPositive ? '+' : ''}${change_pct.toFixed(2)}%`
              : 'N/A'}
          </div>
          <div className="card-range">
            <span>H <strong>{fmt(day_high, '$')}</strong></span>
            <span>L <strong>{fmt(day_low, '$')}</strong></span>
          </div>
        </>
      )}
    </div>
  )
}
