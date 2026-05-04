# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Environment

Python 3.11 project with a virtual environment at `.venv/`.

```bash
source .venv/bin/activate   # activate venv
python src/main.py          # run app (once created)
```

## Stack

The installed packages indicate the intended architecture:

| Library | Purpose |
|---|---|
| `yfinance` | Fetch stock quotes, history, and metadata from Yahoo Finance |
| `peewee` + `playhouse` | SQLite ORM for persisting portfolio and price history |
| `pandas` + `numpy` | Data manipulation and time-series analysis |
| `matplotlib` + `seaborn` | Charting and visualization |
| `rich` | Terminal UI / pretty-printed output |
| `websockets` | Real-time price streaming |
| `requests` + `curl_cffi` | HTTP requests (curl_cffi supports TLS fingerprint bypass) |
| `bs4` (BeautifulSoup) | HTML scraping fallback |

## Project Layout

Source code lives in `src/`. No modules exist yet.
