import { useState, useMemo } from 'react'
import './StockTable.css'

const COL_GROUPS = [
  { key: 'perf',  label: 'Performance' },
  { key: 'ma',    label: 'Moving Avgs' },
  { key: 'score', label: 'Score'       },
  { key: 'fund',  label: 'Fundamentals' },
  { key: 'cap',   label: 'Market Cap'  },
]

const COLUMNS = [
  { key: 'star',         label: '★',          sortable: false, align: 'center', width: 36 },
  { key: 'ticker',       label: 'Ticker',     sortable: true,  width: 90 },
  { key: 'name',         label: 'Name',       sortable: true,  width: 210 },
  { key: 'sector',       label: 'Sector',     sortable: true,  width: 160 },
  { key: 'price',        label: 'Price',      sortable: true,  align: 'right', fmt: fmtPrice },
  { key: 'change_1d',    label: '1D %',       sortable: true,  align: 'right', fmt: fmtPct,   heat: true, group: 'perf' },
  { key: 'change_90d',   label: '90D %',      sortable: true,  align: 'right', fmt: fmtPct,   heat: true, group: 'perf' },
  { key: 'change_52w',   label: '52W %',      sortable: true,  align: 'right', fmt: fmtPct,   heat: true, group: 'perf' },
  { key: 'ath_drawdown', label: 'ATH ↓',      sortable: true,  align: 'right', fmt: fmtPct,   heat: true, group: 'perf' },
  { key: 'ma_50d_pct',   label: '50D MA',     sortable: true,  align: 'right', fmt: fmtPct,   heat: true, group: 'ma',   title: '% above/below 50-day moving average' },
  { key: 'ma_200d_pct',  label: '200D MA',    sortable: true,  align: 'right', fmt: fmtPct,   heat: true, group: 'ma',   title: '% above/below 200-day moving average' },
  { key: '_vs_sector',   label: 'vs Sector',  sortable: true,  align: 'right', fmt: fmtPct,   heat: true, group: 'score', title: '52W return minus sector ETF 52W return' },
  { key: '_score',       label: 'Score',      sortable: true,  align: 'right', fmt: fmtScore,             group: 'score', title: 'Undervalue score: ATH drawdown (50%) + vs sector (30%) + 200D MA (20%). Higher = more undervalued.' },
  { key: 'pe_trailing',  label: 'P/E',        sortable: true,  align: 'right', fmt: fmtRatio,             group: 'fund',  title: 'Trailing 12-month P/E ratio' },
  { key: 'pe_forward',   label: 'Fwd P/E',    sortable: true,  align: 'right', fmt: fmtRatio,             group: 'fund',  title: 'Forward P/E (analyst estimates)' },
  { key: 'pe_vs_sector', label: 'P/E vs Sec', sortable: true,  align: 'right', fmt: fmtPct,   heat: true, group: 'fund',  title: 'Trailing P/E minus sector median P/E. Negative = cheaper than peers.', invertHeat: true },
  { key: 'market_cap',   label: 'Mkt Cap',    sortable: true,  align: 'right', fmt: fmtCap,               group: 'cap' },
]

function fmtPrice(v) {
  if (v == null) return '—'
  return v >= 1000 ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${v.toFixed(2)}`
}

function fmtPct(v) {
  if (v == null) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
}

function fmtScore(v) {
  if (v == null || v <= 0) return '—'
  return v.toFixed(1)
}

function fmtRatio(v) {
  if (v == null || v <= 0) return '—'
  return v.toFixed(1) + 'x'
}

function fmtCap(v) {
  if (v == null) return '—'
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toFixed(0)}`
}

function heatBg(value, absMax = 30) {
  if (value == null) return undefined
  const intensity = Math.min(Math.abs(value) / absMax, 1)
  const alpha = (0.08 + intensity * 0.38).toFixed(2)
  return value >= 0
    ? `rgba(52, 199, 123, ${alpha})`
    : `rgba(240, 83, 74, ${alpha})`
}

function earningsBadge(nextEarnings) {
  if (!nextEarnings) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = Math.round((new Date(nextEarnings + 'T12:00:00') - today) / 86400000)
  if (days < 0 || days > 30) return null
  return {
    days,
    color: days <= 7 ? '#f59e0b' : days <= 14 ? '#fb923c' : '#9ca3af',
    label: days === 0 ? 'Earnings today' : `Earnings in ${days}d`,
  }
}

export default function StockTable({ stocks, watchlist, onToggleOwned, onRowClick }) {
  const [sortKey, setSortKey] = useState('market_cap')
  const [sortDir, setSortDir] = useState('desc')
  const [vis, setVis] = useState(() => new Set(['perf', 'ma', 'score', 'fund', 'cap']))

  function toggleGroup(key) {
    setVis(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const visibleCols = COLUMNS.filter(c => !c.group || vis.has(c.group))

  // stocks arrives pre-augmented from App (_vs_sector, _score already computed)
  const sorted = useMemo(() => {
    return [...stocks].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortDir === 'asc' ? av - bv : bv - av
    })
  }, [stocks, sortKey, sortDir])

  return (
    <>
      <div className="col-group-bar">
        {COL_GROUPS.map(g => (
          <button
            key={g.key}
            className={`col-group-btn ${vis.has(g.key) ? 'active' : ''}`}
            onClick={() => toggleGroup(g.key)}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div className="table-wrap">
        <table className="stock-table">
        <thead>
          <tr>
            {visibleCols.map(col => (
              <th
                key={col.key}
                className={`${col.sortable ? 'th-sort' : ''} ${sortKey === col.key ? 'th-active' : ''}`}
                style={{ textAlign: col.align || 'left', minWidth: col.width }}
                title={col.title}
                onClick={() => col.sortable && handleSort(col.key)}
              >
                {col.label}
                {col.sortable && sortKey === col.key && (
                  <span className="sort-icon">{sortDir === 'asc' ? ' ↑' : ' ↓'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(stock => {
            const owned = watchlist.includes(stock.ticker)
            const badge = earningsBadge(stock.next_earnings)
            return (
              <tr
                key={stock.ticker}
                className={owned ? 'row-owned' : ''}
                onClick={() => onRowClick(stock.ticker)}
              >
                {visibleCols.map(col => {
                  if (col.key === 'star') {
                    return (
                      <td
                        key="star"
                        className="td-star"
                        onClick={e => { e.stopPropagation(); onToggleOwned(stock.ticker) }}
                      >
                        <span className={owned ? 'star starred' : 'star'}>{owned ? '★' : '☆'}</span>
                      </td>
                    )
                  }
                  if (col.key === 'ticker') {
                    return (
                      <td key="ticker" className="td-ticker">
                        {stock.ticker}
                        {badge && (
                          <span
                            className="earnings-dot"
                            style={{ background: badge.color }}
                            title={badge.label}
                          />
                        )}
                      </td>
                    )
                  }
                  const val = stock[col.key]
                  const heatVal = col.invertHeat ? (val != null ? -val : null) : val
                  return (
                    <td
                      key={col.key}
                      className={`${col.heat && val != null ? (col.invertHeat ? (val <= 0 ? 'c-pos' : 'c-neg') : (val >= 0 ? 'c-pos' : 'c-neg')) : ''}`}
                      style={{
                        textAlign: col.align || 'left',
                        backgroundColor: col.heat ? heatBg(heatVal) : undefined,
                      }}
                    >
                      {col.fmt ? col.fmt(val) : (val ?? '—')}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
    </>
  )
}
