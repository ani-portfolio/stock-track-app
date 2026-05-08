import { useState, useEffect, useMemo, useCallback } from 'react'
import { useLocalStorage } from './hooks/useLocalStorage'
import { fetchSP500, triggerSP500Refresh } from './api'
import FilterBar from './components/FilterBar'
import StockTable from './components/StockTable'
import SectorsView from './components/SectorsView'
import BubbleView from './components/BubbleView'
import MAG7View from './components/MAG7View'
import EarningsView from './components/EarningsView'
import ChartModal from './components/ChartModal'

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

const SCREENER_DEFAULTS = { minScore: '', maxPE: '', minATHDrawdown: '', ma50: '', ma200: '', earningsDays: '' }

export default function App() {
  const [sp500, setSP500] = useState([])
  const [lastUpdated, setLastUpdated] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const [activeTab, setActiveTab] = useState('discover')

  const [watchlist, setWatchlist] = useLocalStorage('watchlist', [])
  const [selectedTicker, setSelectedTicker] = useState(null)

  const [search, setSearch] = useState('')
  const [sector, setSector] = useState('')
  const [ownedOnly, setOwnedOnly] = useState(false)
  const [screener, setScreener] = useState(SCREENER_DEFAULTS)

  const loadData = useCallback(async () => {
    try {
      const res = await fetchSP500()
      setSP500(res.data || [])
      setLastUpdated(res.last_updated)
      setRefreshing(res.refreshing)
      return res.refreshing
    } catch {
      return false
    } finally {
      setInitialLoad(false)
    }
  }, [])

  useEffect(() => {
    loadData().then(stillRefreshing => {
      if (stillRefreshing) startPolling()
    })
  }, [loadData])

  function startPolling() {
    const id = setInterval(async () => {
      const stillRefreshing = await loadData()
      if (!stillRefreshing) clearInterval(id)
    }, 8_000)
    return id
  }

  const sectors = useMemo(() => {
    const s = new Set(sp500.map(x => x.sector).filter(Boolean))
    return Array.from(s).sort()
  }, [sp500])

  // Augment every stock with computed _vs_sector and _score
  const augmented = useMemo(() => {
    const byTicker = Object.fromEntries(sp500.map(s => [s.ticker, s]))
    const sectorReturn = {}
    for (const [sec, etf] of Object.entries(SECTOR_ETF_MAP)) {
      sectorReturn[sec] = byTicker[etf]?.change_52w ?? null
    }
    return sp500.map(s => {
      const secRet = sectorReturn[s.sector] ?? null
      const vs = (s.change_52w != null && secRet != null) ? s.change_52w - secRet : null
      const athS = Math.abs(Math.min(s.ath_drawdown  ?? 0, 0))
      const vsS  = Math.abs(Math.min(vs              ?? 0, 0))
      const maS  = Math.abs(Math.min(s.ma_200d_pct   ?? 0, 0))
      const score = athS * 0.5 + vsS * 0.3 + maS * 0.2
      return { ...s, _vs_sector: vs, _score: score > 0 ? score : null }
    })
  }, [sp500])

  const filtered = useMemo(() => {
    let data = augmented
    if (ownedOnly) data = data.filter(x => watchlist.includes(x.ticker))
    if (sector)    data = data.filter(x => x.sector === sector)
    if (search) {
      const q = search.toLowerCase()
      data = data.filter(x => x.ticker.toLowerCase().includes(q) || x.name.toLowerCase().includes(q))
    }
    if (screener.minScore)       data = data.filter(x => (x._score ?? 0) >= +screener.minScore)
    if (screener.maxPE)          data = data.filter(x => x.pe_trailing == null || x.pe_trailing <= +screener.maxPE)
    if (screener.minATHDrawdown) data = data.filter(x => x.ath_drawdown != null && x.ath_drawdown <= -Math.abs(+screener.minATHDrawdown))
    if (screener.ma50 === 'below') data = data.filter(x => (x.ma_50d_pct ?? 1) < 0)
    if (screener.ma50 === 'above') data = data.filter(x => (x.ma_50d_pct ?? -1) > 0)
    if (screener.ma200 === 'below') data = data.filter(x => (x.ma_200d_pct ?? 1) < 0)
    if (screener.ma200 === 'above') data = data.filter(x => (x.ma_200d_pct ?? -1) > 0)
    if (screener.earningsDays) {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() + +screener.earningsDays)
      data = data.filter(x => {
        if (!x.next_earnings) return false
        const d = new Date(x.next_earnings + 'T12:00:00')
        return d >= today && d <= cutoff
      })
    }
    return data
  }, [augmented, watchlist, sector, search, ownedOnly, screener])

  function handleToggleOwned(ticker) {
    setWatchlist(prev =>
      prev.includes(ticker) ? prev.filter(t => t !== ticker) : [...prev, ticker]
    )
  }

  function handleScreenerChange(field, value) {
    setScreener(prev => ({ ...prev, [field]: value }))
  }

  async function handleManualRefresh() {
    await triggerSP500Refresh()
    setRefreshing(true)
    startPolling()
  }

  function fmtTime(iso) {
    if (!iso) return null
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const dataReady = !initialLoad && sp500.length > 0
  const selectedStock = sp500.find(s => s.ticker === selectedTicker)

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>S&amp;P 500 Tracker</h1>
          {dataReady && (
            <nav className="app-tabs">
              <button className={`app-tab ${activeTab === 'discover'  ? 'active' : ''}`} onClick={() => setActiveTab('discover')}>Discover</button>
              <button className={`app-tab ${activeTab === 'stocks'    ? 'active' : ''}`} onClick={() => setActiveTab('stocks')}>Stocks</button>
              <button className={`app-tab ${activeTab === 'earnings'  ? 'active' : ''}`} onClick={() => setActiveTab('earnings')}>Earnings</button>
              <button className={`app-tab ${activeTab === 'sectors'   ? 'active' : ''}`} onClick={() => setActiveTab('sectors')}>Sectors</button>
              <button className={`app-tab ${activeTab === 'mag7'      ? 'active' : ''}`} onClick={() => setActiveTab('mag7')}>MAG7</button>
            </nav>
          )}
        </div>
        <div className="header-right">
          {lastUpdated && (
            <span className="header-updated">Updated {fmtTime(lastUpdated)}</span>
          )}
          {refreshing && (
            <span className="badge-refreshing">
              <span className="spinner" />
              Building data…
            </span>
          )}
          <button
            className="btn-refresh"
            onClick={handleManualRefresh}
            disabled={refreshing}
            title="Re-fetch all S&P 500 data"
          >
            ↻ Refresh
          </button>
        </div>
      </header>

      {initialLoad ? (
        <div className="state-loading">
          <div className="spinner-lg" />
          <p>Connecting to backend…</p>
        </div>
      ) : sp500.length === 0 && refreshing ? (
        <div className="state-loading">
          <div className="spinner-lg" />
          <p>Fetching S&amp;P 500 data — this takes about 2 minutes on first load.</p>
          <p className="state-sub">The page will update automatically.</p>
        </div>
      ) : sp500.length === 0 ? (
        <div className="state-empty">
          <p>No data available.</p>
          <button className="btn-refresh" onClick={handleManualRefresh}>Fetch Data</button>
        </div>
      ) : activeTab === 'discover' ? (
        <BubbleView stocks={sp500} onTickerClick={setSelectedTicker} />
      ) : activeTab === 'stocks' ? (
        <>
          <FilterBar
            sectors={sectors}
            sector={sector}
            onSectorChange={setSector}
            search={search}
            onSearchChange={setSearch}
            ownedOnly={ownedOnly}
            onOwnedOnlyChange={setOwnedOnly}
            count={filtered.length}
            total={sp500.length}
            screener={screener}
            onScreenerChange={handleScreenerChange}
          />
          <StockTable
            stocks={filtered}
            watchlist={watchlist}
            onToggleOwned={handleToggleOwned}
            onRowClick={setSelectedTicker}
          />
        </>
      ) : activeTab === 'earnings' ? (
        <EarningsView stocks={augmented} onTickerClick={setSelectedTicker} />
      ) : activeTab === 'mag7' ? (
        <MAG7View stocks={sp500} onTickerClick={setSelectedTicker} />
      ) : (
        <SectorsView stocks={sp500} onSectorClick={setSelectedTicker} />
      )}

      {selectedTicker && (
        <ChartModal
          ticker={selectedTicker}
          stockName={selectedStock?.name}
          nextEarnings={selectedStock?.next_earnings}
          onClose={() => setSelectedTicker(null)}
        />
      )}
    </div>
  )
}
