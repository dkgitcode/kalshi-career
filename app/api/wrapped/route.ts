import { NextResponse } from "next/server"

import { getKalshiClient } from "@/lib/kalshi/client"
import type { KalshiFillsResponse, KalshiMarket, KalshiSettlementItem } from "@/lib/kalshi/types"
import { buildTradesFromFillsAndSettlements, type Trade } from "@/lib/portfolio/trades"

type PricePoint = { ts: number; price: number }
type TradeMarkers = {
  buy_ts: number
  buy_price: number
  sell_ts?: number
  sell_price?: number
  settled_ts?: number
  settled_price?: number
}

type WrappedSlide =
  | { type: "biggest_win"; pct: number; realized_pnl_cents: number; trade: Trade; series: PricePoint[]; markers: TradeMarkers }
  | { type: "biggest_loss"; loss_cents: number; realized_pnl_cents: number; trade: Trade; series: PricePoint[]; markers: TradeMarkers }
  | { type: "biggest_longshot"; buy_price: number; pct: number; trade: Trade; series: PricePoint[]; markers: TradeMarkers }
  | { type: "favorite_genre"; category: string; count: number }
  | {
      type: "missed_opportunity"
      trade: Trade
      best_after_sell_price: number
      best_after_sell_ts: number
      potential_gain_cents: number
      series: PricePoint[]
      markers: TradeMarkers
    }
  | {
      type: "totals"
      total_volume: number
      total_realized_pnl_cents: number
      favorite_category?: string
      favorite_count?: number
      biggest_win_pnl_cents?: number
      biggest_loss_cents?: number
      win_rate_pct?: number
      wins?: number
      total_trades?: number
      first_trade_ts?: number
    }

const toUnixSeconds = (dateString: string): number => Math.floor(new Date(dateString).getTime() / 1000)

function priceForSideFromYesPrice(yesPrice: number, side: string): number {
  return side === "yes" ? yesPrice : 100 - yesPrice
}

