"use client"

import { Check, Copy, Mail, MessageCircle, Phone, QrCode, Send } from "lucide-react"
import { useState } from "react"

import { PageHeader } from "@/components/page-header"

interface BusinessCenterProps {
  onBack: () => void
}

const PRICE_TIERS = [
  { name: "入门精萃水乳套组", range: "¥380 – ¥580", note: "新客首选 · 日常基础" },
  { name: "焕活精华系列", range: "¥680 – ¥980", note: "5% 烟酰胺 + 雪绒花干细胞萃取" },
  { name: "紧致赋活面霜", range: "¥980 – ¥1,280", note: "白松露多肽 · 礼盒装可选" },
]

const CONTACTS = [
  { id: "wechat", icon: <MessageCircle size={16} />, label: "官方微信", value: "wenlan-skin" },
  { id: "phone", icon: <Phone size={16} />, label: "商务电话", value: "400-823-0316" },
  { id: "mail", icon: <Mail size={16} />, label: "商务邮箱", value: "biz@wenlan.top" },
]

export function BusinessCenter({ onBack }: BusinessCenterProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", city: "", wechat: "", note: "" })
  const [submitted, setSubmitted] = useState(false)

  const copy = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(id)
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500)
    } catch {}
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.wechat) return
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 2400)
    setForm({ name: "", city: "", wechat: "", note: "" })
  }

  return (
    <div className="flex flex-col w-full h-full" style={{ background: "#f7f3ec" }}>
      <PageHeader title="商务中心" subtitle="代理对接 · 合作咨询 · 价目" onBack={onBack} />

      <div className="@container flex-1 min-h-0 overflow-y-auto lux-scroll">
        <div className="mx-auto w-full max-w-3xl px-4 md:px-8 py-5 space-y-5">
          <section
            className="rounded-2xl p-5"
            style={{ background: "#ffffff", border: "1px solid #e6dccb" }}
          >
            <SectionTitle eyebrow="CONTACT" title="官方联系方式" />
            <div className="mt-4 flex flex-col gap-2.5">
              {CONTACTS.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
                  style={{ background: "#f7f3ec" }}
                >
                  <div
                    className="grid place-items-center rounded-xl shrink-0"
                    style={{ width: 38, height: 38, background: "#ffffff", color: "#1a1410" }}
                  >
                    {c.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ color: "#8c8276", fontSize: 12, letterSpacing: "0.1em" }}>
                      {c.label}
                    </div>
                    <div
                      className="mt-0.5 font-serif truncate"
                      style={{ color: "#1a1410", fontSize: 17, letterSpacing: "0.02em" }}
                    >
                      {c.value}
                    </div>
                  </div>
                  <button
                    onClick={() => copy(c.id, c.value)}
                    className="shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 transition-colors"
                    style={{
                      background: copied === c.id ? "#1a1410" : "#ffffff",
                      color: copied === c.id ? "#f7f3ec" : "#1a1410",
                      border: "1px solid #e6dccb",
                      fontSize: 12,
                    }}
                  >
                    {copied === c.id ? <Check size={12} /> : <Copy size={12} />}
                    {copied === c.id ? "已复制" : "复制"}
                  </button>
                </div>
              ))}
            </div>

            <div
              className="mt-4 flex items-center gap-4 rounded-2xl px-4 py-3.5"
              style={{ background: "#1a1410" }}
            >
              <div
                className="grid place-items-center rounded-xl shrink-0"
                style={{ width: 76, height: 76, background: "#f7f3ec", color: "#1a1410" }}
              >
                <QrCode size={44} />
              </div>
              <div className="min-w-0">
                <div
                  className="font-serif"
                  style={{ color: "#c9a87a", fontSize: 12.5, letterSpacing: "0.18em" }}
                >
                  OFFICIAL &middot; WECHAT
                </div>
                <div
                  className="font-serif mt-1"
                  style={{ color: "#f7f3ec", fontSize: 16, letterSpacing: "0.04em" }}
                >
                  扫码添加问兰商务顾问
                </div>
                <div style={{ color: "#8c8276", fontSize: 12, marginTop: 4 }}>
                  工作日 09:30 &ndash; 19:00 &middot; 周末顺延回复
                </div>
              </div>
            </div>
          </section>

          <section
            className="rounded-2xl p-5"
            style={{ background: "#ffffff", border: "1px solid #e6dccb" }}
          >
            <SectionTitle eyebrow="PRICING" title="零售价目区间" />
            <div className="mt-4 divide-y" style={{ borderColor: "#f1ebde" }}>
              {PRICE_TIERS.map((p) => (
                <div key={p.name} className="flex items-center gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <div style={{ color: "#1a1410", fontSize: 14 }}>{p.name}</div>
                    <div style={{ color: "#8c8276", fontSize: 12, marginTop: 2 }}>{p.note}</div>
                  </div>
                  <div
                    className="font-serif shrink-0"
                    style={{ color: "#1a1410", fontSize: 15, letterSpacing: "0.04em" }}
                  >
                    {p.range}
                  </div>
                </div>
              ))}
            </div>
            <div
              className="mt-3 rounded-xl px-3 py-2.5"
              style={{ background: "#f7f3ec", color: "#3a322a", fontSize: 12.5, lineHeight: 1.65 }}
            >
              如需了解代理等级、费用档位或申请流程，请在下方留下联系方式，
              对接顾问会在 1 个工作日内联系您。
            </div>
          </section>

          <section
            className="rounded-2xl p-5"
            style={{ background: "#ffffff", border: "1px solid #e6dccb" }}
          >
            <SectionTitle eyebrow="INQUIRY" title="合作申请" />
            <form onSubmit={submit} className="mt-4 grid grid-cols-1 @xl:grid-cols-2 gap-3">
              <Field
                label="姓名 *"
                value={form.name}
                onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="您的称呼"
              />
              <Field
                label="所在城市"
                value={form.city}
                onChange={(v) => setForm((f) => ({ ...f, city: v }))}
                placeholder="如：上海 · 静安"
              />
              <Field
                label="微信 / 电话 *"
                value={form.wechat}
                onChange={(v) => setForm((f) => ({ ...f, wechat: v }))}
                placeholder="留下方便联系的方式"
              />
              <div className="@xl:col-span-2">
                <Label>合作意向</Label>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  rows={3}
                  placeholder="想了解的内容、目标城市、客群规模等"
                  className="w-full rounded-2xl px-4 py-3 outline-none resize-none"
                  style={{
                    background: "#f7f3ec",
                    border: "1px solid #e6dccb",
                    color: "#1a1410",
                    fontSize: 14,
                    lineHeight: 1.6,
                    fontFamily: "var(--font-sans)",
                  }}
                />
              </div>
              <div className="@xl:col-span-2 flex items-center justify-between">
                <span style={{ color: "#8c8276", fontSize: 12 }}>
                  提交后由问兰商务团队在 1 个工作日内联系。
                </span>
                <button
                  type="submit"
                  disabled={!form.name || !form.wechat}
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 transition-opacity"
                  style={{
                    background: form.name && form.wechat ? "#1a1410" : "#ebe2d2",
                    color: form.name && form.wechat ? "#f7f3ec" : "#8c8276",
                    fontSize: 13,
                    letterSpacing: "0.08em",
                  }}
                >
                  <Send size={14} />
                  {submitted ? "已提交，等待回复" : "提交合作申请"}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <>
      <div
        className="font-serif"
        style={{ color: "#c9a87a", fontSize: 11, letterSpacing: "0.24em" }}
      >
        {eyebrow}
      </div>
      <div
        className="font-serif mt-1"
        style={{ color: "#1a1410", fontSize: 18, letterSpacing: "0.04em" }}
      >
        {title}
      </div>
    </>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: "#8c8276", fontSize: 12, letterSpacing: "0.06em", marginBottom: 6 }}>
      {children}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full px-4 py-2.5 outline-none"
        style={{
          background: "#f7f3ec",
          border: "1px solid #e6dccb",
          color: "#1a1410",
          fontSize: 14,
          fontFamily: "var(--font-sans)",
        }}
      />
    </div>
  )
}
