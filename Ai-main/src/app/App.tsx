import { Menu, MoreHorizontal } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage, ChatSession } from './components/api';
import { streamChat } from './components/api';
import { AdminConsole } from './components/admin-console';
import { Bubble } from './components/bubble';
import { BusinessCenter } from './components/business-center';
import { Composer } from './components/composer';
import { MaterialsCenter } from './components/materials-center';
import { Sidebar } from './components/sidebar';
import type { ViewportMode } from './components/viewport-frame';
import { ViewportFrame, ViewportToggle } from './components/viewport-frame';
import { Welcome } from './components/welcome';

const newId = () => Math.random().toString(36).slice(2, 10);

function freshSession(): ChatSession {
  return { id: newId(), title: '新对话', updatedAt: Date.now(), messages: [] };
}

type AppMode = 'client' | 'admin';

function readAppMode(): AppMode {
  if (typeof window === 'undefined') return 'client';
  return window.location.hash.includes('admin') ? 'admin' : 'client';
}

export default function App() {
  const [viewport, setViewport] = useState<ViewportMode>('desktop');
  const [sessions, setSessions] = useState<ChatSession[]>(() => [freshSession()]);
  const [activeId, setActiveId] = useState<string>(() => sessions[0].id);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mode, setMode] = useState<'fashion' | 'efficiency'>('efficiency');
  const [view, setView] = useState<'chat' | 'materials' | 'business'>('chat');
  const [appMode, setAppMode] = useState<AppMode>(() => readAppMode());

  useEffect(() => {
    const onHash = () => setAppMode(readAppMode());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const switchApp = (m: AppMode) => {
    window.location.hash = m === 'admin' ? '#admin' : '';
    setAppMode(m);
  };

  return (
    <div
      className="overflow-hidden"
      style={{ position: 'fixed', inset: 0, background: '#0e0b08' }}
    >
      <ViewportToggle mode={viewport} onChange={setViewport} />
      <AppSwitch mode={appMode} onChange={switchApp} />
      <ViewportFrame mode={viewport}>
        {appMode === 'admin' ? (
          <AdminConsole onBack={() => switchApp('client')} />
        ) : (
          <Shell
            viewport={viewport}
            sessions={sessions}
            setSessions={setSessions}
            activeId={activeId}
            setActiveId={setActiveId}
            drawerOpen={drawerOpen}
            setDrawerOpen={setDrawerOpen}
            mode={mode}
            setMode={setMode}
            view={view}
            setView={setView}
          />
        )}
      </ViewportFrame>
    </div>
  );
}

function AppSwitch({ mode, onChange }: { mode: AppMode; onChange: (m: AppMode) => void }) {
  return (
    <div
      className="fixed z-50 flex items-center rounded-full p-1"
      style={{
        top: 16,
        right: 16,
        background: 'rgba(247,243,236,0.95)',
        border: '1px solid #e6dccb',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
      }}
    >
      {(['client', 'admin'] as AppMode[]).map((m) => {
        const active = m === mode;
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            className="rounded-full px-3 py-1.5 transition-all"
            style={{
              background: active ? '#1a1410' : 'transparent',
              color: active ? '#f7f3ec' : '#1a1410',
              fontSize: 12,
              letterSpacing: '0.08em',
            }}
          >
            {m === 'client' ? '用户端' : '知识库后台'}
          </button>
        );
      })}
    </div>
  );
}

interface ShellProps {
  viewport: ViewportMode;
  sessions: ChatSession[];
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  activeId: string;
  setActiveId: (id: string) => void;
  drawerOpen: boolean;
  setDrawerOpen: (b: boolean) => void;
  mode: 'fashion' | 'efficiency';
  setMode: (m: 'fashion' | 'efficiency') => void;
  view: 'chat' | 'materials' | 'business';
  setView: (v: 'chat' | 'materials' | 'business') => void;
}

