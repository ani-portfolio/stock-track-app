import asyncio
import logging
import math
import statistics
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

import pandas as pd
import requests
import yfinance as yf
from bs4 import BeautifulSoup
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

logging.getLogger("yfinance").setLevel(logging.ERROR)

# ── Curated ETF list ──────────────────────────────────────────────────────────

ETF_LIST = [
    # Broad US market
    {"ticker": "SPY",  "name": "SPDR S&P 500 ETF Trust",              "sector": "ETF", "industry": "Broad Market"},
    {"ticker": "IVV",  "name": "iShares Core S&P 500 ETF",            "sector": "ETF", "industry": "Broad Market"},
    {"ticker": "VOO",  "name": "Vanguard S&P 500 ETF",                "sector": "ETF", "industry": "Broad Market"},
    {"ticker": "VTI",  "name": "Vanguard Total Stock Market ETF",     "sector": "ETF", "industry": "Broad Market"},
    {"ticker": "QQQ",  "name": "Invesco NASDAQ-100 ETF",              "sector": "ETF", "industry": "Broad Market"},
    {"ticker": "DIA",  "name": "SPDR Dow Jones Industrial Average",   "sector": "ETF", "industry": "Broad Market"},
    {"ticker": "IWM",  "name": "iShares Russell 2000 ETF",            "sector": "ETF", "industry": "Small Cap"},
    {"ticker": "IJH",  "name": "iShares Core S&P Mid-Cap ETF",        "sector": "ETF", "industry": "Mid Cap"},
    # Sectors
    {"ticker": "XLK",  "name": "Technology Select Sector SPDR",       "sector": "ETF", "industry": "Technology"},
    {"ticker": "XLF",  "name": "Financial Select Sector SPDR",        "sector": "ETF", "industry": "Financials"},
    {"ticker": "XLE",  "name": "Energy Select Sector SPDR",           "sector": "ETF", "industry": "Energy"},
    {"ticker": "XLV",  "name": "Health Care Select Sector SPDR",      "sector": "ETF", "industry": "Health Care"},
    {"ticker": "XLY",  "name": "Consumer Discretionary Select SPDR",  "sector": "ETF", "industry": "Consumer"},
    {"ticker": "XLP",  "name": "Consumer Staples Select Sector SPDR", "sector": "ETF", "industry": "Consumer"},
    {"ticker": "XLI",  "name": "Industrial Select Sector SPDR",       "sector": "ETF", "industry": "Industrials"},
    {"ticker": "XLB",  "name": "Materials Select Sector SPDR",        "sector": "ETF", "industry": "Materials"},
    {"ticker": "XLC",  "name": "Communication Services Select SPDR",  "sector": "ETF", "industry": "Communication"},
    {"ticker": "XLRE", "name": "Real Estate Select Sector SPDR",      "sector": "ETF", "industry": "Real Estate"},
    {"ticker": "XLU",  "name": "Utilities Select Sector SPDR",        "sector": "ETF", "industry": "Utilities"},
    # Semiconductors / Tech themes
    {"ticker": "SMH",  "name": "VanEck Semiconductor ETF",            "sector": "ETF", "industry": "Technology"},
    {"ticker": "SOXX", "name": "iShares Semiconductor ETF",           "sector": "ETF", "industry": "Technology"},
    {"ticker": "ARKK", "name": "ARK Innovation ETF",                  "sector": "ETF", "industry": "Technology"},
    {"ticker": "CIBR", "name": "First Trust NASDAQ Cybersecurity ETF","sector": "ETF", "industry": "Technology"},
    # Bonds
    {"ticker": "TLT",  "name": "iShares 20+ Year Treasury Bond ETF",  "sector": "ETF", "industry": "Bonds"},
    {"ticker": "IEF",  "name": "iShares 7-10 Year Treasury Bond ETF", "sector": "ETF", "industry": "Bonds"},
    {"ticker": "SHY",  "name": "iShares 1-3 Year Treasury Bond ETF",  "sector": "ETF", "industry": "Bonds"},
    {"ticker": "HYG",  "name": "iShares iBoxx High Yield Corp Bond",  "sector": "ETF", "industry": "Bonds"},
    {"ticker": "LQD",  "name": "iShares iBoxx Invest Grade Corp Bond","sector": "ETF", "industry": "Bonds"},
    {"ticker": "BND",  "name": "Vanguard Total Bond Market ETF",      "sector": "ETF", "industry": "Bonds"},
    {"ticker": "AGG",  "name": "iShares Core US Aggregate Bond ETF",  "sector": "ETF", "industry": "Bonds"},
    # International
    {"ticker": "EFA",  "name": "iShares MSCI EAFE ETF",               "sector": "ETF", "industry": "International"},
    {"ticker": "EEM",  "name": "iShares MSCI Emerging Markets ETF",   "sector": "ETF", "industry": "International"},
    {"ticker": "VEA",  "name": "Vanguard FTSE Developed Markets ETF", "sector": "ETF", "industry": "International"},
    {"ticker": "VWO",  "name": "Vanguard FTSE Emerging Markets ETF",  "sector": "ETF", "industry": "International"},
    {"ticker": "ACWI", "name": "iShares MSCI ACWI ETF",               "sector": "ETF", "industry": "International"},
    # Commodities
    {"ticker": "GLD",  "name": "SPDR Gold Shares",                    "sector": "ETF", "industry": "Commodities"},
    {"ticker": "IAU",  "name": "iShares Gold Trust",                  "sector": "ETF", "industry": "Commodities"},
    {"ticker": "SLV",  "name": "iShares Silver Trust",                "sector": "ETF", "industry": "Commodities"},
    {"ticker": "GDX",  "name": "VanEck Gold Miners ETF",              "sector": "ETF", "industry": "Commodities"},
    {"ticker": "USO",  "name": "United States Oil Fund",              "sector": "ETF", "industry": "Commodities"},
    # Dividend / Factor
    {"ticker": "SCHD", "name": "Schwab US Dividend Equity ETF",       "sector": "ETF", "industry": "Dividend"},
    {"ticker": "VIG",  "name": "Vanguard Dividend Appreciation ETF",  "sector": "ETF", "industry": "Dividend"},
    {"ticker": "DVY",  "name": "iShares Select Dividend ETF",         "sector": "ETF", "industry": "Dividend"},
    {"ticker": "NOBL", "name": "ProShares S&P 500 Dividend Aristocrat","sector":"ETF", "industry": "Dividend"},
    # Real estate
    {"ticker": "VNQ",  "name": "Vanguard Real Estate ETF",            "sector": "ETF", "industry": "Real Estate"},
    # Crypto
    {"ticker": "IBIT", "name": "iShares Bitcoin Trust ETF",           "sector": "ETF", "industry": "Crypto"},
    {"ticker": "FBTC", "name": "Fidelity Wise Origin Bitcoin Fund",   "sector": "ETF", "industry": "Crypto"},
    {"ticker": "ETHA", "name": "iShares Ethereum Trust ETF",          "sector": "ETF", "industry": "Crypto"},
    # Leveraged
    {"ticker": "TQQQ", "name": "ProShares UltraPro QQQ",             "sector": "ETF", "industry": "Leveraged"},
    {"ticker": "SOXL", "name": "Direxion Daily Semiconductor Bull 3X","sector": "ETF", "industry": "Leveraged"},
    {"ticker": "UPRO", "name": "ProShares UltraPro S&P 500",         "sector": "ETF", "industry": "Leveraged"},
    # Volatility / Inverse
    {"ticker": "UVXY", "name": "ProShares Ultra VIX Short-Term",      "sector": "ETF", "industry": "Volatility"},
    {"ticker": "SQQQ", "name": "ProShares UltraPro Short QQQ",        "sector": "ETF", "industry": "Inverse"},
]

