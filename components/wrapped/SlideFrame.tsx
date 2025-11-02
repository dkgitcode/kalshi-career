"use client"

import * as React from "react"

export function useSlideBoxStyle() {
  return React.useMemo<React.CSSProperties>(() => ({
    aspectRatio: "16 / 10",
    width: "100%",
    maxWidth: "min(90vw, 64rem, calc(92vh * 16 / 10))",
    maxHeight: "92vh",
  }), [])
}

function Blobs({ rgb }: { rgb: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      <div className="absolute rounded-full blur-2xl animate-pulse" style={{ top: '20%', left: '4%', width: '14rem', height: '14rem', backgroundColor: `rgba(${rgb}, 0.16)` }} />
      <div className="absolute rounded-full blur-xl animate-pulse" style={{ top: '8%', right: '6%', width: '12rem', height: '12rem', backgroundColor: `rgba(${rgb}, 0.14)`, animationDelay: '0.4s' }} />
      <div className="absolute rounded-full blur-3xl animate-pulse" style={{ bottom: '18%', left: '2%', width: '18rem', height: '18rem', backgroundColor: `rgba(${rgb}, 0.12)`, animationDelay: '0.8s' }} />
      <div className="absolute rounded-full blur-xl animate-pulse" style={{ bottom: '12%', right: '4%', width: '12rem', height: '12rem', backgroundColor: `rgba(${rgb}, 0.12)`, animationDelay: '1.2s' }} />
      <div className="absolute rounded-full blur-2xl animate-pulse" style={{ top: '56%', left: '40%', width: '16rem', height: '16rem', backgroundColor: `rgba(${rgb}, 0.1)`, animationDelay: '1.6s' }} />
    </div>
  )
}

export function SlideFrame({
  rgb,
  setContainerRef,
  children,
}: {
  rgb: string
  setContainerRef?: (el: HTMLDivElement | null) => void
  children: React.ReactNode
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const slideBoxStyle = useSlideBoxStyle()

  React.useEffect(() => {
    setContainerRef?.(containerRef.current)
    return () => setContainerRef?.(null)
  }, [setContainerRef])

  return (
    <div className="flex h-full flex-col justify-center gap-4">
      <div className="w-full max-w-3xl mx-auto">
        <div ref={containerRef} className="relative border rounded-lg p-6 text-left mx-auto overflow-hidden" style={slideBoxStyle}>
          <Blobs rgb={rgb} />
          <div className="relative z-10">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}


