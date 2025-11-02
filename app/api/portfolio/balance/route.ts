import { NextResponse } from "next/server"

import { getKalshiClient } from "@/lib/kalshi/client"

export async function GET() {
  try {
    const client = getKalshiClient()
    const data = await client.getPortfolioBalance()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Kalshi portfolio balance route error", error)
    return NextResponse.json({ message: "Failed to load balance" }, { status: 502 })
  }
}


