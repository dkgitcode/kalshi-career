"use client"

import * as React from "react"
import type { WrappedSlide } from "./types"
import { BiggestWin } from "./slides/BiggestWin"
import { BiggestLoss } from "./slides/BiggestLoss"
import { BiggestLongshot } from "./slides/BiggestLongshot"
import { MissedOpportunity } from "./slides/MissedOpportunity"
import { Totals } from "./slides/Totals"

export function SlideContent({ slide, setContainerRef }: { slide: WrappedSlide; setContainerRef?: (el: HTMLDivElement | null) => void }) {
  switch (slide.type) {
    case "biggest_win":
      return <BiggestWin slide={slide} setContainerRef={setContainerRef} />
    case "biggest_loss":
      return <BiggestLoss slide={slide} setContainerRef={setContainerRef} />
    case "biggest_longshot":
      return <BiggestLongshot slide={slide} setContainerRef={setContainerRef} />
    case "missed_opportunity":
      return <MissedOpportunity slide={slide} setContainerRef={setContainerRef} />
    case "totals":
      return <Totals slide={slide} setContainerRef={setContainerRef} />
    // favorite_genre is intentionally filtered out before rendering
    default:
      return null
  }
}


