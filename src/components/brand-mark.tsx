"use client"

export function BrandMark({ size = 40, animated = false, className = "" }: { size?: number; animated?: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${animated ? "lux-breathe" : ""} ${className}`}
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, var(--color-ink) 0%, var(--color-ink-soft) 100%)",
        boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--color-champagne), transparent 55%)",
      }}
      aria-hidden="true"
    >
      <img
        src="/wenlan-yizhantong.ico"
        alt=""
        style={{
          width: size * 0.58,
          height: size * 0.58,
          borderRadius: "50%",
          objectFit: "cover",
        }}
      />
    </span>
  )
}
