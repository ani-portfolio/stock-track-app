# SP500 Tracker

A personal stock price tracker. Add S&P 500 tickers to a watchlist (stored in localStorage) and view live quotes and interactive price history charts.

**Stack:** FastAPI + yfinance (backend) · React + Vite + Recharts (frontend)  
**Deployed to:** Render (backend) · Vercel (frontend)

---

## Local Development

### Backend

```bash
cd sp500-tracker/backend
source ../../.venv/bin/activate
pip install -r requirements.txt
python main.py
```

API runs at `http://localhost:8000`.  
Interactive docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd sp500-tracker/frontend
npm install
cp .env.example .env.local
# .env.local already points to http://localhost:8000 — no edits needed for local dev
npm run dev
```

App runs at `http://localhost:5173`.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/quote/{ticker}` | Single ticker quote |
| GET | `/quotes/batch?tickers=A,B,C` | Batch quotes for watchlist |
| GET | `/history/{ticker}?period=1mo` | Price history (periods: `1d` `5d` `1mo` `3mo` `6mo` `1y`) |

---

## Deploying to Render (Backend)

1. Push this repo to GitHub.
2. Go to [render.com](https://render.com) → **New Web Service** → connect your repo.
3. Set **Root Directory** to `sp500-tracker/backend`.
4. Render will detect `render.yaml` automatically. Confirm:
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Environment:** Python 3
5. Click **Create Web Service**. Copy the deployed URL (e.g. `https://sp500-tracker-api.onrender.com`).

> **Note:** The free tier spins down after 15 minutes of inactivity. The first request after a cold start takes ~30 seconds.

---

## Deploying to Vercel (Frontend)

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your repo.
2. Set **Root Directory** to `sp500-tracker/frontend`.
3. Vercel auto-detects Vite. Confirm **Output Directory** is `dist`.
4. Under **Environment Variables**, add:
   ```
   VITE_API_URL = https://your-render-service.onrender.com
   ```
   (no trailing slash)
5. Click **Deploy**.

Alternatively, deploy from the CLI:

```bash
cd sp500-tracker/frontend
npx vercel --prod
```

Then set `VITE_API_URL` in the Vercel dashboard and redeploy.
