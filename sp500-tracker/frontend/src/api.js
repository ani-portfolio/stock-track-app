const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export function fetchSP500() {
  return apiFetch('/sp500')
}

export async function triggerSP500Refresh() {
  const res = await fetch(`${BASE_URL}/sp500/refresh`, { method: 'POST' })
  return res.json()
}

export function fetchQuote(ticker) {
  return apiFetch(`/quote/${encodeURIComponent(ticker)}`)
}

export function fetchBatchQuotes(tickers) {
  return apiFetch(`/quotes/batch?tickers=${tickers.map(encodeURIComponent).join(',')}`)
}

export function fetchHistory(ticker, period = '1mo') {
  return apiFetch(`/history/${encodeURIComponent(ticker)}?period=${period}`)
}

export function fetchEarnings(days = 30) {
  return apiFetch(`/earnings?days=${days}`)
}
