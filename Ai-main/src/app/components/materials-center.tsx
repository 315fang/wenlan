import { Check, Copy, Download, Image as ImageIcon, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from './page-header';

interface MaterialsCenterProps {
  onBack: () => void;
}

type Category = 'visual' | 'wechat' | 'community' | 'script';

interface MaterialItem {
  id: string;
  cat: Category;
  title: string;
  meta: string;
  copy?: string; // 文案类素材的可复制全文
  download?: string; // 下载占位
  hue: string; // 缩略图色调
}

const CATS: { id: Category; label: string }[] = [
  { id: 'visual', label: '官方主图' },
  { id: 'wechat', label: '朋友圈三连' },
  { id: 'community', label: '社群文案' },
  { id: 'script', label: '短视频脚本' },
];

const DATA: MaterialItem[] = [
  {
    id: 'v1',
    cat: 'visual',
    title: '春日松露光感 · 主视觉',
    meta: '4K · 9:16 · 3 张组图',
    download: 'wenlan-spring-truffle.zip',
    hue: 'linear-gradient(135deg,#f1dcd1 0%,#e5d4b6 100%)',
  },
  {
    id: 'v2',
    cat: 'visual',
    title: '焕活精华 · 产品展示',
    meta: '4K · 1:1 · 6 张组图',
    download: 'wenlan-essence.zip',
    hue: 'linear-gradient(135deg,#ebe2d2 0%,#d9cfbd 100%)',
  },
  {
    id: 'v3',
    cat: 'visual',
    title: '紧致赋活面霜 · 礼盒',
    meta: '4K · 4:5 · 4 张组图',
    download: 'wenlan-cream-gift.zip',
    hue: 'linear-gradient(135deg,#f7f3ec 0%,#e5d4b6 100%)',
  },
  {
    id: 'w1',
    cat: 'wechat',
    title: '换季敏感肌 · 三连图',
    meta: '朋友圈 · 3 张组图 + 文案',
    copy:
      '换季的脸，先别急着叠精华。\n问兰焕活系列里那支低敏神经酰胺，最近被我反复用——\n紧绷感、刺痛感，一周内安静下来。\n\n#问兰 #敏感肌护肤 #换季养肤',
    hue: 'linear-gradient(135deg,#f1dcd1 0%,#d9b3a4 100%)',
  },
  {
    id: 'w2',
    cat: 'wechat',
    title: '熬夜急救 · 三连图',
    meta: '朋友圈 · 3 张组图 + 文案',
    copy:
      '凌晨两点的脸，比谁都需要被温柔对待。\n问兰白松露多肽精华，是我加班包里固定的一支。\n第二天起床，至少不会被自己吓到。\n\n#问兰 #熬夜急救 #轻奢护肤',
    hue: 'linear-gradient(135deg,#e5d4b6 0%,#c9a87a 100%)',
  },
  {
    id: 'c1',
    cat: 'community',
    title: '新品上市 · 群发文案',
    meta: '社群 · 短文版',
    copy:
      '【问兰 · 焕活精华 2.0 上市】\n升级后的核心成分：5% 烟酰胺 + 雪绒花干细胞萃取\n首发期下单，赠送旅行装 30ml × 1。\n限时三天，戳链接锁定。',
    hue: 'linear-gradient(135deg,#ebe2d2 0%,#c9a87a 100%)',
  },
  {
    id: 'c2',
    cat: 'community',
    title: '用户口碑 · 长文案',
    meta: '社群 · 长文版',
    copy:
      '上周收到一位姐妹的反馈：\n用问兰紧致赋活面霜的第 21 天，法令纹真的浅了一点。\n她说这是她这两年用过最「不张扬但有用」的一支面霜。\n这大概就是我们想做的——\n轻奢，不是噪音，是质感。',
    hue: 'linear-gradient(135deg,#f1dcd1 0%,#ebe2d2 100%)',
  },
  {
    id: 's1',
    cat: 'script',
    title: '60s 体验官口播 · 焕活精华',
    meta: '短视频 · 60 秒 · 已分镜',
    copy:
      '【镜头 1 · 0-5s】\n手持产品，柔光下旋转，特写质地。\n旁白：「这支精华，是我今年最常回购的一支。」\n\n【镜头 2 · 5-25s】\n台面平铺，配合成分卡片。\n旁白：「核心是 5% 烟酰胺加雪绒花干细胞萃取，亮和稳，同时给你。」\n\n【镜头 3 · 25-50s】\n上脸演示，手部按压精华。\n旁白：「早晚两滴，21 天，肤色会自己告诉你答案。」\n\n【镜头 4 · 50-60s】\n收尾留品牌 Logo。\n字幕：「问兰 · 让护肤回到安静的样子。」',
    hue: 'linear-gradient(135deg,#d9b3a4 0%,#c9a87a 100%)',
  },
];

export function MaterialsCenter({ onBack }: MaterialsCenterProps) {
  const [cat, setCat] = useState<Category>('visual');
  const [q, setQ] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const items = useMemo(
    () =>
      DATA.filter((d) => d.cat === cat).filter(
        (d) => !q.trim() || d.title.includes(q.trim()) || (d.copy?.includes(q.trim()) ?? false),
      ),
    [cat, q],
  );

  const onCopy = async (item: MaterialItem) => {
    if (!item.copy) return;
    try {
      await navigator.clipboard.writeText(item.copy);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId((id) => (id === item.id ? null : id)), 1500);
    } catch {}
  };

  return (
    <div className="flex flex-col w-full h-full" style={{ background: '#f7f3ec' }}>
      <PageHeader title="素材中心" subtitle="官方主图 · 文案 · 视频脚本" onBack={onBack} />

      {/* Filter row */}
      <div className="shrink-0 px-4 md:px-8 pt-4 pb-3 space-y-3">
        <div
          className="flex items-center gap-2 rounded-full px-4"
          style={{ background: '#ffffff', border: '1px solid #e6dccb', height: 40 }}
        >
          <Search size={16} style={{ color: '#8c8276' }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索素材标题或文案"
            className="flex-1 bg-transparent outline-none"
            style={{ color: '#1a1410', fontSize: 14, fontFamily: 'var(--font-sans)' }}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {CATS.map((c) => {
            const active = c.id === cat;
            return (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className="rounded-full px-3.5 py-1.5 transition-all"
                style={{
                  background: active ? '#1a1410' : '#ffffff',
                  color: active ? '#f7f3ec' : '#1a1410',
                  border: active ? '1px solid #1a1410' : '1px solid #e6dccb',
                  fontSize: 13,
                  letterSpacing: '0.06em',
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div className="@container flex-1 min-h-0 overflow-y-auto lux-scroll px-4 md:px-8 pb-6">
        {items.length === 0 ? (
          <div
            className="grid place-items-center rounded-2xl mt-2"
            style={{
              minHeight: 200,
              background: '#ffffff',
              border: '1px dashed #e6dccb',
              color: '#8c8276',
              fontSize: 13,
            }}
          >
            暂未匹配到相关素材
          </div>
        ) : (
          <div className="grid grid-cols-1 @md:grid-cols-2 @4xl:grid-cols-3 gap-3">
            {items.map((item) => (
              <article
                key={item.id}
                className="lux-card overflow-hidden rounded-2xl flex flex-col"
                style={{ background: '#ffffff', border: '1px solid #e6dccb' }}
              >
                <div
                  className="relative grid place-items-center"
                  style={{ height: 140, background: item.hue }}
                >
                  <ImageIcon size={28} style={{ color: 'rgba(26,20,16,0.4)' }} />
                  <div
                    className="absolute font-serif"
                    style={{
                      bottom: 10,
                      left: 12,
                      color: '#1a1410',
                      fontSize: 11,
                      letterSpacing: '0.18em',
                      background: 'rgba(255,255,255,0.7)',
                      padding: '2px 8px',
                      borderRadius: 999,
                    }}
                  >
                    问 兰 · WENLAN
                  </div>
                </div>
                <div className="flex-1 flex flex-col p-3.5">
                  <div style={{ color: '#1a1410', fontSize: 14, lineHeight: 1.5 }}>{item.title}</div>
                  <div style={{ color: '#8c8276', fontSize: 12, marginTop: 4 }}>{item.meta}</div>

                  {item.copy && (
                    <div
                      className="mt-2.5 rounded-xl p-2.5 whitespace-pre-wrap"
                      style={{
                        background: '#f7f3ec',
                        color: '#3a322a',
                        fontSize: 12.5,
                        lineHeight: 1.65,
                        maxHeight: 132,
                        overflow: 'auto',
                      }}
                    >
                      {item.copy}
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-2">
                    {item.copy && (
                      <button
                        onClick={() => onCopy(item)}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors"
                        style={{
                          background: '#1a1410',
                          color: '#f7f3ec',
                          fontSize: 12,
                          letterSpacing: '0.06em',
                        }}
                      >
                        {copiedId === item.id ? <Check size={13} /> : <Copy size={13} />}
                        {copiedId === item.id ? '已复制' : '复制文案'}
                      </button>
                    )}
                    {item.download && (
                      <button
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-[#f7f3ec]"
                        style={{
                          border: '1px solid #e6dccb',
                          color: '#1a1410',
                          fontSize: 12,
                          letterSpacing: '0.06em',
                        }}
                      >
                        <Download size={13} />
                        下载
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
