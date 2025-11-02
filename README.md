## Kalshi Career Summary (Wrapped)

An elegant, dark-mode-only Next.js app that generates a personalized “Wrapped” for your Kalshi trading history. It’s read‑only: it fetches your portfolio data (balances, positions, fills, settlements) and derives trades and insights like biggest win, biggest loss, longshots, favorites, missed opportunities, and totals.

The project also exposes clean API routes under `app/api/portfolio/` that demonstrate how to access your own account data via Kalshi’s Trade API using RSA-PSS request signing.

### Features
- **Dark-only UI**: Clean, minimal, sleek — no light theme.
- **Read-only**: No order placement or cancellation.
- **Local API**: Access your balance, positions, fills, settlements, and derived trades.
- **Wrapped slideshow**: Build a shareable view of your year/period on Kalshi.

---

## Quick Start

Prereqs: Node 18+ and Yarn, a Kalshi API Key ID and Private Key.

1) Install
```bash
yarn install
```

2) Environment
Create `.env.local` in the project root (see `.env.example`):
```env
PROD_KEY_ID=your_kalshi_api_key_id
KALSHI_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```
- `PROD_KEY_ID`: Your Kalshi API Key ID
- `KALSHI_KEY`: Your Kalshi private key. You can paste as a single line with `\n` escapes or the full multi‑line PEM; both are supported.

3) Run
```bash
yarn dev
```
Open `http://localhost:3000`.

---

## Portfolio API (app/api/portfolio)

These routes proxy authenticated calls to Kalshi and return JSON. All are read‑only and scoped to your credentials from `.env.local`.

- `GET /api/portfolio/balance`
  - Returns your current portfolio balance.

- `GET /api/portfolio/positions`
  - Query params:
    - `limit` (1–1000)
    - `cursor`
    - `settlement_status` one of `all|unsettled|settled`
    - `count_filter` comma‑separated from `position,total_traded,resting_order_count`
    - `ticker`, `event_ticker`

- `GET /api/portfolio/fills`
  - Query params: `limit` (1–1000), `cursor`

- `GET /api/portfolio/settlements`
  - Query params: `cursor`
  - Filters out ambiguous equal yes/no settlements for cleanliness.

- `GET /api/portfolio/trades`
  - Derives trades from fills + settlements, enriched with market metadata.
  - Query params: `limit` (1–1000) for fills fetch.

Example usage:
```bash
curl -s localhost:3000/api/portfolio/balance | jq
curl -s "localhost:3000/api/portfolio/positions?limit=50&settlement_status=all" | jq
curl -s localhost:3000/api/portfolio/fills | jq
curl -s localhost:3000/api/portfolio/settlements | jq
curl -s localhost:3000/api/portfolio/trades | jq
```

---

## Wrapped API (app/api/wrapped)

`GET /api/wrapped` builds the slides for the UI (non‑streaming). `GET /api/wrapped?stream=1` streams progress Server‑Sent Events while computing. Both versions fetch your fills, settlements, events, build derived trades, compute metrics, and return a compact payload consumed by the front‑end components.

---

## Security & Privacy
- The app is read‑only and does not send your credentials anywhere except directly to Kalshi’s API from the server.
- Secrets are read from environment variables. Do not commit `.env.local` (already git‑ignored).

---

## Development
- UI is minimal, modern, and dark-only.
- Use Yarn for scripts:
  - `yarn dev` — run locally
  - `yarn build` — production build
  - `yarn start` — start production server

---

## License
MIT — see `LICENSE`.
