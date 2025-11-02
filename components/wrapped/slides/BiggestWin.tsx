"use client"

import * as React from "react"
import type { WrappedSlide } from "../types"
import { SlideFrame } from "../SlideFrame"
import { FancyLineChart } from "../FancyLineChart"
import { currency } from "../utils"

type Slide = Extract<WrappedSlide, { type: "biggest_win" }>

export function BiggestWin({ slide, setContainerRef }: { slide: Slide; setContainerRef?: (el: HTMLDivElement | null) => void }) {
  return (
    <SlideFrame rgb="16,185,129" setContainerRef={setContainerRef}>
      <div className="text-sm uppercase tracking-wide text-muted-foreground">Best Resolution</div>
      <div className="text-5xl md:text-6xl font-semibold">
        {slide.pct.toFixed(1)}%
        <span className="ml-3 text-emerald-500">{currency(slide.realized_pnl_cents)}</span>
      </div>
      <div className="mt-3 text-balance max-w-2xl text-muted-foreground text-lg md:text-xl">{slide.trade.market?.title}</div>
      <div className="text-sm text-muted-foreground mt-1">Bought {slide.trade.side?.toUpperCase?.() ?? ""} @ {Math.round(slide.trade.buy_price)}¢</div>
      <div className="w-full mt-8">
        <FancyLineChart data={slide.series} markers={slide.markers} />
      </div>
    </SlideFrame>
  )
}


