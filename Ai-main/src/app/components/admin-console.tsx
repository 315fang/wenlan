import { Edit3, FileText, Image as ImageIcon, Lock, Phone, Plus, Table as TableIcon, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from './page-header';

interface AdminConsoleProps {
  onBack: () => void;
}

type Tab = 'articles' | 'images' | 'tables' | 'contacts';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'articles', label: '文章管理', icon: <FileText size={14} /> },
  { id: 'images', label: '图片管理', icon: <ImageIcon size={14} /> },
  { id: 'tables', label: '表格管理', icon: <TableIcon size={14} /> },
  { id: 'contacts', label: '联系方式', icon: <Phone size={14} /> },
];

const DEFAULT_PASSWORD = 'wenlanfuhu';

interface ArticleItem { id: string; title: string; tag: string; updatedAt: string; }
interface ImageItem { id: string; name: string; size: string; updatedAt: string; hue: string; }
interface TableItem { id: string; name: string; rows: number; updatedAt: string; }
interface ContactItem { id: string; label: string; value: string; }

const SEED_ARTICLES: ArticleItem[] = [
  { id: 'a1', title: '问兰焕活精华 · 成分白皮书', tag: '产品 / 成分', updatedAt: '2026-05-18' },
  { id: 'a2', title: '换季敏感肌护理指南', tag: '科普 / 护理', updatedAt: '2026-05-12' },
  { id: 'a3', title: '代理合作政策 2026 春季版', tag: '商务 / 政策', updatedAt: '2026-04-29' },
];
const SEED_IMAGES: ImageItem[] = [
  { id: 'i1', name: 'spring-truffle-main.jpg', size: '3.4 MB', updatedAt: '2026-05-20', hue: 'linear-gradient(135deg,#f1dcd1,#e5d4b6)' },
  { id: 'i2', name: 'essence-product-01.jpg', size: '2.1 MB', updatedAt: '2026-05-19', hue: 'linear-gradient(135deg,#ebe2d2,#d9cfbd)' },
  { id: 'i3', name: 'cream-gift-box.jpg', size: '4.0 MB', updatedAt: '2026-05-16', hue: 'linear-gradient(135deg,#f7f3ec,#c9a87a)' },
];
const SEED_TABLES: TableItem[] = [
  { id: 't1', name: '产品零售价目表', rows: 24, updatedAt: '2026-05-15' },
  { id: 't2', name: '代理等级与返点', rows: 6, updatedAt: '2026-04-30' },
];
const SEED_CONTACTS: ContactItem[] = [
  { id: 'c1', label: '官方微信', value: 'wenlan-skin' },
  { id: 'c2', label: '商务电话', value: '400-823-0316' },
  { id: 'c3', label: '商务邮箱', value: 'biz@wenlan.top' },
];