CUSTOM_TICKERS = [
    # US stocks not in S&P 500
    {"ticker": "HOOD",    "name": "Robinhood Markets Inc.",              "sector": "Financials",             "industry": "Capital Markets"},
    {"ticker": "RDDT",    "name": "Reddit Inc.",                         "sector": "Communication Services", "industry": "Interactive Media"},
    {"ticker": "CRWV",    "name": "CoreWeave Inc.",                      "sector": "Information Technology", "industry": "Cloud Computing"},
    {"ticker": "SOFI",    "name": "SoFi Technologies Inc.",              "sector": "Financials",             "industry": "Consumer Finance"},
    {"ticker": "RIVN",    "name": "Rivian Automotive Inc.",              "sector": "Consumer Discretionary", "industry": "Automobiles"},
    {"ticker": "CRCL",    "name": "Circle Internet Group",               "sector": "Financials",             "industry": "Financial Technology"},
    # US ETFs
    {"ticker": "MAGS",    "name": "Roundhill Magnificent Seven ETF",     "sector": "ETF",                    "industry": "Technology"},
    # Canadian ETFs (.TO suffix = TSX via yfinance)
    {"ticker": "VFV.TO",  "name": "Vanguard S&P 500 Index ETF (CAD)",    "sector": "ETF",                    "industry": "Broad Market"},
    {"ticker": "XQQ.TO",  "name": "iShares NASDAQ 100 Index ETF (CAD)",  "sector": "ETF",                    "industry": "Technology"},
    {"ticker": "XBM.TO",  "name": "iShares S&P/TSX Global Base Metals ETF", "sector": "ETF",               "industry": "Materials"},
    {"ticker": "HUG.TO",  "name": "Horizons US Dollar Currency ETF",     "sector": "ETF",                    "industry": "Currency"},
    {"ticker": "EBIT.TO", "name": "Evolve Bitcoin ETF",                  "sector": "ETF",                    "industry": "Crypto"},
    {"ticker": "ETHR.TO", "name": "Evolve Ethereum ETF",                 "sector": "ETF",                    "industry": "Crypto"},
    {"ticker": "SOLA.TO", "name": "Horizons Solar Energy ETF",           "sector": "ETF",                    "industry": "Renewable Energy"},
    {"ticker": "ETC.TO",  "name": "3iQ CoinShares Ether ETF",           "sector": "ETF",                    "industry": "Crypto"},
]