function Shell({
  viewport,
  sessions,
  setSessions,
  activeId,
  setActiveId,
  drawerOpen,
  setDrawerOpen,
  mode,
  setMode,
  view,
  setView,
}: ShellProps) {
  const isMobile = viewport === 'mobile';
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const active = useMemo(
    () => sessions.find((s) => s.id === activeId) ?? sessions[0],
    [sessions, activeId],
  );

  useEffect(() => {
    if (!active || active.messages.length === 0) return;
    const el = scrollerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [active?.messages.length]);

  const updateActive = (mut: (s: ChatSession) => ChatSession) => {
    setSessions((prev) => prev.map((s) => (s.id === activeId ? mut(s) : s)));
  };

  const handleSend = async (text: string) => {
    const userMsg: ChatMessage = { id: newId(), role: 'user', text, ts: Date.now() };
    const aiMsg: ChatMessage = { id: newId(), role: 'ai', text: '', ts: Date.now() };
    updateActive((s) => ({
      ...s,
      title: s.messages.length === 0 ? text.slice(0, 18) : s.title,
      updatedAt: Date.now(),
      messages: [...s.messages, userMsg, aiMsg],
    }));

    await streamChat(text, (delta) => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeId) return s;
          const msgs = [...s.messages];
          const last = msgs[msgs.length - 1];
          if (last && last.role === 'ai') {
            msgs[msgs.length - 1] = { ...last, text: last.text + delta };
          }
          return { ...s, messages: msgs, updatedAt: Date.now() };
        }),
      );
    });
  };

  const handleNew = () => {
    const s = freshSession();
    setSessions((prev) => [s, ...prev]);
    setActiveId(s.id);
    setDrawerOpen(false);
  };
  const handleSelect = (id: string) => {
    setActiveId(id);
    setDrawerOpen(false);
  };
  const handleDelete = (id: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) {
        const fresh = freshSession();
        setActiveId(fresh.id);
        return [fresh];
      }
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  };

  const messages = active?.messages ?? [];
  const isEmpty = messages.length === 0;
  const lastAiPending =
    messages.length > 0 &&
    messages[messages.length - 1].role === 'ai' &&
    messages[messages.length - 1].text === '';

  const backToChat = () => setView('chat');
  const pageNode =
    view === 'materials' ? (
      <MaterialsCenter onBack={backToChat} />
    ) : view === 'business' ? (
      <BusinessCenter onBack={backToChat} />
    ) : null;

  const sidebarNode = (
    <Sidebar
      sessions={sessions}
      activeId={activeId}
      onSelect={handleSelect}
      onNew={handleNew}
      onDelete={handleDelete}
      mode={mode}
      onMode={setMode}
      onClose={() => setDrawerOpen(false)}
      isMobile={isMobile}
      onOpenView={(v) => { setView(v); setDrawerOpen(false); }}
    />
  );

  // === Mobile layout ===
  if (isMobile) {
    return (
      <div
        className="relative flex flex-col w-full h-full overflow-hidden"
        style={{ background: '#ffffff', color: '#1a1410' }}
      >
        {/* status notch spacer */}
        <div style={{ height: 36 }} />

        {pageNode ? (
          <>
            <div className="flex-1 min-h-0">{pageNode}</div>
            <div className="flex justify-center pb-1.5 shrink-0">
              <div style={{ width: 110, height: 4, borderRadius: 999, background: '#1a1410' }} />
            </div>
            {drawerOpen && (
              <div className="absolute inset-0 z-40 flex" style={{ top: 36 }}>
                <div
                  onClick={() => setDrawerOpen(false)}
                  className="absolute inset-0"
                  style={{ background: 'rgba(26,20,16,0.4)', backdropFilter: 'blur(2px)' }}
                />
                <div className="relative z-10 h-full" style={{ width: '86%', maxWidth: 340 }}>
                  {sidebarNode}
                </div>
              </div>
            )}
          </>
        ) : (
        <>
        <div
          className="flex flex-col flex-1 min-h-0"
          style={{ zoom: mode === 'efficiency' ? 1.12 : 1 } as React.CSSProperties}
        >
        {/* Header */}
        <header
          className="flex items-center gap-2 px-5 pb-3 shrink-0"
          style={{ background: '#ffffff' }}
        >
          <button
            onClick={() => setDrawerOpen(true)}
            className="grid place-items-center rounded-full"
            style={{ width: 36, height: 36, color: '#1a1410' }}
            aria-label="菜单"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1 text-center">
            <div
              className="font-serif"
              style={{ color: '#1a1410', fontSize: 16, letterSpacing: '0.06em' }}
            >
              问兰 · 肌研顾问
            </div>
            <div style={{ color: '#8c8276', fontSize: 11 }}>wenlan.maodian316.top</div>
          </div>
          <button
            className="grid place-items-center rounded-full"
            style={{ width: 36, height: 36, color: '#1a1410' }}
            aria-label="更多"
          >
            <MoreHorizontal size={18} />
          </button>
        </header>

        <div
          className="shrink-0"
          style={{ height: 1, background: '#f1ebde', margin: '0 20px' }}
        />

        {/* Conversation */}
        <div
          ref={scrollerRef}
          className="flex-1 min-h-0 overflow-y-auto lux-scroll"
          style={{ background: '#ffffff' }}
        >
          {isEmpty ? (
            <div className="min-h-full flex items-center justify-center">
              <Welcome onPick={handleSend} variant="mobile" />
            </div>
          ) : (
            <div className="py-4 space-y-5">
              {messages.map((m, i) => (
                <Bubble
                  key={m.id}
                  role={m.role}
                  text={m.text}
                  pending={lastAiPending && i === messages.length - 1}
                />
              ))}
            </div>
          )}
        </div>

        {/* Composer */}
        <div
          className="shrink-0 px-5 pt-2 pb-3"
          style={{ background: '#ffffff', borderTop: '1px solid #f1ebde' }}
        >
          <Composer onSend={handleSend} />
        </div>
        </div>

        {/* home indicator */}
        <div className="flex justify-center pb-1.5 shrink-0">
          <div style={{ width: 110, height: 4, borderRadius: 999, background: '#1a1410' }} />
        </div>

        {/* Mobile drawer (absolute so it stays within phone frame) */}
        {drawerOpen && (
          <div className="absolute inset-0 z-40 flex">
            <div
              onClick={() => setDrawerOpen(false)}
              className="absolute inset-0"
              style={{ background: 'rgba(26,20,16,0.4)', backdropFilter: 'blur(2px)' }}
            />
            <div
              className="relative z-10 h-full"
              style={{ width: '86%', maxWidth: 340 }}
            >
              {sidebarNode}
            </div>
          </div>
        )}
        </>
        )}
      </div>
    );
  }

  // === Desktop layout ===
  return (
    <div
      className="flex w-full h-full overflow-hidden"
      style={{ background: '#f7f3ec', color: '#1a1410' }}
    >
      <div className="shrink-0 h-full">{sidebarNode}</div>

      {pageNode ? (
        <main className="flex-1 min-w-0 flex flex-col h-full">{pageNode}</main>
      ) : (
      <main
        className="flex-1 min-w-0 flex flex-col h-full"
        style={{ zoom: mode === 'efficiency' ? 1.15 : 1 } as React.CSSProperties}
      >
        <header
          className="flex items-center gap-3 px-8 py-4 shrink-0"
          style={{ background: '#ffffff', borderBottom: '1px solid #e6dccb' }}
        >
          <div className="flex-1 flex items-center gap-3">
            <div
              className="font-serif"
              style={{ color: '#1a1410', fontSize: 20, letterSpacing: '0.04em' }}
            >
              {active?.title || '新对话'}
            </div>
            <span
              className="px-2.5 py-0.5 rounded-full"
              style={{
                background: '#f1dcd1',
                color: '#1a1410',
                fontSize: 11,
                letterSpacing: '0.12em',
              }}
            >
              {mode === 'fashion' ? '时尚版' : '效率版'}
            </span>
          </div>
          <button
            onClick={handleNew}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 transition-opacity hover:opacity-90"
            style={{
              background: '#1a1410',
              color: '#f7f3ec',
              fontSize: 13,
              letterSpacing: '0.08em',
            }}
          >
            新对话
          </button>
          <button
            className="grid place-items-center rounded-full"
            style={{ width: 36, height: 36, color: '#1a1410' }}
            aria-label="更多"
          >
            <MoreHorizontal size={18} />
          </button>
        </header>

        <div
          ref={scrollerRef}
          className="flex-1 min-h-0 overflow-y-auto lux-scroll"
          style={{ background: '#f7f3ec' }}
        >
          {isEmpty ? (
            <div className="@container min-h-full flex items-start justify-center px-6 py-10">
              <Welcome onPick={handleSend} variant="desktop" />
            </div>
          ) : (
            <div className="mx-auto w-full max-w-3xl py-10">
              <div className="space-y-6 px-2">
                {messages.map((m, i) => (
                  <Bubble
                    key={m.id}
                    role={m.role}
                    text={m.text}
                    pending={lastAiPending && i === messages.length - 1}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 px-8 pb-5 pt-3" style={{ background: '#f7f3ec' }}>
          <div className="mx-auto w-full max-w-3xl">
            <Composer onSend={handleSend} />
          </div>
        </div>
      </main>
      )}
    </div>
  );
}
