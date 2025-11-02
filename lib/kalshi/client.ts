import { createSign, constants } from "node:crypto"

import {
  KalshiIncentiveProgramsResponse,
  KalshiPortfolioBalanceResponse,
  KalshiPortfolioPositionsResponse,
  KalshiSettlementsResponse,
  KalshiFillsResponse,
  KalshiMarketResponse,
  KalshiEventResponse,
  KalshiCandlesticksResponse,
  KalshiCandlestickPeriodInterval,
} from "@/lib/kalshi/types"

const DEFAULT_BASE_URL = "https://api.elections.kalshi.com"

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

interface RequestOptions {
  searchParams?: Record<string, string | number | undefined>
}

// Simple token-bucket rate limiter shared across all KalshiClient instances.
// Keeps us safely under 30 RPS with a cushion.
class GlobalRateLimiter {
  private readonly maxPerSecond = 25
  private tokens = this.maxPerSecond
  private queue: Array<() => void> = []
  private initialized = false

  private init() {
    if (this.initialized) return
    this.initialized = true
    setInterval(() => {
      this.tokens = this.maxPerSecond
      this.drain()
    }, 1000)
  }

  private drain() {
    while (this.tokens > 0 && this.queue.length > 0) {
      this.tokens -= 1
      const resolve = this.queue.shift()!
      resolve()
    }
  }

  async acquire(): Promise<void> {
    this.init()
    if (this.tokens > 0) {
      this.tokens -= 1
      return
    }
    await new Promise<void>((resolve) => this.queue.push(resolve))
  }
}

const globalRateLimiter = new GlobalRateLimiter()

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function normalizePrivateKey(key: string): string {
  const trimmed = key.trim()
  return trimmed.includes("\\n") ? trimmed.replace(/\\n/g, "\n") : trimmed
}

function deriveSeriesTickerFromMarketTicker(t: string | undefined | null): string | undefined {
  if (!t) return undefined
  const idx = t.indexOf("-")
  return idx > 0 ? t.slice(0, idx) : undefined
}

export class KalshiClient {
  private privateKey: string

  constructor(
    private readonly apiKeyId: string,
    rawPrivateKey: string,
    private readonly baseUrl = DEFAULT_BASE_URL,
  ) {
    if (!apiKeyId) {
      throw new Error("KalshiClient requires an API key ID")
    }

    if (!rawPrivateKey) {
      throw new Error("KalshiClient requires a private key")
    }

    this.privateKey = normalizePrivateKey(rawPrivateKey)
  }

  async getVolumeIncentives(params?: { limit?: number; cursor?: string }) {
    const response = await this.request<KalshiIncentiveProgramsResponse>("GET", "/trade-api/v2/incentive_programs", {
      searchParams: {
        limit: params?.limit,
        cursor: params?.cursor,
      },
    })

    return response
  }

  async getPortfolioBalance() {
    const response = await this.request<KalshiPortfolioBalanceResponse>(
      "GET",
      "/trade-api/v2/portfolio/balance",
    )
    return response
  }

  async getPortfolioPositions(params?: {
    cursor?: string
    limit?: number
    count_filter?: string
    settlement_status?: "all" | "unsettled" | "settled"
    ticker?: string
    event_ticker?: string
  }) {
    const response = await this.request<KalshiPortfolioPositionsResponse>(
      "GET",
      "/trade-api/v2/portfolio/positions",
      {
        searchParams: {
          cursor: params?.cursor,
          limit: params?.limit,
          count_filter: params?.count_filter,
          settlement_status: params?.settlement_status,
          ticker: params?.ticker,
          event_ticker: params?.event_ticker,
        },
      },
    )
    return response
  }

  async getPortfolioSettlements(params?: { cursor?: string }) {
    const response = await this.request<KalshiSettlementsResponse>(
      "GET",
      "/trade-api/v2/portfolio/settlements",
      {
        searchParams: {
          cursor: params?.cursor,
        },
      },
    )
    return response
  }

  async getFills(params?: { cursor?: string; limit?: number }) {
    const response = await this.request<KalshiFillsResponse>(
      "GET",
      "/trade-api/v2/portfolio/fills",
      {
        searchParams: {
          cursor: params?.cursor,
          limit: params?.limit,
        },
      },
    )
    return response
  }

  async getMarket(ticker: string) {
    if (!ticker) throw new Error("ticker is required")
    const response = await this.request<KalshiMarketResponse>(
      "GET",
      `/trade-api/v2/markets/${encodeURIComponent(ticker)}`,
    )
    return response.market
  }

  async getEvent(eventTicker: string) {
    if (!eventTicker) throw new Error("event_ticker is required")
    const response = await this.request<KalshiEventResponse>(
      "GET",
      `/trade-api/v2/events/${encodeURIComponent(eventTicker)}`,
    )
    return response.event
  }

