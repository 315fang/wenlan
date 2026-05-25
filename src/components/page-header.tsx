"use client"

import type { ReactNode } from "react"
import { ChevronLeft } from "lucide-react"

interface PageHeaderProps {
  title: string
  subtitle?: string
  onBack: () => void
  right?: ReactNode
}

export function PageHeader({ title, subtitle, onBack, right }: PageHeaderProps) {
  return (
    <header
      className="shrink-0 flex items-center gap-3 px-4 md:px-8 py-4"
      style={{ background: "var(--color-pearl)", borderBottom: "1px solid var(--color-line)" }}
    >
      <button
        onClick={onBack}
        className="grid place-items-center rounded-full transition-colors hover:bg-ivory"
        style={{ width: 36, height: 36, color: "var(--color-ink)" }}
        aria-label="返回"
      >
        <ChevronLeft size={20} />
      </button>
      <div className="flex-1 min-w-0">
        <div
          className="font-serif truncate"
          style={{ color: "var(--color-ink)", fontSize: 18, letterSpacing: "0.04em" }}
        >
          {title}
        </div>
        {subtitle && (
          <div className="truncate" style={{ color: "var(--color-mute)", fontSize: 11.5, marginTop: 1 }}>
            {subtitle}
          </div>
        )}
      </div>
      {right}
    </header>
  )
}
