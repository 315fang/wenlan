"use client"

import { Check, Copy, Download, Image as ImageIcon, Search } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { PageHeader } from "@/components/page-header"
import type { MaterialItem } from "@/types/settings"

interface MaterialsCenterProps {
  onBack: () => void
}

type Category = "visual" | "wechat" | "community" | "script"

const CATS: { id: Category; label: string }[] = [
  { id: "visual", label: "官方主图" },
  { id: "wechat", label: "朋友圈三连" },
  { id: "community", label: "社群文案" },
  { id: "script", label: "短视频脚本" },
]

export function MaterialsCenter({ onBack }: MaterialsCenterProps) {
  const [data, setData] = useState<MaterialItem[]>([])
  const [cat, setCat] = useState<Category>("visual")
  const [q, setQ] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.materialItems?.length) setData(d.materialItems)
      })
      .catch(() => {})
  }, [])

  const items = useMemo(
    () =>
      data.filter((d) => d.cat === cat).filter(
        (d) => !q.trim() || d.title.includes(q.trim()) || (d.copy?.includes(q.trim()) ?? false)
      ),
    [data, cat, q]
  )

  const onCopy = async (item: MaterialItem) => {
    if (!item.copy) return
    try {
      await navigator.clipboard.writeText(item.copy)
      setCopiedId(item.id)
      setTimeout(() => setCopiedId((id) => (id === item.id ? null : id)), 1500)
    } catch {}
  }

  return (
    <div className="flex flex-col w-full h-full" style={{ background: "#f7f3ec" }}>
      <PageHeader title="素材中心" subtitle="官方主图 · 文案 · 视频脚本" onBack={onBack} />

      <div className="shrink-0 px-4 md:px-8 pt-4 pb-3 space-y-3">
        <div
          className="flex items-center gap-2 rounded-full px-4"
          style={{ background: "#ffffff", border: "1px solid #e6dccb", height: 40 }}
        >
          <Search size={16} style={{ color: "#8c8276" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索素材标题或文案"
            className="flex-1 bg-transparent outline-none"
            style={{ color: "#1a1410", fontSize: 14, fontFamily: "var(--font-sans)" }}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {CATS.map((c) => {
            const active = c.id === cat
            return (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className="rounded-full px-3.5 py-1.5 transition-all"
                style={{
                  background: active ? "#1a1410" : "#ffffff",
                  color: active ? "#f7f3ec" : "#1a1410",
                  border: active ? "1px solid #1a1410" : "1px solid #e6dccb",
                  fontSize: 13,
                  letterSpacing: "0.06em",
                }}
              >
                {c.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="@container flex-1 min-h-0 overflow-y-auto lux-scroll px-4 md:px-8 pb-6">
        {items.length === 0 ? (
          <div
            className="grid place-items-center rounded-2xl mt-2"
            style={{
              minHeight: 200,
              background: "#ffffff",
              border: "1px dashed #e6dccb",
              color: "#8c8276",
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
                style={{ background: "#ffffff", border: "1px solid #e6dccb" }}
              >
                <div
                  className="relative grid place-items-center"
                  style={{ height: 140, background: item.hue }}
                >
                  <ImageIcon size={28} style={{ color: "rgba(26,20,16,0.4)" }} />
                  <div
                    className="absolute font-serif"
                    style={{
                      bottom: 10,
                      left: 12,
                      color: "#1a1410",
                      fontSize: 11,
                      letterSpacing: "0.18em",
                      background: "rgba(255,255,255,0.7)",
                      padding: "2px 8px",
                      borderRadius: 999,
                    }}
                  >
                    问 兰 &middot; WENLAN
                  </div>
                </div>
                <div className="flex-1 flex flex-col p-3.5">
                  <div style={{ color: "#1a1410", fontSize: 14, lineHeight: 1.5 }}>{item.title}</div>
                  <div style={{ color: "#8c8276", fontSize: 12, marginTop: 4 }}>{item.meta}</div>

                  {item.copy && (
                    <div
                      className="mt-2.5 rounded-xl p-2.5 whitespace-pre-wrap"
                      style={{
                        background: "#f7f3ec",
                        color: "#3a322a",
                        fontSize: 12.5,
                        lineHeight: 1.65,
                        maxHeight: 132,
                        overflow: "auto",
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
                          background: "#1a1410",
                          color: "#f7f3ec",
                          fontSize: 12,
                          letterSpacing: "0.06em",
                        }}
                      >
                        {copiedId === item.id ? <Check size={13} /> : <Copy size={13} />}
                        {copiedId === item.id ? "已复制" : "复制文案"}
                      </button>
                    )}
                    {item.download && (
                      <button
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-[#f7f3ec]"
                        style={{
                          border: "1px solid #e6dccb",
                          color: "#1a1410",
                          fontSize: 12,
                          letterSpacing: "0.06em",
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
  )
}
