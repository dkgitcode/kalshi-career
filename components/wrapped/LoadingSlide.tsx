"use client"

import * as React from "react"

export function LoadingSlide({ logs }: { logs?: string[] }) {
  const slideBoxStyle: React.CSSProperties = React.useMemo(() => ({
    aspectRatio: "16 / 10",
    width: "100%",
    maxWidth: "min(90vw, 64rem, calc(92vh * 16 / 10))",
    maxHeight: "92vh",
  }), [])

  return (
    <div className="flex h-full flex-col justify-center gap-4">
      <div className="w-full max-w-3xl mx-auto">
        <div className="relative border rounded-lg p-6 text-left mx-auto overflow-hidden" style={slideBoxStyle}>
          <div className="relative z-10 w-full h-full flex items-start justify-start">
            <div className="w-full">
              <div className="rounded-md border p-3 bg-background text-xs max-h-80 overflow-auto">
                <ul className="space-y-1 font-mono">
                  {logs && logs.length > 0 ? (
                    logs.slice(-40).map((l, i) => (
                      <li key={i} className="text-muted-foreground">{l}</li>
                    ))
                  ) : (
                    <li className="text-muted-foreground">Waiting for logs…</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


