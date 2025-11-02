import { NextResponse } from "next/server"

import { getKalshiClient } from "@/lib/kalshi/client"
import { buildTradesFromFillsAndSettlements } from "@/lib/portfolio/trades"

const DEFAULT_LIMIT = 1000
const LIMIT_MIN = 1
const LIMIT_MAX = 1000

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limitParam = searchParams.get("limit")
  let limit = DEFAULT_LIMIT
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

  try {
    const client = getKalshiClient()

    const [fillsRes, settlementsRes] = await Promise.all([
      client.getFills({ limit }),
      client.getPortfolioSettlements(),
    ])

    const trades = await buildTradesFromFillsAndSettlements(
      fillsRes.fills || [],
      settlementsRes.settlements || [],
      (ticker) => client.getMarket(ticker),
    )

    return NextResponse.json({ trades })
  } catch (error) {
    console.error("Trades route error", error)
    return NextResponse.json({ message: "Failed to build trades" }, { status: 502 })
  }
}


