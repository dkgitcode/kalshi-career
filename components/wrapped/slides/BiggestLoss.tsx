"use client"

import * as React from "react"
import type { WrappedSlide } from "../types"
import { SlideFrame } from "../SlideFrame"
import { FancyLineChart } from "../FancyLineChart"

type Slide = Extract<WrappedSlide, { type: "biggest_loss" }>

export function BiggestLoss({ slide, setContainerRef }: { slide: Slide; setContainerRef?: (el: HTMLDivElement | null) => void }) {
  return (
    <SlideFrame rgb="239,68,68" setContainerRef={setContainerRef}>
      <div className="text-sm uppercase tracking-wide text-muted-foreground">Biggest Loss</div>
      <div className="text-5xl md:text-6xl font-semibold text-red-500">-{`$${(slide.loss_cents / 100).toFixed(2)}`}</div>
      <div className="mt-3 text-balance max-w-2xl text-muted-foreground text-lg md:text-xl">{slide.trade.market?.title}</div>
      <div className="text-sm text-muted-foreground mt-1">Bought {slide.trade.side?.toUpperCase?.() ?? ""} @ {Math.round(slide.trade.buy_price)}¢</div>
      <div className="w-full mt-8">
        <FancyLineChart data={slide.series} markers={slide.markers} />
      </div>
    </SlideFrame>
  )
}


