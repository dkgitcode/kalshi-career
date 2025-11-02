"use client"

import * as React from "react"
import type { WrappedSlide } from "../types"
import { SlideFrame } from "../SlideFrame"
import { cn } from "@/lib/utils"
import { currency } from "../utils"

type Slide = Extract<WrappedSlide, { type: "totals" }>

export function Totals({ slide, setContainerRef }: { slide: Slide; setContainerRef?: (el: HTMLDivElement | null) => void }) {
  const pnlPositive = (slide.total_realized_pnl_cents || 0) >= 0
  return (
    <SlideFrame rgb="6,182,212" setContainerRef={setContainerRef}>
      <div className="mt-4 space-y-8">
        {/* Row 1: Total PnL + Volume */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="text-muted-foreground text-sm">Total PnL</div>
            <div className={cn("font-semibold text-6xl md:text-7xl", pnlPositive ? "text-emerald-500" : "text-red-500")}>{currency(slide.total_realized_pnl_cents)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-sm">Total Volume Traded</div>
            <div className="font-semibold text-6xl md:text-7xl">{(slide.total_volume || 0).toLocaleString()}</div>
          </div>
        </div>

        {/* Row 2: Win Rate + Biggest Win + Biggest Loss */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="text-muted-foreground text-sm">Win Rate</div>
            <div className="font-semibold text-4xl md:text-5xl">{(slide.win_rate_pct ?? 0).toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-muted-foreground text-sm">Biggest Win</div>
            <div className="font-semibold text-3xl md:text-4xl">{currency(slide.biggest_win_pnl_cents ?? 0)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-sm">Biggest Loss</div>
            <div className="font-semibold text-3xl md:text-4xl">-{currency(slide.biggest_loss_cents ?? 0)}</div>
          </div>
        </div>

        {/* Row 3: On Kalshi Since + Favorite Category */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <div className="text-muted-foreground text-sm">On Kalshi Since</div>
            <div className="font-semibold text-3xl md:text-4xl">{typeof slide.first_trade_ts === 'number' ? new Date(slide.first_trade_ts * 1000).toLocaleDateString() : "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-sm">Favorite Category</div>
            <div className="font-semibold text-3xl md:text-4xl">{slide.favorite_category || "—"}</div>
            {typeof slide.favorite_count === "number" ? (
              <div className="text-sm text-muted-foreground">{slide.favorite_count} trades</div>
            ) : null}
          </div>
        </div>
      </div>
    </SlideFrame>
  )
}



