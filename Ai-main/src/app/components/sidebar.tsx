import { Library, MessageSquarePlus, Phone, Trash2, X } from 'lucide-react';
import type { ChatSession } from './api';
import { BrandMark } from './brand-mark';

interface SidebarProps {
  sessions: ChatSession[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  mode: 'fashion' | 'efficiency';
  onMode: (m: 'fashion' | 'efficiency') => void;
  onClose?: () => void;
  isMobile?: boolean;
  onOpenView: (view: 'materials' | 'business') => void;
}

function ts(t: number) {
  const d = new Date(t);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export function Sidebar({
  sessions,
  activeId,
  onSelect,
  onNew,
  onDelete,
  mode,
  onMode,
  onClose,
  isMobile,
  onOpenView,
}: SidebarProps) {
  return (
    <aside
      className="flex flex-col h-full"
      style={{
        background: '#f7f3ec',
        borderRight: isMobile ? 'none' : '1px solid #e6dccb',
        width: isMobile ? '100%' : 320,
        maxWidth: isMobile ? '100%' : 360,
        boxShadow: isMobile ? '4px 0 24px -12px rgba(26,20,16,0.3)' : 'none',
      }}
    >
      {/* Brand header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <BrandMark size={44} animated />
        <div className="flex-1 min-w-0">
          <div className="font-serif" style={{ color: '#1a1410', fontSize: 19, letterSpacing: '0.02em' }}>
            问兰 · WENLAN
          </div>
          <div style={{ color: '#8c8276', fontSize: 12, letterSpacing: '0.06em' }}>
            肌研智能 · 轻奢护肤顾问
          </div>
        </div>
        {isMobile && (
          <button
            onClick={onClose}
            className="grid place-items-center rounded-full"
            style={{ width: 32, height: 32, color: '#1a1410' }}
            aria-label="关闭"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Function entries */}
      <div className="px-5 mt-2">
        <div
          className="font-serif mb-2 px-1"
          style={{ color: '#8c8276', fontSize: 11.5, letterSpacing: '0.2em' }}
        >
          功 能 入 口
        </div>
        <div className="space-y-2">
          <EntryCard
            icon={<Library size={18} />}
            title="素材中心"
            sub="官方主图 · 朋友圈 · 社群文案"
            onClick={() => onOpenView('materials')}
          />
          <EntryCard
            icon={<Phone size={18} />}
            title="商务中心"
            sub="代理对接 · 合作咨询 · 价目"
            onClick={() => onOpenView('business')}
          />
        </div>
      </div>

      {/* Recent */}
      <div className="px-5 mt-6 flex-1 min-h-0 flex flex-col">
        <div
          className="font-serif mb-2 px-1"
          style={{ color: '#8c8276', fontSize: 11.5, letterSpacing: '0.2em' }}
        >
          最 近 对 话
        </div>
        <div className="flex-1 overflow-y-auto lux-scroll pr-1 space-y-1.5">
          {sessions.map((s) => {
            const active = s.id === activeId;
            return (
              <div
                key={s.id}
                onClick={() => onSelect(s.id)}
                className="group flex items-center gap-2 rounded-2xl px-3 py-2.5 cursor-pointer transition-colors"
                style={{
                  background: active ? '#ffffff' : 'transparent',
                  border: active ? '1px solid #e6dccb' : '1px solid transparent',
                }}
              >
                <div className="flex-1 min-w-0">
                  <div
                    className="truncate"
                    style={{ color: '#1a1410', fontSize: 14, letterSpacing: '0.01em' }}
                  >
                    {s.title || '新对话'}
                  </div>
                  <div style={{ color: '#8c8276', fontSize: 11.5, marginTop: 2 }}>{ts(s.updatedAt)}</div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(s.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full p-1.5"
                  style={{ color: '#8c8276' }}
                  aria-label="删除"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
          {sessions.length === 0 && (
            <div style={{ color: '#8c8276', fontSize: 12.5, padding: '8px 4px' }}>
              暂无历史，开启一段新的肌研对话吧。
            </div>
          )}
        </div>
      </div>

      {/* New conversation + mode toggle */}
      <div className="px-5 pt-3 pb-5 space-y-3">
        <button
          onClick={onNew}
          className="lux-press w-full flex items-center justify-center gap-2 rounded-full py-3 transition-opacity hover:opacity-90"
          style={{
            background: '#1a1410',
            color: '#f7f3ec',
            fontSize: 14,
            letterSpacing: '0.08em',
          }}
        >
          <MessageSquarePlus size={16} />
          开启新对话
        </button>
        <div
          className="grid grid-cols-2 rounded-full p-1"
          style={{ background: '#ebe2d2' }}
        >{/* mode toggle */}
          {(['fashion', 'efficiency'] as const).map((m) => {
            const active = m === mode;
            return (
              <button
                key={m}
                onClick={() => onMode(m)}
                className="rounded-full py-2 transition-all"
                style={{
                  background: active ? '#ffffff' : 'transparent',
                  color: active ? '#1a1410' : '#8c8276',
                  fontSize: 13,
                  letterSpacing: '0.08em',
                  boxShadow: active ? '0 1px 2px rgba(26,20,16,0.06)' : 'none',
                }}
              >
                {m === 'fashion' ? '时尚版' : '效率版'}
              </button>
            );
          })}
        </div>

      </div>
    </aside>
  );
}

function EntryCard({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="lux-card lux-press w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 text-left"
      style={{
        background: '#ffffff',
        border: '1px solid #e6dccb',
      }}
    >
      <div
        className="grid place-items-center rounded-xl shrink-0"
        style={{ width: 38, height: 38, background: '#1a1410', color: '#c9a87a' }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div style={{ color: '#1a1410', fontSize: 14, letterSpacing: '0.02em' }}>{title}</div>
        <div className="truncate" style={{ color: '#8c8276', fontSize: 12, marginTop: 1 }}>
          {sub}
        </div>
      </div>
    </button>
  );
}
