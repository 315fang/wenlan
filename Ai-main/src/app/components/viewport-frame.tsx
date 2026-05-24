import { Monitor, Smartphone } from 'lucide-react';

export type ViewportMode = 'desktop' | 'mobile';

interface ToggleProps {
  mode: ViewportMode;
  onChange: (m: ViewportMode) => void;
}

export function ViewportToggle({ mode, onChange }: ToggleProps) {
  return (
    <div
      className="fixed z-[100] flex items-center gap-1 rounded-full p-1"
      style={{
        top: 14,
        right: 14,
        background: 'rgba(26,20,16,0.86)',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 6px 18px -8px rgba(26,20,16,0.4)',
      }}
    >
      {([
        { id: 'desktop' as const, icon: <Monitor size={14} />, label: '桌面' },
        { id: 'mobile' as const, icon: <Smartphone size={14} />, label: '手机' },
      ]).map((opt) => {
        const active = mode === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all"
            style={{
              background: active ? '#f7f3ec' : 'transparent',
              color: active ? '#1a1410' : '#efe7da',
              fontSize: 12,
              letterSpacing: '0.08em',
            }}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

interface FrameProps {
  mode: ViewportMode;
  children: React.ReactNode;
}

/**
 * In desktop mode: full bleed.
 * In mobile mode: render the app inside a 390x844 phone-shaped frame, centered
 * on a soft backdrop, so the mobile layout can be reviewed alongside desktop
 * inside the fixed-width Figma Make preview.
 */
export function ViewportFrame({ mode, children }: FrameProps) {
  if (mode === 'desktop') {
    return <div className="w-full h-full">{children}</div>;
  }
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{
        background:
          'radial-gradient(ellipse at center, #ebe2d2 0%, #d9cfbd 100%)',
        padding: 24,
      }}
    >
      <div
        className="relative overflow-hidden"
        style={{
          width: 390,
          height: 'min(844px, calc(100vh - 48px))',
          borderRadius: 44,
          background: '#000',
          padding: 10,
          boxShadow:
            '0 30px 60px -20px rgba(26,20,16,0.45), 0 0 0 2px rgba(0,0,0,0.6) inset',
        }}
      >
        <div
          className="w-full h-full overflow-hidden relative"
          style={{ borderRadius: 34, background: '#ffffff' }}
        >
          {/* notch */}
          <div
            className="absolute left-1/2 -translate-x-1/2 z-10"
            style={{
              top: 8,
              width: 110,
              height: 26,
              background: '#000',
              borderRadius: 999,
            }}
          />
          {children}
        </div>
      </div>
    </div>
  );
}
