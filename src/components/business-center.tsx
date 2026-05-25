"use client"

import { Check, Copy, Mail, MessageCircle, Phone, QrCode, Send } from "lucide-react"
import { useEffect, useState } from "react"

import { PageHeader } from "@/components/page-header"
import type { ContactInfo, PriceTier } from "@/types/settings"

interface BusinessCenterProps {
  onBack: () => void
}

const CONTACT_ICONS: Record<string, React.ReactNode> = {
  wechat: <MessageCircle size={16} />,
  phone: <Phone size={16} />,
  mail: <Mail size={16} />,
}

export function BusinessCenter({ onBack }: BusinessCenterProps) {
  const [contacts, setContacts] = useState<ContactInfo[]>([])
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", city: "", wechat: "", note: "" })
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    fetch("/api/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.businessContacts?.length) setContacts(data.businessContacts)
        if (data.businessPriceTiers?.length) setPriceTiers(data.businessPriceTiers)
      })
      .catch(() => {})
  }, [])

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
    <div className="flex flex-col w-full h-full" style={{ background: "var(--color-ivory)" }}>
      <PageHeader title="商务中心" subtitle="代理对接 · 合作咨询 · 价目" onBack={onBack} />

      <div className="@container flex-1 min-h-0 overflow-y-auto lux-scroll">
        <div className="mx-auto w-full max-w-3xl px-4 md:px-8 py-5 space-y-5">
          <section
            className="rounded-2xl p-5"
            style={{ background: "var(--color-pearl)", border: "1px solid var(--color-line)" }}
          >
            <SectionTitle eyebrow="CONTACT" title="官方联系方式" />
            <div className="mt-4 flex flex-col gap-2.5">
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
                  style={{ background: 'var(--color-ivory)' }}
                >
                  <div
                    className="grid place-items-center rounded-xl shrink-0"
                    style={{ width: 38, height: 38, background: 'var(--color-pearl)', color: 'var(--color-ink)' }}
                  >
                    {CONTACT_ICONS[c.id] || <MessageCircle size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ color: "var(--color-mute)", fontSize: 12, letterSpacing: "0.1em" }}>
                      {c.label}
                    </div>
                    <div
                      className="mt-0.5 font-serif truncate"
                      style={{ color: "var(--color-ink)", fontSize: 17, letterSpacing: "0.02em" }}
                    >
                      {c.value}
                    </div>
                  </div>
                  <button
                    onClick={() => copy(c.id, c.value)}
                    className="shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1.5 transition-colors"
                    style={{
                      background: copied === c.id ? "var(--color-ink)" : "var(--color-pearl)",
                      color: copied === c.id ? "var(--color-ivory)" : "var(--color-ink)",
                      border: "1px solid var(--color-line)",
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
              style={{ background: "var(--color-ink)" }}
            >
              <div
                className="grid place-items-center rounded-xl shrink-0"
                style={{ width: 76, height: 76, background: "var(--color-ivory)", color: "var(--color-ink)" }}
              >
                <QrCode size={44} />
              </div>
              <div className="min-w-0">
                <div
                  className="font-serif"
                  style={{ color: "var(--color-champagne)", fontSize: 12.5, letterSpacing: "0.18em" }}
                >
                  OFFICIAL &middot; WECHAT
                </div>
                <div
                  className="font-serif mt-1"
                  style={{ color: "var(--color-ivory)", fontSize: 16, letterSpacing: "0.04em" }}
                >
                  扫码添加问兰商务顾问
                </div>
                <div style={{ color: "var(--color-mute)", fontSize: 12, marginTop: 4 }}>
                  工作日 09:30 &ndash; 19:00 &middot; 周末顺延回复
                </div>
              </div>
            </div>
          </section>

          <section
            className="rounded-2xl p-5"
            style={{ background: "var(--color-pearl)", border: "1px solid var(--color-line)" }}
          >
            <SectionTitle eyebrow="PRICING" title="零售价目区间" />
            <div className="mt-4 divide-y" style={{ borderColor: "var(--color-bone)" }}>
              {priceTiers.map((p) => (
                <div key={p.name} className="flex items-center gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <div style={{ color: "var(--color-ink)", fontSize: 14 }}>{p.name}</div>
                    <div style={{ color: "var(--color-mute)", fontSize: 12, marginTop: 2 }}>{p.note}</div>
                  </div>
                  <div
                    className="font-serif shrink-0"
                    style={{ color: "var(--color-ink)", fontSize: 15, letterSpacing: "0.04em" }}
                  >
                    {p.range}
                  </div>
                </div>
              ))}
            </div>
            <div
              className="mt-3 rounded-xl px-3 py-2.5"
              style={{ background: "var(--color-ivory)", color: "var(--color-ink-soft)", fontSize: 12.5, lineHeight: 1.65 }}
            >
              如需了解代理等级、费用档位或申请流程，请在下方留下联系方式，
              对接顾问会在 1 个工作日内联系您。
            </div>
          </section>

          <section
            className="rounded-2xl p-5"
            style={{ background: "var(--color-pearl)", border: "1px solid var(--color-line)" }}
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
                    background: "var(--color-ivory)",
                    border: "1px solid var(--color-line)",
                    color: "var(--color-ink)",
                    fontSize: 14,
                    lineHeight: 1.6,
                    fontFamily: "var(--font-sans)",
                  }}
                />
              </div>
              <div className="@xl:col-span-2 flex items-center justify-between">
                <span style={{ color: "var(--color-mute)", fontSize: 12 }}>
                  提交后由问兰商务团队在 1 个工作日内联系。
                </span>
                <button
                  type="submit"
                  disabled={!form.name || !form.wechat}
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 transition-opacity"
                  style={{
                    background: form.name && form.wechat ? "var(--color-ink)" : "var(--color-bone)",
                    color: form.name && form.wechat ? "var(--color-ivory)" : "var(--color-mute)",
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
        style={{ color: "var(--color-champagne)", fontSize: 11, letterSpacing: "0.24em" }}
      >
        {eyebrow}
      </div>
      <div
        className="font-serif mt-1"
        style={{ color: "var(--color-ink)", fontSize: 18, letterSpacing: "0.04em" }}
      >
        {title}
      </div>
    </>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: "var(--color-mute)", fontSize: 12, letterSpacing: "0.06em", marginBottom: 6 }}>
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
          background: "var(--color-ivory)",
          border: "1px solid var(--color-line)",
          color: "var(--color-ink)",
          fontSize: 14,
          fontFamily: "var(--font-sans)",
        }}
      />
    </div>
  )
}