function computeTradeRealizedPnlCents(t: Trade, marketResult?: string | null): number {
  // Sold trades
  if (t.sold && typeof t.sell_price === "number" && typeof t.sell_size === "number") {
    return Math.round((t.sell_price - t.buy_price) * t.sell_size)
  }
  // Settled trades (binary only)
  if (t.settled && typeof t.settle_size === "number") {
    if (marketResult === "yes" || marketResult === "no") {
      const payout = marketResult === t.side ? 100 : 0
      return Math.round((payout - t.buy_price) * t.settle_size)
    }
  }
  return 0
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const isStream = url.searchParams.get("stream") === "1"

  if (isStream) {
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, payload: any) => {
          try {
            controller.enqueue(encoder.encode(`event: ${event}\n`))
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
          } catch {}
        }

        try {
          send("log", { message: "@wrapped/api: GET start" })
          const client = getKalshiClient()

          const [fillsRes, settlementsRes] = await Promise.all([
            client.getFills({ limit: 1000 }),
            client.getPortfolioSettlements(),
          ])
          send("log", { message: "portfolio fetched", fills: fillsRes.fills?.length || 0, settlements: settlementsRes.settlements?.length || 0 })

          const fills: KalshiFillsResponse["fills"] = fillsRes.fills || []
          const settlements: KalshiSettlementItem[] = settlementsRes.settlements || []

          const marketResultByTicker = new Map<string, string>()
          const settlementTimeByTicker = new Map<string, string>()
          for (const s of settlements) {
            marketResultByTicker.set(s.ticker, s.market_result)
            settlementTimeByTicker.set(s.ticker, s.settled_time)
          }

          const trades: Trade[] = await buildTradesFromFillsAndSettlements(
            fills,
            settlements,
            (ticker) => client.getMarket(ticker),
          )
          send("log", { message: "trades built", trades: trades.length })

          const uniqueEventTickers = Array.from(
            new Set(
              trades
                .map((t) => t.market.event_ticker)
                .filter((et): et is string => Boolean(et)),
            ),
          )
          const eventByTicker = new Map<string, Awaited<ReturnType<typeof client.getEvent>>>()
          await Promise.all(
            uniqueEventTickers.map(async (et) => {
              try {
                const evt = await client.getEvent(et)
                eventByTicker.set(et, evt)
              } catch (e) {
                // non-fatal
              }
            }),
          )
          send("log", { message: "events fetched", uniqueEvents: uniqueEventTickers.length })

          const totalVolume = fills.filter((f) => f.action === "buy").reduce((acc, f) => acc + (f.count || 0), 0)
          const realizedByTrade = trades.map((t) => computeTradeRealizedPnlCents(t, marketResultByTicker.get(t.market.ticker)))
          const totalRealizedPnlCents = realizedByTrade.reduce((acc, v) => acc + v, 0)
          const totalTrades = trades.length
          const wins = realizedByTrade.reduce((acc, v) => acc + (v > 0 ? 1 : 0), 0)
          const winRatePct = totalTrades > 0 ? (wins / totalTrades) * 100 : 0
          send("log", { message: "totals computed", totalVolume, totalRealizedPnlCents, totalTrades, wins, winRatePct: Number(winRatePct.toFixed(2)) })

          const firstTradeTs = trades.length
            ? Math.min(
                ...trades
                  .map((t) => {
                    try { return toUnixSeconds(t.buy_timestamp) } catch { return Infinity }
                  })
                  .filter((v) => Number.isFinite(v)),
              )
            : undefined

          async function buildSeriesForTrade(t: Trade, endTs?: number): Promise<{ series: PricePoint[]; markers: TradeMarkers }> {
            const buyTs = toUnixSeconds(t.buy_timestamp)
            const sellTs = t.sold ? toUnixSeconds(t.timestamp) : undefined
            const settledTsStr = settlementTimeByTicker.get(t.market.ticker)
            const settledTs = settledTsStr ? toUnixSeconds(settledTsStr) : undefined
            const marketResult = marketResultByTicker.get(t.market.ticker)
            const payout = marketResult === "yes" || marketResult === "no" ? (marketResult === t.side ? 100 : 0) : undefined

            const resolvedEndTs = typeof endTs === "number" ? endTs : (settledTs ?? sellTs ?? Math.floor(Date.now() / 1000))
            const { candlesticks } = await client.getCandlesticks(t.market.ticker, {
              start_ts: buyTs,
              end_ts: resolvedEndTs,
            })
            const raw = candlesticks.map((c) => ({
              ts: c.end_period_ts,
              price: c.price?.close ?? c.price?.mean ?? c.price?.previous ?? 0,
            }))
            const series = raw.map((p) => ({ ts: p.ts, price: priceForSideFromYesPrice(p.price, t.side) }))

            const markers: TradeMarkers = {
              buy_ts: buyTs,
              buy_price: t.buy_price,
              sell_ts: sellTs,
              sell_price: t.sell_price,
              settled_ts: settledTs,
              settled_price: typeof payout === "number" ? priceForSideFromYesPrice(payout, t.side) : undefined,
            }

            return { series, markers }
          }

          type WinCandidate = { trade: Trade; realized_cents: number; pct: number }
          const winCandidates: WinCandidate[] = []
          for (const t of trades) {
            const realized = computeTradeRealizedPnlCents(t, marketResultByTicker.get(t.market.ticker))
            if (realized <= 0) continue
            let pct: number | null = null
            if (t.sold && typeof t.sell_price === "number" && t.buy_price > 0) {
              pct = ((t.sell_price - t.buy_price) / t.buy_price) * 100
            } else if (t.settled && t.buy_price > 0) {
              const res = marketResultByTicker.get(t.market.ticker)
              if (res === "yes" || res === "no") {
                const payout = res === t.side ? 100 : 0
                pct = ((payout - t.buy_price) / t.buy_price) * 100
              }
            }
            if (pct === null || !Number.isFinite(pct)) pct = 0
            winCandidates.push({ trade: t, realized_cents: realized, pct })
          }
          let biggestWin: { pct: number; trade: Trade; realized_pnl_cents: number } | null = null
          if (winCandidates.length > 0) {
            const maxProfit = Math.max(...winCandidates.map((c) => c.realized_cents))
            const maxPct = Math.max(...winCandidates.map((c) => c.pct))
            const W_PROFIT = 0.6
            const W_PCT = 0.4
            let best: { cand: WinCandidate; score: number } | null = null
            for (const cand of winCandidates) {
              const profitNorm = maxProfit > 0 ? cand.realized_cents / maxProfit : 0
              const pctNorm = maxPct > 0 ? cand.pct / maxPct : 0
              const score = W_PROFIT * profitNorm + W_PCT * pctNorm
              if (!best || score > best.score) best = { cand, score }
            }
            if (best) {
              biggestWin = { pct: best.cand.pct, trade: best.cand.trade, realized_pnl_cents: best.cand.realized_cents }
            }
          }
          send("log", { message: "biggest win computed", hasBiggestWin: Boolean(biggestWin) })

          let biggestLoss: { loss_cents: number; realized_pnl_cents: number; trade: Trade } | null = null
          for (const t of trades) {
            const pnl = computeTradeRealizedPnlCents(t, marketResultByTicker.get(t.market.ticker))
            if (pnl < 0) {
              const loss = Math.abs(pnl)
              if (!biggestLoss || loss > biggestLoss.loss_cents) biggestLoss = { loss_cents: loss, realized_pnl_cents: pnl, trade: t }
            }
          }
          send("log", { message: "biggest loss computed", hasBiggestLoss: Boolean(biggestLoss) })

          let biggestLongshot: { buy_price: number; trade: Trade } | null = null
          for (const t of trades) {
            const pnl = computeTradeRealizedPnlCents(t, marketResultByTicker.get(t.market.ticker))
            if (t.settled && !t.sold && pnl > 0) {
              if (!biggestLongshot || t.buy_price < biggestLongshot.buy_price) {
                biggestLongshot = { buy_price: t.buy_price, trade: t }
              }
            }
          }
          send("log", { message: "biggest longshot computed", hasBiggestLongshot: Boolean(biggestLongshot) })

          const categoryCount = new Map<string, number>()
          for (const t of trades) {
            const evt = eventByTicker.get(t.market.event_ticker)
            const cat = evt?.category || "Other"
            categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1)
          }
          let favoriteGenre: { category: string; count: number } = { category: "Other", count: 0 }
          for (const [cat, count] of categoryCount) {
            if (count > favoriteGenre.count) favoriteGenre = { category: cat, count }
          }
          send("log", { message: "favorite genre computed", favoriteGenre })

          const soldTrades = trades
            .filter((t) => t.sold && typeof t.sell_price === "number" && typeof t.sell_size === "number" && t.sell_size > 0)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 25)

          let missed: {
            trade: Trade
            best_after_sell_price: number
            best_after_sell_ts: number
            potential_gain_cents: number
            series: { ts: number; price: number }[]
            markers: TradeMarkers
          } | null = null

          const nowSec = Math.floor(Date.now() / 1000)
          for (const t of soldTrades) {
            const buyTs = toUnixSeconds(t.buy_timestamp)
            const sellTs = toUnixSeconds(t.timestamp)
            const settledTsStr = settlementTimeByTicker.get(t.market.ticker)
            const end = settledTsStr ? toUnixSeconds(settledTsStr) : Math.max(sellTs + 60, nowSec)
            const { candlesticks } = await client.getCandlesticks(t.market.ticker, {
              start_ts: buyTs,
              end_ts: end,
            })
            const raw = candlesticks.map((c) => ({
              ts: c.end_period_ts,
              price: c.price?.close ?? c.price?.mean ?? c.price?.previous ?? 0,
            }))
            const sideSeries = raw.map((p) => ({ ts: p.ts, price: priceForSideFromYesPrice(p.price, t.side) }))

            let bestAfterPrice = t.sell_price!
            let bestAfterTs = sellTs
            for (const p of sideSeries) {
              if (p.ts > sellTs && p.price > bestAfterPrice) {
                bestAfterPrice = p.price
                bestAfterTs = p.ts
              }
            }

            const potentialGain = Math.max(0, (bestAfterPrice - t.sell_price!) * t.sell_size!)
            if (potentialGain > 0 && (!missed || potentialGain > missed.potential_gain_cents)) {
              const marketResult = marketResultByTicker.get(t.market.ticker)
              const payout = marketResult === "yes" || marketResult === "no" ? (marketResult === t.side ? 100 : 0) : undefined
              missed = {
                trade: t,
                best_after_sell_price: bestAfterPrice,
                best_after_sell_ts: bestAfterTs,
                potential_gain_cents: Math.round(potentialGain),
                series: sideSeries,
                markers: {
                  buy_ts: buyTs,
                  buy_price: t.buy_price,
                  sell_ts: sellTs,
                  sell_price: t.sell_price,
                  settled_ts: settledTsStr ? toUnixSeconds(settledTsStr) : undefined,
                  settled_price: typeof payout === "number" ? priceForSideFromYesPrice(payout, t.side) : undefined,
                },
              }
            }
          }
          send("log", { message: "missed opportunity computed", hasMissed: Boolean(missed) })

          const slides: WrappedSlide[] = []
          if (biggestWin) {
            const { series, markers } = await buildSeriesForTrade(biggestWin.trade)
            slides.push({ type: "biggest_win", pct: biggestWin.pct, realized_pnl_cents: biggestWin.realized_pnl_cents, trade: biggestWin.trade, series, markers })
            send("log", { message: "slide added", type: "biggest_win" })
          }
          if (biggestLoss) {
            const { series, markers } = await buildSeriesForTrade(biggestLoss.trade)
            slides.push({ type: "biggest_loss", loss_cents: biggestLoss.loss_cents, realized_pnl_cents: biggestLoss.realized_pnl_cents, trade: biggestLoss.trade, series, markers })
            send("log", { message: "slide added", type: "biggest_loss" })
          }
          if (biggestLongshot) {
            const { series, markers } = await buildSeriesForTrade(biggestLongshot.trade)
            let pctLs = 0
            {
              const t = biggestLongshot.trade
              const res = marketResultByTicker.get(t.market.ticker)
              if (res === "yes" || res === "no") {
                const payout = res === t.side ? 100 : 0
                if (t.buy_price > 0) pctLs = ((payout - t.buy_price) / t.buy_price) * 100
              }
            }
            slides.push({ type: "biggest_longshot", buy_price: biggestLongshot.buy_price, pct: pctLs, trade: biggestLongshot.trade, series, markers })
            send("log", { message: "slide added", type: "biggest_longshot" })
          }
          if (favoriteGenre.count > 0) {
            slides.push({ type: "favorite_genre", category: favoriteGenre.category, count: favoriteGenre.count })
            send("log", { message: "slide added", type: "favorite_genre" })
          }
          if (missed) {
            slides.push({ type: "missed_opportunity", ...missed })
            send("log", { message: "slide added", type: "missed_opportunity" })
          }
          slides.push({
            type: "totals",
            total_volume: totalVolume,
            total_realized_pnl_cents: totalRealizedPnlCents,
            favorite_category: favoriteGenre.category,
            favorite_count: favoriteGenre.count,
            biggest_win_pnl_cents: biggestWin?.realized_pnl_cents,
            biggest_loss_cents: biggestLoss?.loss_cents,
            win_rate_pct: winRatePct,
            wins,
            total_trades: totalTrades,
            first_trade_ts: Number.isFinite(firstTradeTs as number) ? (firstTradeTs as number) : undefined,
          })
          send("log", { message: "slide added", type: "totals" })

          send("done", { slides })
        } catch (error) {
          send("error", { message: "Failed to build wrapped", detail: String(error) })
        } finally {
          try { controller.close() } catch {}
        }
      },
    })
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    })
  }

  try {
    console.log("@wrapped/api: GET start")
    const client = getKalshiClient()

    const [fillsRes, settlementsRes] = await Promise.all([
      client.getFills({ limit: 1000 }),
      client.getPortfolioSettlements(),
    ])
    console.log("@wrapped/api: fetched portfolio data", { fills: fillsRes.fills?.length || 0, settlements: settlementsRes.settlements?.length || 0 })

    const fills: KalshiFillsResponse["fills"] = fillsRes.fills || []
    const settlements: KalshiSettlementItem[] = settlementsRes.settlements || []

    const marketResultByTicker = new Map<string, string>()
    const settlementTimeByTicker = new Map<string, string>()
    for (const s of settlements) {
      marketResultByTicker.set(s.ticker, s.market_result)
      settlementTimeByTicker.set(s.ticker, s.settled_time)
    }

    const trades: Trade[] = await buildTradesFromFillsAndSettlements(
      fills,
      settlements,
      (ticker) => client.getMarket(ticker),
    )
    console.log("@wrapped/api: built trades", { trades: trades.length })

    // Fetch events for all traded markets to derive category from the event
    const uniqueEventTickers = Array.from(
      new Set(
        trades
          .map((t) => t.market.event_ticker)
          .filter((et): et is string => Boolean(et)),
      ),
    )
    const eventByTicker = new Map<string, Awaited<ReturnType<typeof client.getEvent>>>()
    await Promise.all(
      uniqueEventTickers.map(async (et) => {
        try {
          const evt = await client.getEvent(et)
          eventByTicker.set(et, evt)
        } catch (e) {
          console.warn("wrapped: failed to fetch event", { event_ticker: et, error: String(e) })
        }
      }),
    )
    console.log("@wrapped/api: fetched events", { uniqueEvents: uniqueEventTickers.length })

    // Totals
    const totalVolume = fills.filter((f) => f.action === "buy").reduce((acc, f) => acc + (f.count || 0), 0)
    const realizedByTrade = trades.map((t) => computeTradeRealizedPnlCents(t, marketResultByTicker.get(t.market.ticker)))
    const totalRealizedPnlCents = realizedByTrade.reduce((acc, v) => acc + v, 0)
    const totalTrades = trades.length
    const wins = realizedByTrade.reduce((acc, v) => acc + (v > 0 ? 1 : 0), 0)
    const winRatePct = totalTrades > 0 ? (wins / totalTrades) * 100 : 0
    console.log("@wrapped/api: computed totals", { totalVolume, totalRealizedPnlCents, totalTrades, wins, winRatePct: Number(winRatePct.toFixed(2)) })

    // First trade timestamp (unix seconds)
    const firstTradeTs = trades.length
      ? Math.min(
          ...trades
            .map((t) => {
              try { return toUnixSeconds(t.buy_timestamp) } catch { return Infinity }
            })
            .filter((v) => Number.isFinite(v)),
        )
      : undefined

    const toUnixSeconds = (dateString: string): number => Math.floor(new Date(dateString).getTime() / 1000)

    async function buildSeriesForTrade(t: Trade, endTs?: number): Promise<{ series: PricePoint[]; markers: TradeMarkers }> {
      const buyTs = toUnixSeconds(t.buy_timestamp)
      const sellTs = t.sold ? toUnixSeconds(t.timestamp) : undefined
      const settledTsStr = settlementTimeByTicker.get(t.market.ticker)
      const settledTs = settledTsStr ? toUnixSeconds(settledTsStr) : undefined
      const marketResult = marketResultByTicker.get(t.market.ticker)
      const payout = marketResult === "yes" || marketResult === "no" ? (marketResult === t.side ? 100 : 0) : undefined

      const resolvedEndTs = typeof endTs === "number" ? endTs : (settledTs ?? sellTs ?? Math.floor(Date.now() / 1000))
      const { candlesticks } = await client.getCandlesticks(t.market.ticker, {
        start_ts: buyTs,
        end_ts: resolvedEndTs,
      })
      const raw = candlesticks.map((c) => ({
        ts: c.end_period_ts,
        price: c.price?.close ?? c.price?.mean ?? c.price?.previous ?? 0,
      }))
      const series = raw.map((p) => ({ ts: p.ts, price: priceForSideFromYesPrice(p.price, t.side) }))

      const markers: TradeMarkers = {
        buy_ts: buyTs,
        buy_price: t.buy_price,
        sell_ts: sellTs,
        sell_price: t.sell_price,
        settled_ts: settledTs,
        settled_price: typeof payout === "number" ? priceForSideFromYesPrice(payout, t.side) : undefined,
      }

      return { series, markers }
    }

    // Biggest win by a balanced score of raw profit and percentage return.
    // Normalize profit and percent across candidates and combine with weights.
    type WinCandidate = { trade: Trade; realized_cents: number; pct: number }
    const winCandidates: WinCandidate[] = []
    for (const t of trades) {
      const realized = computeTradeRealizedPnlCents(t, marketResultByTicker.get(t.market.ticker))
      if (realized <= 0) continue
      let pct: number | null = null
      if (t.sold && typeof t.sell_price === "number" && t.buy_price > 0) {
        pct = ((t.sell_price - t.buy_price) / t.buy_price) * 100
      } else if (t.settled && t.buy_price > 0) {
        const res = marketResultByTicker.get(t.market.ticker)
        if (res === "yes" || res === "no") {
          const payout = res === t.side ? 100 : 0
          pct = ((payout - t.buy_price) / t.buy_price) * 100
        }
      }
      if (pct === null || !Number.isFinite(pct)) pct = 0
      winCandidates.push({ trade: t, realized_cents: realized, pct })
    }
    let biggestWin: { pct: number; trade: Trade; realized_pnl_cents: number } | null = null
    if (winCandidates.length > 0) {
      const maxProfit = Math.max(...winCandidates.map((c) => c.realized_cents))
      const maxPct = Math.max(...winCandidates.map((c) => c.pct))
      const W_PROFIT = 0.6
      const W_PCT = 0.4
      let best: { cand: WinCandidate; score: number } | null = null
      for (const cand of winCandidates) {
        const profitNorm = maxProfit > 0 ? cand.realized_cents / maxProfit : 0
        const pctNorm = maxPct > 0 ? cand.pct / maxPct : 0
        const score = W_PROFIT * profitNorm + W_PCT * pctNorm
        if (!best || score > best.score) best = { cand, score }
      }
      if (best) {
        biggestWin = { pct: best.cand.pct, trade: best.cand.trade, realized_pnl_cents: best.cand.realized_cents }
      }
    }
    console.log("@wrapped/api: biggest win computed", { hasBiggestWin: Boolean(biggestWin) })

    // Biggest loss by dollar value
    let biggestLoss: { loss_cents: number; realized_pnl_cents: number; trade: Trade } | null = null
    console.log("@wrapped/api: biggest loss computed", { hasBiggestLoss: Boolean(biggestLoss) })
    for (const t of trades) {
      const pnl = computeTradeRealizedPnlCents(t, marketResultByTicker.get(t.market.ticker))
      if (pnl < 0) {
        const loss = Math.abs(pnl)
        if (!biggestLoss || loss > biggestLoss.loss_cents) biggestLoss = { loss_cents: loss, realized_pnl_cents: pnl, trade: t }
      }
    }

    // Biggest longshot: lowest buy price among settled winning trades (exclude sold)
    let biggestLongshot: { buy_price: number; trade: Trade } | null = null
    console.log("@wrapped/api: biggest longshot computed", { hasBiggestLongshot: Boolean(biggestLongshot) })
    for (const t of trades) {
      const pnl = computeTradeRealizedPnlCents(t, marketResultByTicker.get(t.market.ticker))
      if (t.settled && !t.sold && pnl > 0) {
        if (!biggestLongshot || t.buy_price < biggestLongshot.buy_price) {
          biggestLongshot = { buy_price: t.buy_price, trade: t }
        }
      }
    }

    // Favorite genre (category) - derive from event, not market
    const categoryCount = new Map<string, number>()
    for (const t of trades) {
      const evt = eventByTicker.get(t.market.event_ticker)
      const cat = evt?.category || "Other"
      categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1)
    }
    let favoriteGenre: { category: string; count: number } = { category: "Other", count: 0 }
    console.log("@wrapped/api: favorite genre computed", favoriteGenre)
    for (const [cat, count] of categoryCount) {
      if (count > favoriteGenre.count) favoriteGenre = { category: cat, count }
    }

    // Missed opportunity: pick the sold trade where post-sell best price would have maximized extra gains
    const soldTrades = trades
      .filter((t) => t.sold && typeof t.sell_price === "number" && typeof t.sell_size === "number" && t.sell_size > 0)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 25)

    let missed: {
      trade: Trade
      best_after_sell_price: number
      best_after_sell_ts: number
      potential_gain_cents: number
      series: { ts: number; price: number }[]
      markers: TradeMarkers
    } | null = null
    console.log("@wrapped/api: missed opportunity computed", { hasMissed: Boolean(missed) })

    const nowSec = Math.floor(Date.now() / 1000)
    for (const t of soldTrades) {
      const buyTs = toUnixSeconds(t.buy_timestamp)
      const sellTs = toUnixSeconds(t.timestamp)
      const settledTsStr = settlementTimeByTicker.get(t.market.ticker)
      const end = settledTsStr ? toUnixSeconds(settledTsStr) : Math.max(sellTs + 60, nowSec)
      const { candlesticks } = await client.getCandlesticks(t.market.ticker, {
        start_ts: buyTs,
        end_ts: end,
      })
      const raw = candlesticks.map((c) => ({
        ts: c.end_period_ts,
        price: c.price?.close ?? c.price?.mean ?? c.price?.previous ?? 0,
      }))
      const sideSeries = raw.map((p) => ({ ts: p.ts, price: priceForSideFromYesPrice(p.price, t.side) }))

      // Best after sell (ts and price)
      let bestAfterPrice = t.sell_price!
      let bestAfterTs = sellTs
      for (const p of sideSeries) {
        if (p.ts > sellTs && p.price > bestAfterPrice) {
          bestAfterPrice = p.price
          bestAfterTs = p.ts
        }
      }

      const potentialGain = Math.max(0, (bestAfterPrice - t.sell_price!) * t.sell_size!)
      if (potentialGain > 0 && (!missed || potentialGain > missed.potential_gain_cents)) {
        const marketResult = marketResultByTicker.get(t.market.ticker)
        const payout = marketResult === "yes" || marketResult === "no" ? (marketResult === t.side ? 100 : 0) : undefined
        missed = {
          trade: t,
          best_after_sell_price: bestAfterPrice,
          best_after_sell_ts: bestAfterTs,
          potential_gain_cents: Math.round(potentialGain),
          series: sideSeries,
          markers: {
            buy_ts: buyTs,
            buy_price: t.buy_price,
            sell_ts: sellTs,
            sell_price: t.sell_price,
            settled_ts: settledTsStr ? toUnixSeconds(settledTsStr) : undefined,
            settled_price: typeof payout === "number" ? priceForSideFromYesPrice(payout, t.side) : undefined,
          },
        }
      }
    }

    const slides: WrappedSlide[] = []
    if (biggestWin) {
      const { series, markers } = await buildSeriesForTrade(biggestWin.trade)
      slides.push({ type: "biggest_win", pct: biggestWin.pct, realized_pnl_cents: biggestWin.realized_pnl_cents, trade: biggestWin.trade, series, markers })
    }
    if (biggestLoss) {
      const { series, markers } = await buildSeriesForTrade(biggestLoss.trade)
      slides.push({ type: "biggest_loss", loss_cents: biggestLoss.loss_cents, realized_pnl_cents: biggestLoss.realized_pnl_cents, trade: biggestLoss.trade, series, markers })
    }
    if (biggestLongshot) {
      const { series, markers } = await buildSeriesForTrade(biggestLongshot.trade)
      // Compute percent return for the longshot (it is a settled winner by construction)
      let pctLs = 0
      {
        const t = biggestLongshot.trade
        const res = marketResultByTicker.get(t.market.ticker)
        if (res === "yes" || res === "no") {
          const payout = res === t.side ? 100 : 0
          if (t.buy_price > 0) pctLs = ((payout - t.buy_price) / t.buy_price) * 100
        }
      }
      slides.push({ type: "biggest_longshot", buy_price: biggestLongshot.buy_price, pct: pctLs, trade: biggestLongshot.trade, series, markers })
    }
    if (favoriteGenre.count > 0) slides.push({ type: "favorite_genre", category: favoriteGenre.category, count: favoriteGenre.count })
    if (missed) slides.push({ type: "missed_opportunity", ...missed })
    slides.push({
      type: "totals",
      total_volume: totalVolume,
      total_realized_pnl_cents: totalRealizedPnlCents,
      favorite_category: favoriteGenre.category,
      favorite_count: favoriteGenre.count,
      biggest_win_pnl_cents: biggestWin?.realized_pnl_cents,
      biggest_loss_cents: biggestLoss?.loss_cents,
      win_rate_pct: winRatePct,
      wins,
      total_trades: totalTrades,
      first_trade_ts: Number.isFinite(firstTradeTs as number) ? (firstTradeTs as number) : undefined,
    })

    console.log("@wrapped/api: slides built", { count: slides.length, types: slides.map((s) => s.type) })
    return NextResponse.json({ slides })
  } catch (error) {
    console.error("@wrapped/api: error", error)
    return NextResponse.json({ message: "Failed to build wrapped" }, { status: 502 })
  }
}