  async getCandlesticks(
    marketTicker: string,
    params: { start_ts: number; end_ts: number; period_interval?: KalshiCandlestickPeriodInterval },
  ) {
    if (!marketTicker) throw new Error("ticker is required")
    // Fetch market to get event_ticker, then fetch event to get series_ticker
    const market = await this.getMarket(marketTicker)
    const event = await this.getEvent(market.event_ticker)
    const seriesTicker = event.series_ticker

    if (!seriesTicker) {
      console.warn("Kalshi getCandlesticks: missing series_ticker for market", {
        marketTicker,
        eventTicker: market.event_ticker,
      })
      return { ticker: marketTicker, candlesticks: [] }
    }

    // Choose interval automatically if not provided
    const originalStartTs = Math.min(params.start_ts, params.end_ts)
    const originalEndTs = Math.max(params.start_ts, params.end_ts)
    const spanSec = Math.max(0, originalEndTs - originalStartTs)
    const twoWeeksSec = 14 * 24 * 60 * 60
    const intervalMinutes: KalshiCandlestickPeriodInterval = params.period_interval ?? (spanSec < twoWeeksSec ? 1 : 60)
    const periodSeconds = intervalMinutes * 60
    const maxCandlesPerReq = 5000
    const maxSpanSeconds = periodSeconds * maxCandlesPerReq

    // Expand the window 10% before the start for context (do not go below 0)
    const backfill = Math.floor(spanSec * 0.1)
    const startTs = Math.max(0, originalStartTs - backfill)
    const endTs = originalEndTs

    const all: KalshiCandlesticksResponse["candlesticks"] = []
    let cursor = startTs
    let safety = 0
    while (cursor < endTs && safety < 250) {
      safety += 1
      // Keep strictly under the 5000-candle cap to avoid off-by-one server checks
      const chunkEnd = Math.min(endTs, cursor + maxSpanSeconds - 1)
      try {
        const response = await this.request<KalshiCandlesticksResponse>(
          "GET",
          `/trade-api/v2/series/${encodeURIComponent(seriesTicker)}/markets/${encodeURIComponent(marketTicker)}/candlesticks`,
          {
            searchParams: {
              start_ts: cursor,
              end_ts: chunkEnd,
              // API expects one of 1 | 60 | 1440 (minutes)
              period_interval: intervalMinutes,
            },
          },
        )
        if (Array.isArray(response.candlesticks) && response.candlesticks.length > 0) {
          all.push(...response.candlesticks)
          const last = response.candlesticks[response.candlesticks.length - 1]
          const nextCursor = (last?.end_period_ts ?? chunkEnd) + periodSeconds
          cursor = Math.max(chunkEnd, nextCursor)
        } else {
          cursor = chunkEnd + periodSeconds
        }
      } catch (error) {
        console.warn("Kalshi getCandlesticks chunk failed; continuing", {
          marketTicker,
          seriesTicker,
          start_ts: cursor,
          end_ts: chunkEnd,
          error: String(error),
        })
        cursor = chunkEnd + periodSeconds
      }
    }

    // Deduplicate by end_period_ts to avoid overlaps
    const seen = new Set<number>()
    const combined: KalshiCandlesticksResponse["candlesticks"] = []
    for (const c of all) {
      if (c && typeof c.end_period_ts === "number" && !seen.has(c.end_period_ts)) {
        seen.add(c.end_period_ts)
        combined.push(c)
      }
    }

    return { ticker: marketTicker, candlesticks: combined }
  }

  private signRequest(timestamp: string, method: HttpMethod, pathOnly: string): string {
    const signer = createSign("RSA-SHA256")
    signer.update(`${timestamp}${method}${pathOnly}`)
    signer.end()

    const signature = signer.sign({
      key: this.privateKey,
      padding: constants.RSA_PKCS1_PSS_PADDING,
      saltLength: constants.RSA_PSS_SALTLEN_DIGEST,
    })

    return signature.toString("base64")
  }

  private async request<T>(method: HttpMethod, path: string, options?: RequestOptions): Promise<T> {
    const url = new URL(path, this.baseUrl)

    if (options?.searchParams) {
      for (const [key, value] of Object.entries(options.searchParams)) {
        if (value === undefined || value === null) continue
        url.searchParams.set(key, String(value))
      }
    }

    const pathWithQuery = `${path}${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ""}`
    const timestamp = Date.now().toString()

    const headers = {
      "KALSHI-ACCESS-KEY": this.apiKeyId,
      "KALSHI-ACCESS-TIMESTAMP": timestamp,
      // Per Kalshi signing, sign only the path (exclude query string)
      "KALSHI-ACCESS-SIGNATURE": this.signRequest(timestamp, method, path),
    }

    const maxRetries = 3
    let attempt = 0
    while (true) {
      await globalRateLimiter.acquire()
      const response = await fetch(url.toString(), {
        method,
        headers,
      })

      if (response.ok) {
        return response.json() as Promise<T>
      }

      // Handle 429 Too Many Requests with exponential backoff + jitter
      if (response.status === 429 && attempt < maxRetries) {
        attempt += 1
        const base = 250 * Math.pow(2, attempt - 1)
        const jitter = Math.floor(Math.random() * 150)
        const delay = base + jitter
        // eslint-disable-next-line no-console
        console.warn("@wrapped/kalshi: 429 received, backing off", { path, attempt, delay })
        await sleep(delay)
        continue
      }

      const errorText = await response.text()
      throw new Error(
        `Kalshi ${method} ${path} failed with ${response.status}: ${response.statusText}. ${errorText}`,
      )
    }
  }
}

let cachedClient: KalshiClient | null = null

export function getKalshiClient() {
  if (!cachedClient) {
    const apiKeyId = process.env.PROD_KEY_ID
    const privateKey = process.env.KALSHI_KEY
    const baseUrl = DEFAULT_BASE_URL

    if (!apiKeyId || !privateKey) {
      throw new Error("Kalshi credentials are not configured in the environment")
    }

    cachedClient = new KalshiClient(apiKeyId, privateKey, baseUrl)
  }

  return cachedClient
}
