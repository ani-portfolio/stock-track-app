import { useState, useEffect, useRef } from 'react'
import './BubbleView.css'

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

function fmtPct(v) {
  if (v == null) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
}

function fmtCap(v) {
  if (!v) return '—'
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(0)}B`
  return `$${(v / 1e6).toFixed(0)}M`
}

// Returns { base, highlight } HSL strings — redder/darker = deeper drawdown
function bubbleColors(athDrawdown) {
  if (athDrawdown == null) return { base: 'hsl(220,14%,32%)', hi: 'hsl(220,14%,46%)' }
  const depth = Math.min(Math.abs(athDrawdown) / 55, 1)
  const h = Math.round(8 - depth * 8)          // 8 → 0 (orange-red → red)
  const s = Math.round(58 + depth * 24)         // 58 → 82
  const l = Math.round(50 - depth * 20)         // 50 → 30
  return {
    base: `hsl(${h},${s}%,${l}%)`,
    hi:   `hsl(${h},${s - 6}%,${Math.min(l + 20, 72)}%)`,
  }
}

function prepareBubbles(stocks, W, H) {
  if (!stocks.length || !W || !H) return []

  const byTicker = Object.fromEntries(stocks.map(s => [s.ticker, s]))
  const sectorEtf = {}
  for (const [sec, tk] of Object.entries(SECTOR_ETF_MAP)) {
    if (byTicker[tk]) sectorEtf[sec] = byTicker[tk]
  }

  const candidates = stocks
    .filter(s => s.sector !== 'ETF' && s.market_cap > 0 && s.ath_drawdown != null)
    .map(s => {
      const secReturn = sectorEtf[s.sector]?.change_52w ?? 0
      const vsector   = (s.change_52w ?? 0) - secReturn
      const athS  = Math.abs(Math.min(s.ath_drawdown   ?? 0, 0))
      const vsecS = Math.abs(Math.min(vsector,              0))
      const maS   = Math.abs(Math.min(s.ma_200d_pct    ?? 0, 0))
      const score = athS * 0.5 + vsecS * 0.3 + maS * 0.2
      return { ...s, score, vsector, secReturn }
    })
    .filter(s => s.score > 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 65)

  if (!candidates.length) return []

  const logCaps = candidates.map(s => Math.log(s.market_cap))
  const minLog  = Math.min(...logCaps)
  const logRange = Math.max(Math.max(...logCaps) - minLog, 1)

  return candidates.map(s => {
    const t = (Math.log(s.market_cap) - minLog) / logRange
    const r = 24 + Math.sqrt(t) * 48
    const colors = bubbleColors(s.ath_drawdown)
    return {
      ...s,
      r,
      colors,
      x:  r + Math.random() * Math.max(W - 2 * r, 1),
      y:  r + Math.random() * Math.max(H - 2 * r, 1),
      vx: (Math.random() - 0.5) * 1.4,
      vy: (Math.random() - 0.5) * 1.4,
    }
  })
}

function stepPhysics(bubbles, W, H) {
  const PULL    = 0.00035
  const DAMP    = 0.993
  const MAX_V   = 1.6

  for (const b of bubbles) {
    b.vx += (W * 0.5 - b.x) * PULL
    b.vy += (H * 0.5 - b.y) * PULL
    b.vx *= DAMP
    b.vy *= DAMP
    const spd = Math.hypot(b.vx, b.vy)
    if (spd > MAX_V) { b.vx *= MAX_V / spd; b.vy *= MAX_V / spd }
    b.x += b.vx; b.y += b.vy
    if (b.x - b.r < 0)  { b.x = b.r;     b.vx =  Math.abs(b.vx) * 0.6 }
    if (b.x + b.r > W)  { b.x = W - b.r; b.vx = -Math.abs(b.vx) * 0.6 }
    if (b.y - b.r < 0)  { b.y = b.r;     b.vy =  Math.abs(b.vy) * 0.6 }
    if (b.y + b.r > H)  { b.y = H - b.r; b.vy = -Math.abs(b.vy) * 0.6 }
  }

  // Collision response
  for (let i = 0; i < bubbles.length; i++) {
    for (let j = i + 1; j < bubbles.length; j++) {
      const a = bubbles[i], b = bubbles[j]
      const dx = b.x - a.x, dy = b.y - a.y
      const dist = Math.hypot(dx, dy)
      const minD = a.r + b.r + 2.5
      if (dist < minD && dist > 0.01) {
        const overlap = (minD - dist) * 0.5
        const nx = dx / dist, ny = dy / dist
        a.x -= nx * overlap; a.y -= ny * overlap
        b.x += nx * overlap; b.y += ny * overlap
        const dot = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
        if (dot < 0) {
          a.vx += dot * nx * 0.35; a.vy += dot * ny * 0.35
          b.vx -= dot * nx * 0.35; b.vy -= dot * ny * 0.35
        }
      }
    }
  }
}

// Fit text to maxWidth, truncating with ellipsis if needed
function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1)
  return t.length >= 2 ? t + '…' : ''
}

function drawFrame(ctx, bubbles, hovIdx, W, H) {
  ctx.clearRect(0, 0, W, H)

  bubbles.forEach((b, i) => {
    const hov = i === hovIdx
    const r   = hov ? b.r + 6 : b.r

    // Glow ring on hover
    if (hov) {
      const g = ctx.createRadialGradient(b.x, b.y, r * 0.6, b.x, b.y, r + 18)
      g.addColorStop(0, 'rgba(255,140,120,0.30)')
      g.addColorStop(1, 'rgba(255,140,120,0.00)')
      ctx.beginPath()
      ctx.arc(b.x, b.y, r + 18, 0, Math.PI * 2)
      ctx.fillStyle = g
      ctx.fill()
    }

    // Sphere gradient (highlight top-left)
    const g2 = ctx.createRadialGradient(
      b.x - r * 0.32, b.y - r * 0.32, 0,
      b.x,            b.y,             r
    )
    g2.addColorStop(0, b.colors.hi)
    g2.addColorStop(1, b.colors.base)
    ctx.beginPath()
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2)
    ctx.fillStyle = g2
    ctx.fill()

    // Rim
    ctx.strokeStyle = hov ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.10)'
    ctx.lineWidth   = hov ? 1.8 : 0.8
    ctx.stroke()

    // Labels
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'

    if (r >= 40) {
      const tSz = Math.min(r * 0.34, 14)
      ctx.font      = `700 ${tSz}px Inter,system-ui,sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.fillText(fitText(ctx, b.name, r * 1.82), b.x, b.y - tSz * 0.65)
      const mSz = Math.min(r * 0.26, 11)
      ctx.font      = `500 ${mSz}px Inter,system-ui,sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.72)'
      ctx.fillText(fmtPct(b.ath_drawdown), b.x, b.y + tSz * 0.75)
    } else if (r >= 28) {
      const tSz = Math.min(r * 0.36, 12)
      ctx.font      = `700 ${tSz}px Inter,system-ui,sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      // First word of company name, fall back to ticker
      const firstWord = b.name.split(/[\s,\.]/)[0]
      ctx.fillText(fitText(ctx, firstWord, r * 1.75) || b.ticker, b.x, b.y)
    } else {
      const tSz = Math.max(7, r * 0.44)
      ctx.font      = `600 ${tSz}px Inter,system-ui,sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.88)'
      ctx.fillText(b.ticker.slice(0, 5), b.x, b.y)
    }
  })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BubbleView({ stocks, onTickerClick }) {
  const canvasRef  = useRef(null)
  const stateRef   = useRef({ bubbles: [], hovIdx: -1 })
  const stocksRef  = useRef(stocks)
  const cssSizeRef = useRef({ w: 0, h: 0 })
  const animRef    = useRef(null)
  const [tooltip, setTooltip] = useState(null)

  // Keep stocksRef current
  useEffect(() => { stocksRef.current = stocks }, [stocks])

  // Initialize (or re-initialize) bubbles
  function initBubbles(w, h) {
    stateRef.current.bubbles = prepareBubbles(stocksRef.current, w, h)
  }

  // Set up canvas DPR scaling
  function setupCanvas(canvas) {
    const dpr  = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width  = rect.width  * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)
    cssSizeRef.current = { w: rect.width, h: rect.height }
    return { ctx, w: rect.width, h: rect.height }
  }

  // Boot: set up canvas → init bubbles → start loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { w, h } = setupCanvas(canvas)
    initBubbles(w, h)
  }, [stocks])

  // Animation loop (runs once on mount, reads from refs)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let lastT = 0

    function frame(ts) {
      if (ts - lastT >= 14) {   // ~70fps cap
        lastT = ts
        const ctx = canvas.getContext('2d')
        const { w, h } = cssSizeRef.current
        const { bubbles, hovIdx } = stateRef.current
        if (bubbles.length) {
          stepPhysics(bubbles, w, h)
          drawFrame(ctx, bubbles, hovIdx, w, h)
        }
      }
      animRef.current = requestAnimationFrame(frame)
    }

    animRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const obs = new ResizeObserver(() => {
      const { w, h } = setupCanvas(canvas)
      initBubbles(w, h)
    })
    obs.observe(canvas)
    return () => obs.disconnect()
  }, [])

  function hitTest(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    return stateRef.current.bubbles.findIndex(b => Math.hypot(b.x - mx, b.y - my) <= b.r)
  }

  function handleMouseMove(e) {
    const idx = hitTest(e)
    stateRef.current.hovIdx = idx
    canvasRef.current.style.cursor = idx >= 0 ? 'pointer' : 'default'
    setTooltip(idx >= 0
      ? { x: e.clientX, y: e.clientY, b: stateRef.current.bubbles[idx] }
      : null
    )
  }

  function handleClick(e) {
    const idx = hitTest(e)
    if (idx >= 0) onTickerClick(stateRef.current.bubbles[idx].ticker)
  }

  return (
    <div className="bubble-view">
      <div className="bv-legend">
        <span className="bv-legend-title">Most Undervalued S&amp;P 500</span>
        <span className="bv-legend-sub">
          Sized by market cap · Color by ATH drawdown · Hover for details · Click for chart
        </span>
        <span className="bv-legend-score">Score = ATH drawdown (50%) + underperformance vs sector (30%) + distance below 200D MA (20%)</span>
      </div>

      <canvas
        ref={canvasRef}
        className="bubble-canvas"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { stateRef.current.hovIdx = -1; setTooltip(null) }}
        onClick={handleClick}
      />

      {tooltip && (
        <div className="bv-tooltip" style={{ left: tooltip.x + 16, top: tooltip.y - 12 }}>
          <div className="bvt-name">{tooltip.b.name}</div>
          <div className="bvt-sub">{tooltip.b.ticker} · {tooltip.b.sector}</div>
          <div className="bvt-grid">
            <div className="bvt-row">
              <span className="bvt-label">ATH Drawdown</span>
              <span className="bvt-val c-neg">{fmtPct(tooltip.b.ath_drawdown)}</span>
            </div>
            <div className="bvt-row">
              <span className="bvt-label">vs Sector (52W)</span>
              <span className={`bvt-val ${tooltip.b.vsector >= 0 ? 'c-pos' : 'c-neg'}`}>
                {fmtPct(tooltip.b.vsector)}
              </span>
            </div>
            <div className="bvt-row">
              <span className="bvt-label">52W Return</span>
              <span className={`bvt-val ${(tooltip.b.change_52w ?? 0) >= 0 ? 'c-pos' : 'c-neg'}`}>
                {fmtPct(tooltip.b.change_52w)}
              </span>
            </div>
            <div className="bvt-row">
              <span className="bvt-label">200D MA</span>
              <span className={`bvt-val ${(tooltip.b.ma_200d_pct ?? 0) >= 0 ? 'c-pos' : 'c-neg'}`}>
                {fmtPct(tooltip.b.ma_200d_pct)}
              </span>
            </div>
            <div className="bvt-row">
              <span className="bvt-label">YTD</span>
              <span className={`bvt-val ${(tooltip.b.change_ytd ?? 0) >= 0 ? 'c-pos' : 'c-neg'}`}>
                {fmtPct(tooltip.b.change_ytd)}
              </span>
            </div>
            <div className="bvt-row">
              <span className="bvt-label">Market Cap</span>
              <span className="bvt-val">{fmtCap(tooltip.b.market_cap)}</span>
            </div>
          </div>
          <div className="bvt-hint">Click to view chart →</div>
        </div>
      )}
    </div>
  )
}