export function AdminConsole({ onBack }: AdminConsoleProps) {
  const [authed, setAuthed] = useState(false);
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState(false);
  const [tab, setTab] = useState<Tab>('articles');

  const [articles, setArticles] = useState(SEED_ARTICLES);
  const [images, setImages] = useState(SEED_IMAGES);
  const [tables, setTables] = useState(SEED_TABLES);
  const [contacts, setContacts] = useState(SEED_CONTACTS);

  const tryAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd === DEFAULT_PASSWORD) {
      setAuthed(true);
      setErr(false);
    } else {
      setErr(true);
    }
  };

  if (!authed) {
    return (
      <div className="flex flex-col w-full h-full" style={{ background: '#f7f3ec' }}>
        <PageHeader title="知识库后台" subtitle="授权访问 · 仅运营可用" onBack={onBack} />
        <div className="flex-1 grid place-items-center px-6">
          <form
            onSubmit={tryAuth}
            className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: '#ffffff', border: '1px solid #e6dccb' }}
          >
            <div
              className="grid place-items-center rounded-full mx-auto"
              style={{ width: 52, height: 52, background: '#1a1410', color: '#c9a87a' }}
            >
              <Lock size={20} />
            </div>
            <div
              className="font-serif text-center mt-4"
              style={{ color: '#1a1410', fontSize: 18, letterSpacing: '0.04em' }}
            >
              请输入管理密码
            </div>
            <div
              className="text-center mt-1"
              style={{ color: '#8c8276', fontSize: 12, letterSpacing: '0.06em' }}
            >
              默认密码可在服务端环境变量中修改
            </div>
            <input
              type="password"
              value={pwd}
              onChange={(e) => { setPwd(e.target.value); setErr(false); }}
              placeholder="管理密码"
              className="w-full mt-5 rounded-full px-4 py-2.5 outline-none"
              style={{
                background: '#f7f3ec',
                border: `1px solid ${err ? '#d9b3a4' : '#e6dccb'}`,
                color: '#1a1410',
                fontSize: 14,
                fontFamily: 'var(--font-sans)',
              }}
            />
            {err && (
              <div style={{ color: '#a4503c', fontSize: 12, marginTop: 6 }}>密码不正确，请重试。</div>
            )}
            <button
              type="submit"
              className="w-full mt-4 rounded-full py-2.5"
              style={{
                background: '#1a1410',
                color: '#f7f3ec',
                fontSize: 13,
                letterSpacing: '0.1em',
              }}
            >
              进入后台
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full" style={{ background: '#f7f3ec' }}>
      <PageHeader title="知识库后台" subtitle="文章 · 图片 · 表格 · 联系方式" onBack={onBack} />

      <div className="shrink-0 px-4 md:px-8 pt-4 pb-3">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-all"
                style={{
                  background: active ? '#1a1410' : '#ffffff',
                  color: active ? '#f7f3ec' : '#1a1410',
                  border: active ? '1px solid #1a1410' : '1px solid #e6dccb',
                  fontSize: 13,
                  letterSpacing: '0.06em',
                }}
              >
                {t.icon}
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="@container flex-1 min-h-0 overflow-y-auto lux-scroll px-4 md:px-8 pb-6">
        {tab === 'articles' && (
          <ArticlesPanel
            items={articles}
            onAdd={() =>
              setArticles((a) => [
                { id: Math.random().toString(36).slice(2, 8), title: '未命名文章', tag: '未分类', updatedAt: today() },
                ...a,
              ])
            }
            onDelete={(id) => setArticles((a) => a.filter((x) => x.id !== id))}
          />
        )}
        {tab === 'images' && (
          <ImagesPanel
            items={images}
            onAdd={() =>
              setImages((a) => [
                {
                  id: Math.random().toString(36).slice(2, 8),
                  name: 'new-upload.jpg',
                  size: '1.0 MB',
                  updatedAt: today(),
                  hue: 'linear-gradient(135deg,#f7f3ec,#e6dccb)',
                },
                ...a,
              ])
            }
            onDelete={(id) => setImages((a) => a.filter((x) => x.id !== id))}
          />
        )}
        {tab === 'tables' && (
          <TablesPanel
            items={tables}
            onAdd={() =>
              setTables((a) => [
                { id: Math.random().toString(36).slice(2, 8), name: '未命名表格.xlsx', rows: 0, updatedAt: today() },
                ...a,
              ])
            }
            onDelete={(id) => setTables((a) => a.filter((x) => x.id !== id))}
          />
        )}
        {tab === 'contacts' && (
          <ContactsPanel
            items={contacts}
            onChange={(id, value) =>
              setContacts((a) => a.map((c) => (c.id === id ? { ...c, value } : c)))
            }
          />
        )}
      </div>
    </div>
  );
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Dropzone({ hint, onAdd }: { hint: string; onAdd: () => void }) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragEnter={(e) => { e.preventDefault(); setOver(true); }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onAdd(); }}
      onClick={onAdd}
      className="rounded-2xl grid place-items-center cursor-pointer transition-colors"
      style={{
        background: over ? '#ebe2d2' : '#ffffff',
        border: `1px dashed ${over ? '#c9a87a' : '#e6dccb'}`,
        minHeight: 120,
        color: '#8c8276',
      }}
    >
      <div className="flex flex-col items-center gap-1.5">
        <div
          className="grid place-items-center rounded-full"
          style={{ width: 36, height: 36, background: '#f7f3ec', color: '#1a1410' }}
        >
          <Upload size={16} />
        </div>
        <div style={{ fontSize: 13, color: '#1a1410' }}>拖拽文件到此处，或点击选择</div>
        <div style={{ fontSize: 11.5 }}>{hint}</div>
      </div>
    </div>
  );
}

function PanelHeader({ title, count, onAdd }: { title: string; count: number; onAdd?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-baseline gap-2">
        <div className="font-serif" style={{ color: '#1a1410', fontSize: 16, letterSpacing: '0.04em' }}>
          {title}
        </div>
        <div style={{ color: '#8c8276', fontSize: 12 }}>共 {count} 条</div>
      </div>
      {onAdd && (
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"
          style={{ background: '#1a1410', color: '#f7f3ec', fontSize: 12, letterSpacing: '0.06em' }}
        >
          <Plus size={13} />
          新增
        </button>
      )}
    </div>
  );
}

