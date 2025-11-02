import type { KalshiFillItem, KalshiSettlementItem, KalshiMarket } from "@/lib/kalshi/types"

export interface Trade {
  side: string
  market: KalshiMarket
  buy_size: number
  buy_price: number
  buy_timestamp: string
  sell_price?: number
  sell_size?: number
  settle_size?: number
  timestamp: string
  settled?: boolean
  sold?: boolean
}

interface BuyLot {
  ticker: string
  side: string
  remaining: number
  price: number
  created_time: string
}

const getPriceFromFill = (fill: KalshiFillItem): number => {
  if (typeof fill.yes_price === "number") return fill.yes_price
  if (typeof fill.no_price === "number") return fill.no_price
  if (typeof fill.price === "number") return fill.price
  return 0
}

const keyFor = (ticker: string, side: string) => `${ticker}:${side}`

const oppositeSide = (side: string): string => (side === "yes" ? "no" : "yes")

const normalizeBuyPrice = (side: string, price: number): number => (side === "no" ? 100 - price : price)

function pairBuysAndSells(
  fillsSorted: KalshiFillItem[],
): {
  trades: (Omit<Trade, "market"> & { ticker: string })[]
  buyQueues: Map<string, BuyLot[]>
} {
  const buyQueues = new Map<string, BuyLot[]>()
  const trades: (Omit<Trade, "market"> & { ticker: string })[] = []

  for (const fill of fillsSorted) {
    const price = getPriceFromFill(fill)

    if (fill.action === "buy") {
      const k = keyFor(fill.ticker, fill.side)
      if (!buyQueues.has(k)) buyQueues.set(k, [])
      const queue = buyQueues.get(k)!
      queue.push({
        ticker: fill.ticker,
        side: fill.side,
        remaining: fill.count,
        price,
        created_time: fill.created_time,
      })
      continue
    }

    if (fill.action === "sell") {
      // Cross-side pairing: sells consume buys from the opposite side
      const k = keyFor(fill.ticker, oppositeSide(fill.side))
      if (!buyQueues.has(k)) buyQueues.set(k, [])
      const queue = buyQueues.get(k)!
      let toSell = fill.count
      while (toSell > 0 && queue.length > 0) {
        const lot = queue[0]
        const matched = Math.min(lot.remaining, toSell)
        if (matched <= 0) break

        trades.push({
          ticker: lot.ticker,
          side: lot.side,
          buy_size: matched,
          buy_price: normalizeBuyPrice(lot.side, lot.price),
          buy_timestamp: lot.created_time,
          // Normalize sell price to the side of the original buy so PnL is correct
          sell_price: normalizeBuyPrice(lot.side, price),
          sell_size: matched,
          settle_size: 0,
          timestamp: fill.created_time,
          settled: false,
          sold: true,
        })

        lot.remaining -= matched
        toSell -= matched
        if (lot.remaining === 0) queue.shift()
      }
      continue
    }
  }

  return { trades, buyQueues }
}

export async function buildTradesFromFillsAndSettlements(
  fills: KalshiFillItem[],
  settlements: KalshiSettlementItem[],
  getMarketByTicker: (ticker: string) => Promise<KalshiMarket>,
): Promise<Trade[]> {
  const fillsSorted = [...fills].sort((a, b) => {
    const timeDelta =
      new Date(a.created_time).getTime() - new Date(b.created_time).getTime()
    if (timeDelta !== 0) return timeDelta
    if (a.action === b.action) return 0
    // Ensure buys are processed before sells when timestamps are equal
    return a.action === "buy" ? -1 : 1
  })

  const { trades, buyQueues } = pairBuysAndSells(fillsSorted)

  // Ignore settlements where yes and no counts are equal (position was fully sold out)
  const filteredSettlements = settlements.filter((s) => s.yes_count !== s.no_count)
  const settlementsByTicker = new Map<string, KalshiSettlementItem>()
  for (const s of filteredSettlements) settlementsByTicker.set(s.ticker, s)

  for (const [k, queue] of buyQueues.entries()) {
    if (queue.length === 0) continue
    const [ticker, side] = k.split(":")
    const settlement = settlementsByTicker.get(ticker)
    if (!settlement) continue

    let sideCount = side === "yes" ? settlement.yes_count : settlement.no_count
    if (!sideCount || sideCount <= 0) continue

    for (const lot of queue) {
      if (sideCount <= 0) break
      const matched = Math.min(lot.remaining, sideCount)
      if (matched <= 0) continue
      trades.push({
        ticker: lot.ticker,
        side: lot.side,
        buy_size: matched,
        buy_price: normalizeBuyPrice(lot.side, lot.price),
        buy_timestamp: lot.created_time,
        settle_size: matched,
        sell_size: 0,
        timestamp: settlement.settled_time,
        settled: true,
        sold: false,
      })
      sideCount -= matched
      lot.remaining -= matched
    }
  }

  const uniqueTickers = Array.from(new Set(trades.map((t) => t.ticker)))
  const markets = await Promise.all(uniqueTickers.map((ticker) => getMarketByTicker(ticker)))
  const marketCache = new Map<string, KalshiMarket>(
    uniqueTickers.map((ticker, idx) => [ticker, markets[idx]] as const),
  )

  return trades.map((t) => ({
    side: t.side,
    market: marketCache.get(t.ticker)!,
    buy_size: t.buy_size,
    buy_price: t.buy_price,
    buy_timestamp: t.buy_timestamp,
    sell_price: t.sell_price,
    sell_size: t.sell_size && t.sell_size > 0 ? t.sell_size : undefined,
    settle_size: t.settle_size && t.settle_size > 0 ? t.settle_size : undefined,
    timestamp: t.timestamp,
    settled: t.settled || undefined,
    sold: t.sold || undefined,
  }))
}


