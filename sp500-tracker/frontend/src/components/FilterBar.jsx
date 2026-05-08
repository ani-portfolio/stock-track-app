import { useState } from 'react'
import './FilterBar.css'

export default function FilterBar({
  sectors, sector, onSectorChange,
  search, onSearchChange,
  ownedOnly, onOwnedOnlyChange,
  count, total,
  screener, onScreenerChange,
}) {
  const [showScreener, setShowScreener] = useState(false)

  const activeCount = Object.values(screener).filter(Boolean).length

  function clearScreener() {
    for (const k of Object.keys(screener)) onScreenerChange(k, '')
  }

  return (
    <div className="filter-bar-wrap">
      <div className="filter-bar">
        <input
          className="filter-search"
          type="text"
          placeholder="Search ticker or name…"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />

        <select
          className="filter-select"
          value={sector}
          onChange={e => onSectorChange(e.target.value)}
        >
          <option value="">All Sectors</option>
          {sectors.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <label className="filter-owned-label">
          <input
            type="checkbox"
            checked={ownedOnly}
            onChange={e => onOwnedOnlyChange(e.target.checked)}
          />
          <span>Watchlist only</span>
        </label>

        <button
          className={`filter-screener-btn ${showScreener ? 'active' : ''}`}
          onClick={() => setShowScreener(v => !v)}
        >
          Screener
          {activeCount > 0 && <span className="screener-badge">{activeCount}</span>}
          <span className="screener-chevron">{showScreener ? '▲' : '▼'}</span>
        </button>

        <span className="filter-count">
          {count === total ? `${total} stocks` : `${count} of ${total}`}
        </span>
      </div>

      {showScreener && (
        <div className="screener-panel">
          <div className="screener-field">
            <label className="screener-label">Score ≥</label>
            <input
              type="number" className="screener-input" placeholder="0" min="0"
              value={screener.minScore}
              onChange={e => onScreenerChange('minScore', e.target.value)}
            />
          </div>

          <div className="screener-field">
            <label className="screener-label">P/E ≤</label>
            <input
              type="number" className="screener-input" placeholder="any" min="0"
              value={screener.maxPE}
              onChange={e => onScreenerChange('maxPE', e.target.value)}
            />
          </div>

          <div className="screener-field">
            <label className="screener-label">ATH ↓ ≥</label>
            <div className="screener-input-unit">
              <input
                type="number" className="screener-input" placeholder="0" min="0"
                value={screener.minATHDrawdown}
                onChange={e => onScreenerChange('minATHDrawdown', e.target.value)}
              />
              <span className="screener-unit">%</span>
            </div>
          </div>

          <div className="screener-field">
            <label className="screener-label">50D MA</label>
            <select className="screener-select" value={screener.ma50} onChange={e => onScreenerChange('ma50', e.target.value)}>
              <option value="">Any</option>
              <option value="above">Above</option>
              <option value="below">Below</option>
            </select>
          </div>

          <div className="screener-field">
            <label className="screener-label">200D MA</label>
            <select className="screener-select" value={screener.ma200} onChange={e => onScreenerChange('ma200', e.target.value)}>
              <option value="">Any</option>
              <option value="above">Above</option>
              <option value="below">Below</option>
            </select>
          </div>

          <div className="screener-field">
            <label className="screener-label">Earnings</label>
            <select className="screener-select" value={screener.earningsDays} onChange={e => onScreenerChange('earningsDays', e.target.value)}>
              <option value="">Any</option>
              <option value="7">Next 7 days</option>
              <option value="14">Next 14 days</option>
              <option value="30">Next 30 days</option>
            </select>
          </div>

          {activeCount > 0 && (
            <button className="screener-clear" onClick={clearScreener}>Clear all</button>
          )}
        </div>
      )}
    </div>
  )
}
