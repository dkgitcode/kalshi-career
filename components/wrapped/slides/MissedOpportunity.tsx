"use client"

import * as React from "react"
import type { WrappedSlide } from "../types"
import { SlideFrame } from "../SlideFrame"
import { FancyLineChart } from "../FancyLineChart"
import { currency } from "../utils"

type Slide = Extract<WrappedSlide, { type: "missed_opportunity" }>

export function MissedOpportunity({ slide, setContainerRef }: { slide: Slide; setContainerRef?: (el: HTMLDivElement | null) => void }) {
  return (
    <SlideFrame rgb="59,130,246" setContainerRef={setContainerRef}>
      <div className="mb-4 text-white text-3xl md:text-4xl font-semibold">Paper Hands</div>
      <div className="text-balance max-w-2xl text-muted-foreground mb-4 text-lg md:text-xl">
        If you had held a bit longer, you could've gained {currency(slide.potential_gain_cents)} more.
      </div>
      <FancyLineChart
        data={slide.series}
        markers={slide.markers}
        extraMarkers={[{ ts: slide.best_after_sell_ts, price: slide.best_after_sell_price, label: "Best After Sell", color: "#3b82f6" }]}
      />
      <div className="mt-4 text-sm text-muted-foreground">{slide.trade.market?.title}</div>
    </SlideFrame>
  )
}


