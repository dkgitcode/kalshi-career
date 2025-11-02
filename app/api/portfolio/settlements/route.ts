import { NextResponse } from "next/server"

import { getKalshiClient } from "@/lib/kalshi/client"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get("cursor") ?? undefined

  try {
    const client = getKalshiClient()
    const data = await client.getPortfolioSettlements({ cursor })
    const filtered = {
      ...data,
      settlements: (data.settlements || []).filter((s) => s.yes_count !== s.no_count),
    }
    return NextResponse.json(filtered)
  } catch (error) {
    console.error("Kalshi portfolio settlements route error", error)
    return NextResponse.json({ message: "Failed to load settlements" }, { status: 502 })
  }
}


