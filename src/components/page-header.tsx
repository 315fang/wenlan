"use client"

import type { ReactNode } from "react"
import { ChevronLeft } from "lucide-react"

type PageHeaderProps = {
  title: string
  subtitle?: string
  onBack: () => void
  right?: ReactNode
}

export function PageHeader({ title, subtitle, onBack, right }: PageHeaderProps) {
  return (
    <header
      className="shrink-0 flex items-center gap-3 px-4 md:px-8 py-4"
      style={{ background: "#ffffff", borderBottom: "1px solid #e6dccb" }}
    >
      <button
        onClick={onBack}
        className="grid place-items-center rounded-full transition-colors hover:bg-[#f7f3ec]"
        style={{ width: 36, height: 36, color: "#1a1410" }}
        aria-label="返回"
      >
        <ChevronLeft size={20} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="font-serif truncate" style={{ color: "#1a1410", fontSize: 18, letterSpacing: "0.04em" }}>
          {title}
        </div>
        {subtitle ? (
          <div className="truncate" style={{ color: "#8c8276", fontSize: 11.5, marginTop: 1 }}>
            {subtitle}
          </div>
        ) : null}
      </div>
      {right}
    </header>
  )
}
