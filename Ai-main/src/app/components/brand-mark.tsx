export function BrandMark({ size = 40, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center rounded-full ${animated ? 'lux-breathe' : ''}`}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, #1a1410 0%, #3a322a 100%)',
        boxShadow: 'inset 0 0 0 1px rgba(201,168,122,0.45)',
      }}
    >
      <span
        className="font-serif"
        style={{
          color: '#c9a87a',
          fontSize: size * 0.42,
          letterSpacing: '0.04em',
          fontWeight: 600,
          lineHeight: 1,
        }}
      >
        WL
      </span>
    </div>
  );
}
