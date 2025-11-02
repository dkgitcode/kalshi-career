"use client"

import * as React from "react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  Area,
} from "recharts"
import type { TradeMarkers } from "./types"

export function FancyLineChart({
  data,
  markers,
  extraMarkers,
}: {
  data: { ts: number; price: number }[]
  markers?: TradeMarkers
  extraMarkers?: { ts: number; price: number; label: string; color?: string }[]
}) {
  if (!data.length) return <div className="text-sm text-muted-foreground">No data</div>

  const series: { ts: number; price: number }[] = []
  let lastPrice: number | undefined
  for (const p of data) {
    const v = Number.isFinite(p.price) ? p.price : undefined
    const price = v ?? lastPrice ?? p.price ?? 0
    series.push({ ts: p.ts, price })
    if (Number.isFinite(price)) lastPrice = price
  }

  const minTs = Math.min(...series.map((d) => d.ts))
  const maxTs = Math.max(...series.map((d) => d.ts))
  const minY = Math.min(...series.map((d) => d.price))
  const maxY = Math.max(...series.map((d) => d.price))

  const markerDots: { cx: number; cy: number; label: string; color?: string }[] = []
  const pushMarker = (ts?: number, price?: number, label?: string, color?: string) => {
    if (!ts || typeof price !== "number" || !label) return
    markerDots.push({ cx: ts, cy: price, label, color })
  }
  if (markers) {
    pushMarker(markers.settled_ts, markers.settled_price, "Resolve", "#6366f1")
  }
  if (extraMarkers) {
    for (const m of extraMarkers) pushMarker(m.ts, m.price, m.label, m.color)
  }

  return (
    <div className="w-full h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 28, right: 8, bottom: 8, left: 8 }}>
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.15} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeOpacity={0.25} className="stroke-muted" vertical={false} />
          <XAxis
            dataKey="ts"
            type="number"
            domain={[minTs, maxTs]}
            tickFormatter={(ts: number) => new Date(ts * 1000).toLocaleDateString()}
            tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[Math.floor(minY), Math.ceil(maxY)]}
            width={32}
            tick={{ fontSize: 11, fill: "currentColor", opacity: 0.6 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }}
            labelFormatter={(ts: number | string) => new Date(Number(ts) * 1000).toLocaleString()}
            formatter={(value: number) => [`${Number(value).toFixed(0)}¢`, "Price"]}
          />
          <Area type="monotone" dataKey="price" stroke="none" fill="url(#areaFill)" />
          <Line type="monotone" dataKey="price" stroke="currentColor" strokeWidth={2} dot={false} />
          {markers?.buy_ts ? (
            <ReferenceLine x={markers.buy_ts} stroke="#10b981" strokeDasharray="4 4" />
          ) : null}
          {markers?.sell_ts ? (
            <ReferenceLine x={markers.sell_ts} stroke="#ef4444" strokeDasharray="4 4" />
          ) : null}
          {markerDots.map((m, idx) => (
            <ReferenceDot key={idx} x={m.cx} y={m.cy} r={3} fill={m.color ?? "currentColor"} label={{ value: m.label, position: "top", fontSize: 11, fill: "currentColor" }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}