# ── In-memory cache ───────────────────────────────────────────────────────────

_cache: dict = {"data": [], "last_updated": None, "refreshing": False, "error": None}
_refresh_lock = threading.Lock()

CHUNK = 50  # tickers per yf.download batch

# ── Data helpers ──────────────────────────────────────────────────────────────

def _safe_float(val) -> Optional[float]:
    if val is None:
        return None
    try:
        f = float(val)
        return None if (math.isnan(f) or math.isinf(f)) else f
    except (TypeError, ValueError):
        return None


def _pct(new_val: float, old_val: float) -> Optional[float]:
    if new_val is None or old_val is None or old_val == 0:
        return None
    return round((new_val - old_val) / old_val * 100, 2)


def _fetch_sp500_list() -> list[dict]:
    """Scrape S&P 500 constituents from Wikipedia."""
    url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
    resp = requests.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
    soup = BeautifulSoup(resp.text, "html.parser")
    table = soup.find("table", {"id": "constituents"})
    if not table:
        raise RuntimeError("Could not find S&P 500 table on Wikipedia")
    stocks = []
    for row in table.find_all("tr")[1:]:
        cols = row.find_all("td")
        if len(cols) < 4:
            continue
        # Wikipedia uses dots (BRK.B); yfinance uses hyphens (BRK-B)
        ticker = cols[0].get_text(strip=True).replace(".", "-")
        stocks.append({
            "ticker": ticker,
            "name": cols[1].get_text(strip=True),
            "sector": cols[2].get_text(strip=True),
            "industry": cols[3].get_text(strip=True),
        })
    return stocks


def _batch_download(tickers: list[str], period: str, interval: str) -> dict[str, pd.DataFrame]:
    """Download OHLCV for tickers in chunks. Returns {ticker: flat DataFrame}."""
    result: dict[str, pd.DataFrame] = {}
    for i in range(0, len(tickers), CHUNK):
        chunk = tickers[i : i + CHUNK]
        try:
            raw = yf.download(
                chunk,
                period=period,
                interval=interval,
                auto_adjust=True,
                progress=False,
            )
            if raw.empty:
                continue
            if isinstance(raw.columns, pd.MultiIndex):
                # Multi-ticker: (PriceType, Ticker) MultiIndex
                for ticker in chunk:
                    try:
                        df = raw.xs(ticker, axis=1, level=1)
                        if not df.empty:
                            result[ticker] = df
                    except KeyError:
                        pass
            else:
                # Single ticker in chunk
                if len(chunk) == 1:
                    result[chunk[0]] = raw
        except Exception as exc:
            print(f"  batch_download chunk {i}: {exc}")
    return result


def _get_market_cap(ticker: str) -> Optional[float]:
    try:
        mc = yf.Ticker(ticker).fast_info.market_cap
        return _safe_float(mc)
    except Exception:
        return None


