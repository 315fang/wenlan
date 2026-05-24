"use client"

export function BrandMark({ size = 40, animated = false, className = "" }: { size?: number; animated?: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${animated ? "lux-breathe" : ""} ${className}`}
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, #1a1410 0%, #3a322a 100%)",
        boxShadow: "inset 0 0 0 1px rgba(201,168,122,0.45)",
      }}
      aria-hidden="true"
    >
      <span
        className="font-serif"
        style={{
          color: "#c9a87a",
          fontSize: size * 0.42,
          fontWeight: 600,
          letterSpacing: "0.04em",
          lineHeight: 1,
        }}
      >
        WL
      </span>
    </span>
  )
}
