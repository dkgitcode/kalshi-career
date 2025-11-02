"use client"

import * as React from "react"
import type { WrappedSlide } from "../types"
import { SlideFrame } from "../SlideFrame"
import { FancyLineChart } from "../FancyLineChart"

type Slide = Extract<WrappedSlide, { type: "biggest_longshot" }>

export function BiggestLongshot({ slide, setContainerRef }: { slide: Slide; setContainerRef?: (el: HTMLDivElement | null) => void }) {
  return (
    <SlideFrame rgb="245,158,11" setContainerRef={setContainerRef}>
      <div className="text-sm uppercase tracking-wide text-muted-foreground">Biggest Longshot</div>
      <div className="text-5xl md:text-6xl font-semibold">
        {slide.buy_price.toFixed(0)}¢
        <span className="ml-3 text-emerald-500 font-medium text-3xl md:text-4xl align-baseline">+{slide.pct.toFixed(1)}%</span>
      </div>
      <div className="mt-3 text-balance max-w-2xl text-muted-foreground text-lg md:text-xl">{slide.trade.market?.title}</div>
      <div className="text-sm text-muted-foreground">{slide.trade.market?.ticker} · {slide.trade.side.toUpperCase()}</div>
      <div className="w-full mt-8">
        <FancyLineChart data={slide.series} markers={slide.markers} />
      </div>
    </SlideFrame>
  )
}