def _get_fundamentals(ticker: str) -> dict:
    out = {
        "pe_trailing": None, "pe_forward": None, "pb_ratio": None,
        "earnings_growth": None, "next_earnings": None,
    }
    try:
        tk = yf.Ticker(ticker)
        info = tk.info
        out["pe_trailing"]     = _safe_float(info.get("trailingPE"))
        out["pe_forward"]      = _safe_float(info.get("forwardPE"))
        out["pb_ratio"]        = _safe_float(info.get("priceToBook"))
        out["earnings_growth"] = _safe_float(info.get("earningsGrowth"))
        try:
            cal = tk.calendar
            if isinstance(cal, dict):
                dates = cal.get("Earnings Date") or []
                if dates:
                    d = dates[0]
                    date_str = d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d)[:10]
                    if date_str >= datetime.now(timezone.utc).strftime("%Y-%m-%d"):
                        out["next_earnings"] = date_str
        except Exception:
            pass
    except Exception:
        pass
    return out


def _compute_metrics(
    info: dict,
    daily: Optional[pd.DataFrame],
    weekly: Optional[pd.DataFrame],
    market_cap: Optional[float],
    fundamentals: Optional[dict] = None,
) -> dict:
    result = {
        "ticker": info["ticker"],
        "name": info["name"],
        "sector": info["sector"],
        "industry": info["industry"],
        "price": None,
        "change_1w": None,
        "change_1d": None,
        "change_90d": None,
        "change_180d": None,
        "change_52w": None,
        "change_ytd": None,
        "change_5y": None,
        "ath_drawdown": None,
        "ma_50d_pct": None,
        "ma_200d_pct": None,
        "ma_200w_pct": None,
        "market_cap": market_cap,
        "pe_trailing": None,
        "pe_forward": None,
        "pb_ratio": None,
        "earnings_growth": None,
        "next_earnings": None,
        "pe_vs_sector": None,
    }

    if daily is not None and "Close" in daily.columns:
        closes = daily["Close"].dropna()
        if len(closes) >= 2:
            current = float(closes.iloc[-1])
            result["price"] = round(current, 2)
            result["change_1d"] = _pct(current, float(closes.iloc[-2]))
            # ~1 week ≈ 5 trading days
            if len(closes) >= 6:
                result["change_1w"] = _pct(current, float(closes.iloc[-6]))
            # ~90 calendar days ≈ 63 trading days
            result["change_90d"] = _pct(current, float(closes.iloc[max(0, len(closes) - 63)]))
            # ~180 calendar days ≈ 126 trading days
            result["change_180d"] = _pct(current, float(closes.iloc[max(0, len(closes) - 126)]))
            # ~52 weeks ≈ 252 trading days
            result["change_52w"] = _pct(current, float(closes.iloc[max(0, len(closes) - 252)]))
            # YTD: first close on or after Jan 1 of current year
            try:
                idx_tz = daily.index.tz
                year_start = pd.Timestamp(f"{datetime.now().year}-01-01", tz=idx_tz)
                ytd_slice = daily["Close"][daily.index >= year_start].dropna()
                if len(ytd_slice) >= 1:
                    result["change_ytd"] = _pct(current, float(ytd_slice.iloc[0]))
            except Exception:
                pass
            # 50D and 200D moving averages
            if len(closes) >= 50:
                ma_50d = float(closes.iloc[-50:].mean())
                result["ma_50d_pct"] = round((current - ma_50d) / ma_50d * 100, 1)
            if len(closes) >= 200:
                ma_200d = float(closes.iloc[-200:].mean())
                result["ma_200d_pct"] = round((current - ma_200d) / ma_200d * 100, 1)

    if weekly is not None and result["price"] is not None:
        current = result["price"]
        if "High" in weekly.columns:
            highs = weekly["High"].dropna()
            if len(highs) > 0:
                ath = float(highs.max())
                result["ath_drawdown"] = round((current - ath) / ath * 100, 1)
        if "Close" in weekly.columns:
            w_closes = weekly["Close"].dropna()
            if len(w_closes) >= 200:
                ma_200w = float(w_closes.iloc[-200:].mean())
                result["ma_200w_pct"] = round((current - ma_200w) / ma_200w * 100, 1)
            # 5Y: first data point in the 5y weekly window
            if len(w_closes) >= 2:
                result["change_5y"] = _pct(current, float(w_closes.iloc[0]))

    if fundamentals:
        for k in ("pe_trailing", "pe_forward", "pb_ratio", "earnings_growth", "next_earnings"):
            result[k] = fundamentals.get(k)

    return result


# ── Background refresh ────────────────────────────────────────────────────────

