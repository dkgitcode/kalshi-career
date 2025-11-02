import { NextResponse } from "next/server"

import { getKalshiClient } from "@/lib/kalshi/client"

const LIMIT_MIN = 1
const LIMIT_MAX = 1000
const ALLOWED_SETTLEMENT_STATUS = new Set(["all", "unsettled", "settled"]) as const
const ALLOWED_COUNT_FILTER = new Set([
  "position",
  "total_traded",
  "resting_order_count",
])

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  // limit
  const limitParam = searchParams.get("limit")
  let limit: number | undefined
  if (limitParam !== null) {
    const parsed = Number.parseInt(limitParam, 10)
    if (!Number.isFinite(parsed) || parsed < LIMIT_MIN || parsed > LIMIT_MAX) {
      return NextResponse.json(
        { message: `limit must be an integer in [${LIMIT_MIN}, ${LIMIT_MAX}]` },
        { status: 400 },
      )
    }
    limit = parsed
  }

  // settlement_status
  const settlementStatusParam = searchParams.get("settlement_status")
  let settlement_status: "all" | "unsettled" | "settled" | undefined
  if (settlementStatusParam !== null) {
    if (!ALLOWED_SETTLEMENT_STATUS.has(settlementStatusParam as any)) {
      return NextResponse.json(
        { message: `settlement_status must be one of all, unsettled, settled` },
        { status: 400 },
      )
    }
    settlement_status = settlementStatusParam as any
  }

  // count_filter (comma-separated allowed values)
  const countFilterParam = searchParams.get("count_filter")
  let count_filter: string | undefined
  if (countFilterParam) {
    const parts = countFilterParam
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    const invalid = parts.filter((p) => !ALLOWED_COUNT_FILTER.has(p))
    if (invalid.length > 0) {
      return NextResponse.json(
        { message: `count_filter contains invalid values: ${invalid.join(", ")}` },
        { status: 400 },
      )
    }
    count_filter = parts.join(",")
  }

  const cursor = searchParams.get("cursor") ?? undefined
  const ticker = searchParams.get("ticker") ?? undefined
  const event_ticker = searchParams.get("event_ticker") ?? undefined

  try {
    const client = getKalshiClient()
    const data = await client.getPortfolioPositions({
      cursor,
      limit,
      count_filter,
      settlement_status,
      ticker,
      event_ticker,
    })
    return NextResponse.json(data)
  } catch (error) {
    console.error("Kalshi portfolio positions route error", error)
    return NextResponse.json({ message: "Failed to load positions" }, { status: 502 })
  }
}


