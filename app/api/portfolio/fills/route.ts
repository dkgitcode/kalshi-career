import { NextResponse } from "next/server"

import { getKalshiClient } from "@/lib/kalshi/client"

const LIMIT_MIN = 1
const LIMIT_MAX = 1000

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

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

  const cursor = searchParams.get("cursor") ?? undefined

  try {
    const client = getKalshiClient()
    const data = await client.getFills({ cursor, limit })
    return NextResponse.json(data)
  } catch (error) {
    console.error("Kalshi portfolio fills route error", error)
    return NextResponse.json({ message: "Failed to load fills" }, { status: 502 })
  }
}


