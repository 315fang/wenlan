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
