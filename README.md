## Quick Start

Prereqs: Node 18+ and Yarn, plus a Kalshi API Key ID and Private Key.

1) Install
```bash
yarn install
```

2) Environment
Create `.env.local` in the project root:
```env
PROD_KEY_ID=your_kalshi_api_key_id
KALSHI_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```
- `PROD_KEY_ID`: Kalshi API Key ID
- `KALSHI_KEY`: Your Kalshi private key (single line with `\n` or full PEM)

3) Run
```bash
yarn dev
```
Open `http://localhost:3000`.

---

## API

### Portfolio

- `GET /api/portfolio/balance`: current portfolio balance

- `GET /api/portfolio/positions`
  - Query:
    - `limit` (1–1000)
    - `cursor`
    - `settlement_status`: `all|unsettled|settled`
    - `count_filter`: comma‑separated from `position,total_traded,resting_order_count`
    - `ticker`, `event_ticker`

- `GET /api/portfolio/fills`
  - Query: `limit` (1–1000), `cursor`

- `GET /api/portfolio/settlements`
  - Query: `cursor`
  - Note: ambiguous equal yes/no settlements are filtered out

- `GET /api/portfolio/trades`
  - Derives trades from fills + settlements, enriched with market metadata
  - Query: `limit` (1–1000) for fills fetch

Examples:
```bash
curl -s localhost:3000/api/portfolio/balance | jq
curl -s "localhost:3000/api/portfolio/positions?limit=50&settlement_status=all" | jq
curl -s localhost:3000/api/portfolio/fills | jq
curl -s localhost:3000/api/portfolio/settlements | jq
curl -s localhost:3000/api/portfolio/trades | jq
```

### Wrapped

- `GET /api/wrapped`: returns the compiled payload used by the UI
- `GET /api/wrapped?stream=1`: streams Server‑Sent Events while computing

---

## License
MIT — see `LICENSE`.