def _blocking_refresh() -> None:
    """Full S&P 500 data refresh — runs in a thread executor."""
    with _refresh_lock:
        if _cache["refreshing"]:
            return
        _cache["refreshing"] = True

    try:
        print("SP500 refresh: fetching ticker list...")
        sp500_list = _fetch_sp500_list()
        if not sp500_list:
            _cache["error"] = "Failed to fetch S&P 500 list"
            return

        # Merge ETFs then custom tickers (deduplicate by ticker at each step)
        existing = {s["ticker"] for s in sp500_list}
        combined = sp500_list + [e for e in ETF_LIST if e["ticker"] not in existing]
        all_tickers = {s["ticker"] for s in combined}
        combined = combined + [c for c in CUSTOM_TICKERS if c["ticker"] not in all_tickers]
        print(f"SP500 refresh: {len(sp500_list)} stocks + {len(combined) - len(sp500_list)} ETFs/custom = {len(combined)} total")

        tickers = [s["ticker"] for s in combined]

        print("SP500 refresh: downloading 1y daily history...")
        daily = _batch_download(tickers, period="1y", interval="1d")
        print(f"  got {len(daily)} tickers")

        print("SP500 refresh: downloading 5y weekly history...")
        weekly = _batch_download(tickers, period="5y", interval="1wk")
        print(f"  got {len(weekly)} tickers")

        print("SP500 refresh: fetching market caps (parallel)...")
        market_caps: dict[str, Optional[float]] = {}
        with ThreadPoolExecutor(max_workers=10) as pool:
            futs = {pool.submit(_get_market_cap, t): t for t in tickers}
            for fut in as_completed(futs):
                market_caps[futs[fut]] = fut.result()
        print(f"  got {sum(1 for v in market_caps.values() if v)} market caps")

        print("SP500 refresh: fetching fundamentals (parallel)...")
        fundamentals: dict[str, dict] = {}
        fund_tickers = [s["ticker"] for s in combined if s["sector"] != "ETF"]
        with ThreadPoolExecutor(max_workers=10) as pool:
            futs = {pool.submit(_get_fundamentals, t): t for t in fund_tickers}
            for fut in as_completed(futs):
                fundamentals[futs[fut]] = fut.result()
        print(f"  got {sum(1 for v in fundamentals.values() if v.get('pe_trailing'))} PE ratios")
        print(f"  got {sum(1 for v in fundamentals.values() if v.get('next_earnings'))} earnings dates")

        print("SP500 refresh: computing metrics...")
        stocks = [
            _compute_metrics(
                info,
                daily.get(info["ticker"]),
                weekly.get(info["ticker"]),
                market_caps.get(info["ticker"]),
                fundamentals.get(info["ticker"]),
            )
            for info in combined
        ]
        stocks.sort(key=lambda x: x.get("market_cap") or 0, reverse=True)

        # Compute sector median P/E and flag each stock vs its peers
        sector_pe: dict[str, list] = {}
        for s in stocks:
            pe = s.get("pe_trailing")
            if s["sector"] and s["sector"] != "ETF" and pe and pe > 0:
                sector_pe.setdefault(s["sector"], []).append(pe)
        sector_medians = {sec: statistics.median(vals) for sec, vals in sector_pe.items() if vals}
        for s in stocks:
            med = sector_medians.get(s["sector"])
            pe = s.get("pe_trailing")
            if med and pe and pe > 0:
                s["pe_vs_sector"] = round(pe - med, 1)

        _cache["data"] = stocks
        _cache["last_updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        _cache["error"] = None
        print(f"SP500 refresh complete: {len(stocks)} stocks")

    except Exception as exc:
        _cache["error"] = str(exc)
        print(f"SP500 refresh error: {exc}")
    finally:
        _cache["refreshing"] = False


# ── App lifecycle ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _blocking_refresh)
    yield


app = FastAPI(title="SP500 Tracker API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ── S&P 500 endpoints ─────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/sp500")
def get_sp500():
    return {
        "data": _cache["data"],
        "last_updated": _cache["last_updated"],
        "refreshing": _cache["refreshing"],
        "count": len(_cache["data"]),
        "error": _cache["error"],
    }


@app.post("/sp500/refresh")
async def trigger_refresh():
    if _cache["refreshing"]:
        return {"status": "already_refreshing"}
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _blocking_refresh)
    return {"status": "started"}


@app.get("/earnings")
def get_earnings(days: int = 30):
    today = datetime.now(timezone.utc).date()
    cutoff = today + timedelta(days=days)
    result = []
    for s in _cache["data"]:
        ne = s.get("next_earnings")
        if not ne:
            continue
        try:
            ed = datetime.strptime(ne, "%Y-%m-%d").date()
            if today <= ed <= cutoff:
                result.append({**s, "days_until": (ed - today).days})
        except ValueError:
            pass
    result.sort(key=lambda x: x["next_earnings"])
    return {"data": result, "count": len(result)}