function RowActions({ onDelete }: { onDelete: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <button
        className="grid place-items-center rounded-full transition-colors hover:bg-[#f7f3ec]"
        style={{ width: 30, height: 30, color: '#8c8276' }}
        aria-label="编辑"
      >
        <Edit3 size={14} />
      </button>
      <button
        onClick={onDelete}
        className="grid place-items-center rounded-full transition-colors hover:bg-[#f7f3ec]"
        style={{ width: 30, height: 30, color: '#a4503c' }}
        aria-label="删除"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function ArticlesPanel({
  items,
  onAdd,
  onDelete,
}: {
  items: ArticleItem[];
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <Dropzone hint="支持 .md / .docx / .txt" onAdd={onAdd} />
      <div className="rounded-2xl overflow-hidden" style={{ background: '#ffffff', border: '1px solid #e6dccb' }}>
        <div className="px-4 pt-4">
          <PanelHeader title="文章库" count={items.length} onAdd={onAdd} />
        </div>
        <div className="divide-y" style={{ borderColor: '#f1ebde' }}>
          {items.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-3">
              <div
                className="grid place-items-center rounded-xl shrink-0"
                style={{ width: 36, height: 36, background: '#f7f3ec', color: '#1a1410' }}
              >
                <FileText size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate" style={{ color: '#1a1410', fontSize: 14 }}>{a.title}</div>
                <div style={{ color: '#8c8276', fontSize: 12, marginTop: 2 }}>
                  {a.tag} · 更新于 {a.updatedAt}
                </div>
              </div>
              <RowActions onDelete={() => onDelete(a.id)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ImagesPanel({
  items,
  onAdd,
  onDelete,
}: {
  items: ImageItem[];
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <Dropzone hint="支持 .jpg / .png / .webp，单文件 ≤ 10MB" onAdd={onAdd} />
      <div className="rounded-2xl p-4" style={{ background: '#ffffff', border: '1px solid #e6dccb' }}>
        <PanelHeader title="图片库" count={items.length} onAdd={onAdd} />
        <div className="grid grid-cols-2 @lg:grid-cols-3 @3xl:grid-cols-4 gap-3">
          {items.map((img) => (
            <div
              key={img.id}
              className="rounded-2xl overflow-hidden"
              style={{ background: '#f7f3ec', border: '1px solid #e6dccb' }}
            >
              <div className="grid place-items-center" style={{ height: 96, background: img.hue }}>
                <ImageIcon size={22} style={{ color: 'rgba(26,20,16,0.4)' }} />
              </div>
              <div className="px-3 py-2.5">
                <div className="truncate" style={{ color: '#1a1410', fontSize: 13 }}>{img.name}</div>
                <div style={{ color: '#8c8276', fontSize: 11.5, marginTop: 2 }}>
                  {img.size} · {img.updatedAt}
                </div>
                <div className="mt-1.5 -ml-1">
                  <RowActions onDelete={() => onDelete(img.id)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TablesPanel({
  items,
  onAdd,
  onDelete,
}: {
  items: TableItem[];
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <Dropzone hint="支持 .xlsx / .csv" onAdd={onAdd} />
      <div className="rounded-2xl overflow-hidden" style={{ background: '#ffffff', border: '1px solid #e6dccb' }}>
        <div className="px-4 pt-4">
          <PanelHeader title="表格库" count={items.length} onAdd={onAdd} />
        </div>
        <div className="divide-y" style={{ borderColor: '#f1ebde' }}>
          {items.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3">
              <div
                className="grid place-items-center rounded-xl shrink-0"
                style={{ width: 36, height: 36, background: '#f7f3ec', color: '#1a1410' }}
              >
                <TableIcon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate" style={{ color: '#1a1410', fontSize: 14 }}>{t.name}</div>
                <div style={{ color: '#8c8276', fontSize: 12, marginTop: 2 }}>
                  {t.rows} 行 · 更新于 {t.updatedAt}
                </div>
              </div>
              <RowActions onDelete={() => onDelete(t.id)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ContactsPanel({
  items,
  onChange,
}: {
  items: ContactItem[];
  onChange: (id: string, value: string) => void;
}) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #e6dccb' }}>
      <PanelHeader title="对外联系方式" count={items.length} />
      <div className="space-y-3">
        {items.map((c) => (
          <div key={c.id}>
            <div style={{ color: '#8c8276', fontSize: 12, letterSpacing: '0.06em', marginBottom: 6 }}>
              {c.label}
            </div>
            <input
              value={c.value}
              onChange={(e) => onChange(c.id, e.target.value)}
              className="w-full rounded-full px-4 py-2.5 outline-none"
              style={{
                background: '#f7f3ec',
                border: '1px solid #e6dccb',
                color: '#1a1410',
                fontSize: 14,
                fontFamily: 'var(--font-sans)',
              }}
            />
          </div>
        ))}
      </div>
      <div
        className="mt-4 rounded-xl px-3 py-2.5"
        style={{ background: '#f7f3ec', color: '#3a322a', fontSize: 12.5, lineHeight: 1.65 }}
      >
        修改后会同步到「商务中心」展示页与问小兰的回复模板。
      </div>
    </div>
  );
}
