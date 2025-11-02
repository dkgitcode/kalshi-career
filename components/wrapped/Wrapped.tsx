"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import * as htmlToImage from "html-to-image"
import { Copy, Check } from "lucide-react"
import type { WrappedSlide } from "./types"
import { LoadingSlide } from "./LoadingSlide"
import { SlideContent } from "./SlideContent"

// Types moved to components/wrapped/types

interface WrappedProps {
  triggerClassName?: string
  triggerLabel?: string
  onStart?: () => void
  autoStart?: boolean
}

export function Wrapped({ triggerClassName, triggerLabel, onStart, autoStart }: WrappedProps) {
  const [open, setOpen] = React.useState(false)
  const [slides, setSlides] = React.useState<WrappedSlide[] | null>(null)
  const [idx, setIdx] = React.useState(0)
  const [loading, setLoading] = React.useState(false)
  const [logs, setLogs] = React.useState<string[]>([])
  const [scrollLock, setScrollLock] = React.useState(false)
  const [direction, setDirection] = React.useState(1) // 1 = forward (next), -1 = backward (prev)
  const slideNodeRef = React.useRef<HTMLDivElement | null>(null)
  const eventSourceRef = React.useRef<EventSource | null>(null)
  const [copied, setCopied] = React.useState(false)
  const copiedTimeoutRef = React.useRef<number | null>(null)
  const copyImage = React.useCallback(async () => {
    const node = slideNodeRef.current
    if (!node) return
    try {
      console.log("@wrapped/client copy: start")
      const blob = await htmlToImage.toBlob(node, { pixelRatio: 2 })
      if (!blob) return
      const canClipboard = typeof navigator !== "undefined" && (navigator as any).clipboard && typeof (navigator as any).clipboard.write === "function" && (window as any).ClipboardItem
      if (canClipboard) {
        const ClipboardItemAny = (window as any).ClipboardItem
        await (navigator as any).clipboard.write([
          new ClipboardItemAny({ [blob.type]: blob }),
        ])
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "kalshi-wrapped.png"
        a.click()
        URL.revokeObjectURL(url)
      }
      try { if (copiedTimeoutRef.current) window.clearTimeout(copiedTimeoutRef.current) } catch {}
      setCopied(true)
      copiedTimeoutRef.current = window.setTimeout(() => { setCopied(false) }, 1200) as unknown as number
      console.log("@wrapped/client copy: success")
    } catch (e) {
      console.error("@wrapped/client copy: failed", e)
    }
  }, [])
  React.useEffect(() => () => { try { if (copiedTimeoutRef.current) window.clearTimeout(copiedTimeoutRef.current) } catch {} }, [])
  React.useEffect(() => () => { try { eventSourceRef.current?.close() } catch {} }, [])

  const fetchSlides = React.useCallback(async () => {
    setLoading(true)
    setLogs([])
    try { onStart?.() } catch {}
    setOpen(true)

    const fallbackFetch = async () => {
      try {
        console.log("@wrapped/client fetch: fallback starting /api/wrapped")
        const res = await fetch("/api/wrapped", { cache: "no-store" })
        if (!res.ok) throw new Error("failed")
        const data = (await res.json()) as { slides: WrappedSlide[] }
        const filtered = (data.slides || []).filter((s) => s.type !== "favorite_genre")
        setSlides(filtered)
        setIdx(0)
        console.log("@wrapped/client fetch: fallback success", { count: filtered.length, types: filtered.map((s) => s.type) })
      } catch (err) {
        console.error("@wrapped/client fetch: fallback error", err)
      } finally {
        setLoading(false)
        console.log("@wrapped/client fetch: done")
      }
    }

    try {
      console.log("@wrapped/client sse: starting /api/wrapped?stream=1")
      const es = new EventSource("/api/wrapped?stream=1")
      eventSourceRef.current = es
      es.addEventListener("log", (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data) as { message?: string }
          const line = payload?.message || e.data
          setLogs((prev) => (prev.length > 200 ? [...prev.slice(-200), line] : [...prev, line]))
        } catch {
          setLogs((prev) => [...prev, e.data])
        }
      })
      es.addEventListener("done", (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as { slides: WrappedSlide[] }
          const filtered = (data.slides || []).filter((s) => s.type !== "favorite_genre")
          setSlides(filtered)
          setIdx(0)
          console.log("@wrapped/client sse: done", { count: filtered.length, types: filtered.map((s) => s.type) })
        } catch (err) {
          console.error("@wrapped/client sse: parse done error", err)
        } finally {
          try { es.close() } catch {}
          eventSourceRef.current = null
          setLoading(false)
        }
      })
      es.addEventListener("error", (_e: Event) => {
        console.warn("@wrapped/client sse: error, falling back")
        try { es.close() } catch {}
        eventSourceRef.current = null
        fallbackFetch()
      })
    } catch (err) {
      console.warn("@wrapped/client sse: failed to start, falling back", err)
      fallbackFetch()
    }
  }, [onStart])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const handler = () => { console.log("@wrapped/client: open-wrapped event received"); fetchSlides() }
    window.addEventListener("open-wrapped", handler)
    return () => window.removeEventListener("open-wrapped", handler)
  }, [fetchSlides])

  // Auto start when asked (used by home page once Analyze is clicked)
  React.useEffect(() => {
    if (autoStart) fetchSlides()
    if (autoStart) console.log("@wrapped/client: autoStart triggered")
  }, [autoStart, fetchSlides])

  const next = React.useCallback(() => {
    setIdx((i) => {
      if (!slides || slides.length === 0) return i
      const nextIdx = Math.min(i + 1, slides.length - 1)
      if (nextIdx === i) return i // at end; no-op, do not change direction
      setDirection(1)
      return nextIdx
    })
  }, [slides])
  const prev = React.useCallback(() => {
    setIdx((i) => {
      const prevIdx = Math.max(i - 1, 0)
      if (prevIdx === i) return i // at start; no-op, do not change direction
      setDirection(-1)
      return prevIdx
    })
  }, [])

  React.useEffect(() => {
    if (open) document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [open])

  // Wheel and touch to switch slides (no actual scroll)
  const wheelCooldownRef = React.useRef<number>(0)
  const onWheel = React.useCallback((e: React.WheelEvent) => {
    if (!slides || !open) return
    const now = Date.now()
    if (now - wheelCooldownRef.current < 500) return
    if (Math.abs(e.deltaY) < 10) return
    e.preventDefault()
    wheelCooldownRef.current = now
    if (e.deltaY > 0) { next(); } else { prev(); }
  }, [slides, open, next, prev])

  const touchStartRef = React.useRef<number | null>(null)
  const onTouchStart = React.useCallback((e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0]?.clientY ?? null
  }, [])
  const onTouchEnd = React.useCallback((e: React.TouchEvent) => {
    if (touchStartRef.current == null) return
    const dy = (e.changedTouches[0]?.clientY ?? touchStartRef.current) - touchStartRef.current
    if (Math.abs(dy) > 32) {
      if (dy < 0) { next(); } else { prev(); }
    }
    touchStartRef.current = null
  }, [next, prev])

  return (
    <div className="w-full">
      {!open && (
        <Button onClick={fetchSlides} className={cn(triggerClassName, "cursor-pointer")}>{triggerLabel ?? "Start Wrapped"}</Button>
      )}

      {open && (
        <div
          className="relative min-h-screen overflow-hidden"
          onWheel={onWheel}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Slides container */}
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="mx-auto w-full max-w-5xl flex flex-col items-center justify-center">
              <AnimatePresence mode="wait" initial={false} custom={direction}>
                <motion.div
                  key={idx}
                  variants={{
                    enter: (dir: number) => ({ y: dir > 0 ? 40 : -40, opacity: 0 }),
                    center: { y: 0, opacity: 1 },
                    exit: (dir: number) => ({ y: dir > 0 ? -40 : 40, opacity: 0 }),
                  }}
                  initial={false}
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="w-full"
                >
                  {loading && <LoadingSlide logs={logs} />}
                  {!loading && slides && slides[idx] && (
                    <SlideContent slide={slides[idx]} setContainerRef={(el) => { slideNodeRef.current = el }} />
                  )}
                </motion.div>
              </AnimatePresence>
              {!loading && (
                <div className="mt-2">
                  <Button size="sm" variant="outline" onClick={copyImage} className="cursor-pointer">
                    {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Vertical dots indicator on the right */}
          {slides && slides.length > 0 ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setDirection(i > idx ? 1 : -1)
                    setIdx(i)
                  }}
                  className={cn(
                    "h-2.5 w-2.5 rounded-full transition-colors cursor-pointer",
                    i === idx ? "bg-foreground" : "bg-muted"
                  )}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

// Slide content and helpers moved into components/wrapped/*