# ── Per-ticker endpoints (kept for ChartModal) ────────────────────────────────

PERIOD_INTERVAL_MAP = {
    "1d":  "5m",
    "5d":  "30m",
    "ytd": "1d",
    "1mo": "1d",
    "3mo": "1d",
    "6mo": "1d",
    "1y":  "1d",
    "5y":  "1d",
}

INTRADAY_INTERVALS = {"5m", "30m"}


def _build_quote(ticker: str) -> dict:
    fi = yf.Ticker(ticker).fast_info
    price = _safe_float(fi.last_price)
    prev_close = _safe_float(fi.previous_close)
    change_pct = None
    if price is not None and prev_close and prev_close != 0:
        change_pct = round((price - prev_close) / prev_close * 100, 2)
    mc = fi.market_cap
    return {
        "ticker": ticker.upper(),
        "price": price,
        "prev_close": prev_close,
        "change_pct": change_pct,
        "day_high": _safe_float(fi.day_high),
        "day_low": _safe_float(fi.day_low),
        "volume": int(fi.last_volume) if fi.last_volume else None,
        "market_cap": int(mc) if mc and not math.isnan(float(mc)) else None,
    }


@app.get("/quote/{ticker}")
def get_quote(ticker: str):
    ticker = ticker.upper().strip()
    try:
        return _build_quote(ticker)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Could not fetch {ticker}: {exc}")


@app.get("/quotes/batch")
def get_batch_quotes(tickers: str = Query(..., description="Comma-separated tickers")):
    ticker_list = [t.strip().upper() for t in tickers.split(",") if t.strip()]
    if not ticker_list:
        raise HTTPException(status_code=400, detail="No tickers provided")
    results = []
    for ticker in ticker_list:
        try:
            results.append(_build_quote(ticker))
        except Exception as exc:
            results.append({"ticker": ticker, "error": str(exc)})
    return {"quotes": results}


@app.get("/history/{ticker}")
def get_history(ticker: str, period: str = "1mo"):
    ticker = ticker.upper().strip()
    if period not in PERIOD_INTERVAL_MAP:
        raise HTTPException(status_code=400, detail=f"Invalid period. Choose from: {list(PERIOD_INTERVAL_MAP)}")
    interval = PERIOD_INTERVAL_MAP[period]
    try:
        hist = yf.Ticker(ticker).history(period=period, interval=interval)
        if hist.empty:
            raise HTTPException(status_code=404, detail=f"No data for {ticker}")

        # Compute 50D/200D MAs from daily closes. Reuse hist when it already has
        # enough daily data (5y view ~1260 bars); otherwise fetch 1y separately.
        ma_50_by_date: dict = {}
        ma_200_by_date: dict = {}
        if interval not in INTRADAY_INTERVALS:
            hist_d = hist if (interval == "1d" and len(hist) >= 1000) else yf.Ticker(ticker).history(period="5y", interval="1d")
            if not hist_d.empty and "Close" in hist_d.columns:
                d_closes = hist_d["Close"].dropna()
                ma_50_s  = d_closes.rolling(50).mean().dropna()
                ma_200_s = d_closes.rolling(200).mean().dropna()
                ma_50_by_date  = {ts.strftime("%Y-%m-%d"): float(v) for ts, v in ma_50_s.items()}
                ma_200_by_date = {ts.strftime("%Y-%m-%d"): float(v) for ts, v in ma_200_s.items()}

        records = []
        for idx, row in hist.iterrows():
            date_str = (
                idx.tz_convert("America/New_York").strftime("%Y-%m-%dT%H:%M:%S")
                if interval in INTRADAY_INTERVALS
                else idx.strftime("%Y-%m-%d")
            )
            date_key  = idx.strftime("%Y-%m-%d")
            ma50_val  = _safe_float(ma_50_by_date.get(date_key))
            ma200_val = _safe_float(ma_200_by_date.get(date_key))
            records.append({
                "date":   date_str,
                "open":   _safe_float(row["Open"]),
                "high":   _safe_float(row["High"]),
                "low":    _safe_float(row["Low"]),
                "close":  _safe_float(row["Close"]),
                "volume": int(row["Volume"]) if not pd.isna(row["Volume"]) else None,
                "ma_50":  ma50_val,
                "ma_200": ma200_val,
            })
        return {"ticker": ticker, "period": period, "data": records}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
