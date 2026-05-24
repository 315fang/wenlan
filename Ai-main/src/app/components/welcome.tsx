import { BrandMark } from './brand-mark';

interface WelcomeProps {
  onPick: (prompt: string) => void;
  variant?: 'mobile' | 'desktop';
}

const SUGGESTIONS = [
  { tag: '成分', text: '问兰核心精华里有哪些活性成分？' },
  { tag: '搭配', text: '换季敏感肌，推荐一套日常护理流程' },
  { tag: '素材', text: '帮我准备一组「春日松露光感」朋友圈文案' },
  { tag: '商务', text: '想了解代理政策与价目区间' },
];

export function Welcome({ onPick, variant = 'mobile' }: WelcomeProps) {
  if (variant === 'desktop') return <DesktopWelcome onPick={onPick} />;
  return <MobileWelcome onPick={onPick} />;
}

function MobileWelcome({ onPick }: { onPick: (p: string) => void }) {
  return (
    <div className="w-full px-6 py-4 text-center">
      <div className="flex justify-center lux-in">
        <BrandMark size={52} animated />
      </div>
      <h1
        className="font-serif mt-4 w-full lux-in-1 lux-shimmer-text"
        style={{ fontSize: 26, letterSpacing: '0.04em', lineHeight: 1.25 }}
      >
        晚安，欢迎回到问兰
      </h1>
      <p
        className="font-serif mt-2 w-full lux-in-2"
        style={{ color: '#8c8276', fontSize: 14, letterSpacing: '0.18em' }}
      >
        SKIN&nbsp;·&nbsp;SCIENCE&nbsp;·&nbsp;SERENITY
      </p>
      <p
        className="mt-4 w-full mx-auto lux-in-3"
        style={{ color: '#3a322a', fontSize: 14.5, lineHeight: 1.8, maxWidth: 360 }}
      >
        我是问小兰，问兰的专属智能客服。从成分、搭配到官方素材、商务对接，您都可以从这里开始问我。
      </p>

      <div className="mt-6 grid grid-cols-1 gap-2.5 w-full lux-in-4">
        {SUGGESTIONS.map((s, i) => (
          <div key={s.text} style={{ animationDelay: `${0.4 + i * 0.07}s` }} className="lux-in">
            <SuggestionCard tag={s.tag} text={s.text} onClick={() => onPick(s.text)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function DesktopWelcome({ onPick }: { onPick: (p: string) => void }) {
  return (
    <div className="w-full max-w-5xl mx-auto px-10 py-10">
      {/* Hero */}
      <div className="flex items-center gap-6">
        <div className="lux-in">
          <BrandMark size={72} animated />
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="font-serif lux-in-1"
            style={{ color: '#c9a87a', fontSize: 12, letterSpacing: '0.28em' }}
          >
            WENLAN&nbsp;·&nbsp;SKIN&nbsp;SCIENCE
          </div>
          <h1
            className="font-serif mt-1 lux-in-2 lux-shimmer-text"
            style={{ fontSize: 34, letterSpacing: '0.04em', lineHeight: 1.2 }}
          >
            晚安，欢迎回到问兰
          </h1>
          <p
            className="mt-2 lux-in-3"
            style={{ color: '#3a322a', fontSize: 15, lineHeight: 1.8, maxWidth: 640 }}
          >
            我是问小兰，问兰的专属智能客服。从成分、搭配到官方素材、商务对接，
            您都可以在这里向我提问。
          </p>
        </div>
      </div>

      {/* Divider line */}
      <div
        className="mt-8 mb-6 lux-in-4"
        style={{ height: 1, background: 'linear-gradient(90deg,transparent,#e6dccb,transparent)' }}
      />

      {/* Suggestions row */}
      <div
        className="font-serif lux-in-4"
        style={{ color: '#8c8276', fontSize: 11.5, letterSpacing: '0.24em' }}
      >
        SUGGESTED · 推 荐 问 题
      </div>
      <div className="mt-3 grid grid-cols-2 @4xl:grid-cols-4 gap-3">
        {SUGGESTIONS.map((s, i) => (
          <div key={s.text} style={{ animationDelay: `${0.45 + i * 0.08}s` }} className="lux-in">
            <SuggestionCard tag={s.tag} text={s.text} onClick={() => onPick(s.text)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SuggestionCard({
  tag,
  text,
  onClick,
}: {
  tag: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="lux-card lux-press text-left rounded-2xl px-4 py-3.5 w-full"
      style={{
        background: '#ffffff',
        border: '1px solid #e6dccb',
        boxShadow: '0 1px 0 rgba(201,168,122,0.06)',
      }}
    >
      <div
        className="font-serif"
        style={{ color: '#c9a87a', fontSize: 11, letterSpacing: '0.22em', marginBottom: 4 }}
      >
        {tag.toUpperCase()}
      </div>
      <div style={{ color: '#1a1410', fontSize: 14, lineHeight: 1.55 }}>{text}</div>
    </button>
  );
}
