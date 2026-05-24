import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { BrandMark } from './brand-mark';

interface BubbleProps {
  role: 'user' | 'ai';
  text: string;
  pending?: boolean;
}

export function Bubble({ role, text, pending }: BubbleProps) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  if (role === 'user') {
    return (
      <div className="flex justify-end px-6 md:px-0 lux-in">
        <div
          className="max-w-[78%] rounded-[20px] rounded-tr-[6px] px-5 py-3"
          style={{
            background: 'linear-gradient(135deg, #f1dcd1 0%, #e5d4b6 100%)',
            color: '#1a1410',
            fontSize: 15,
            lineHeight: 1.7,
            letterSpacing: '0.01em',
            boxShadow: '0 1px 0 rgba(201,168,122,0.18)',
          }}
        >
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 px-6 md:px-0 lux-in">
      <div className="shrink-0 mt-1">
        <BrandMark size={32} />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className="font-serif mb-1"
          style={{ color: '#8c8276', fontSize: 13, letterSpacing: '0.12em' }}
        >
          问小兰 · 智能客服
        </div>
        <div
          className="whitespace-pre-wrap"
          style={{
            color: '#1a1410',
            fontSize: 15.5,
            lineHeight: 1.85,
            letterSpacing: '0.01em',
          }}
        >
          {text}
          {pending && (
            <span className="inline-flex gap-1 ml-1 align-middle">
              <span className="lux-dot w-1.5 h-1.5 rounded-full" style={{ background: '#c9a87a' }} />
              <span className="lux-dot w-1.5 h-1.5 rounded-full" style={{ background: '#c9a87a' }} />
              <span className="lux-dot w-1.5 h-1.5 rounded-full" style={{ background: '#c9a87a' }} />
            </span>
          )}
        </div>
        {!pending && text && (
          <button
            onClick={onCopy}
            className="mt-3 inline-flex items-center gap-1.5 transition-colors"
            style={{ color: copied ? '#1a1410' : '#8c8276', fontSize: 12, letterSpacing: '0.06em' }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? '已复制' : '复制'}
          </button>
        )}
      </div>
    </div>
  );
}
