"use client"

import type { FormEvent } from "react"
import { useEffect, useState } from "react"
import { Image as ImageIcon, Loader2, Menu, Plus, RefreshCw, Save, Trash2 } from "lucide-react"

import { AppSidebar, MobileAppSidebar } from "@/components/app-sidebar"
import type { AppSettings, CooperationApplication } from "@/types/settings"

const defaultSettings: AppSettings = {
  appName: "",
  assistantName: "",
  assistantSubtitle: "",
  assistantHeadline: "",
  starterPrompts: [],
  onboardingGuide: [],
  insightCards: [],
  knowledgeOutline: [],
  defaultSystemPrompt: "",
  emptyStateCopy: "",
  defaultDifyDatasetId: "",
  defaultDifyBaseUrl: "",
  businessContacts: [],
  businessPriceTiers: [],
  businessQr: {
    imageUrl: "",
    title: "",
    description: "",
    availability: "",
  },
  materialItems: [],
}

export function AdminConfigPanel() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [applications, setApplications] = useState<CooperationApplication[]>([])
  const [applicationsLoading, setApplicationsLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const [starterPromptsText, setStarterPromptsText] = useState("")
  const [knowledgeOutlineText, setKnowledgeOutlineText] = useState("")
  const [onboardingGuideText, setOnboardingGuideText] = useState("")
  const [insightCardsText, setInsightCardsText] = useState("")

  useEffect(() => {
    void loadSettings()
    void loadApplications()
  }, [])

  async function loadSettings() {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/config", { cache: "no-store" })
      if (!response.ok) throw new Error("读取配置失败")
      const data = (await response.json()) as AppSettings
      setSettings(data)
      setStarterPromptsText(data.starterPrompts.join("\n"))
      setKnowledgeOutlineText(data.knowledgeOutline.join("\n"))
      setOnboardingGuideText(JSON.stringify(data.onboardingGuide, null, 2))
      setInsightCardsText(JSON.stringify(data.insightCards, null, 2))
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取配置失败")
    } finally {
      setLoading(false)
    }
  }

  async function loadApplications() {
    setApplicationsLoading(true)
    try {
      const response = await fetch("/api/admin/business/applications", { cache: "no-store" })
      const payload = (await response.json().catch(() => ({}))) as {
        applications?: CooperationApplication[]
      }
      if (response.ok) {
        setApplications(payload.applications || [])
      }
    } finally {
      setApplicationsLoading(false)
    }
  }

  function handleQrUpload(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const imageUrl = typeof reader.result === "string" ? reader.result : ""
      setSettings((current) => ({
        ...current,
        businessQr: {
          ...current.businessQr,
          imageUrl,
        },
      }))
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError("")
    setMessage("")

    try {
      const starterPrompts = starterPromptsText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)

      const knowledgeOutline = knowledgeOutlineText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)

      let onboardingGuide: AppSettings["onboardingGuide"] = []
      try {
        onboardingGuide = JSON.parse(onboardingGuideText)
        if (!Array.isArray(onboardingGuide)) throw new Error()
      } catch {
        throw new Error("新手指导 JSON 格式错误")
      }

      let insightCards: AppSettings["insightCards"] = []
      try {
        insightCards = JSON.parse(insightCardsText)
        if (!Array.isArray(insightCards)) throw new Error()
      } catch {
        throw new Error("功能卡片 JSON 格式错误")
      }

      const body: AppSettings = {
        ...settings,
        starterPrompts,
        knowledgeOutline,
        onboardingGuide,
        insightCards,
      }

      const response = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
      }
      if (!response.ok) {
        throw new Error(payload.error || "保存失败")
      }
      setMessage("配置已保存。刷新前台页面即可看到效果。")
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ivory">
        <Loader2 className="h-6 w-6 animate-spin text-mute" />
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh bg-ivory text-ink">
      <aside className="hidden w-[18rem] shrink-0 lg:block">
        <AppSidebar active="config" sections={["knowledge", "config"]} />
      </aside>

      <MobileAppSidebar
        active="config"
        sections={["knowledge", "config"]}
        open={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-dvh w-full max-w-[1000px] flex-col px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
          <header className="mb-4 flex flex-col gap-3 border-b border-black/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <button
                className="lux-press inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-mute transition hover:bg-white lg:hidden"
                onClick={() => setMobileSidebarOpen(true)}
                type="button"
                aria-label="打开侧边菜单"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <div className="text-[18px] font-semibold tracking-tight">系统配置</div>
                <div className="text-sm text-mute">管理前台文案、默认提示词和后端接口默认地址。</div>
              </div>
            </div>

            <button
              className="lux-press inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 text-sm text-ink-soft transition hover:bg-[#f7f7f7] sm:w-auto"
              onClick={() => void loadSettings()}
              type="button"
            >
              <RefreshCw className="h-4 w-4" />
              刷新
            </button>
          </header>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <section className="lux-card lux-in border border-black/10 bg-white p-4 sm:p-5">
              <h2 className="text-base font-semibold text-ink">基本信息</h2>
              <p className="mt-1 text-sm text-[#6b6b6b]">这些信息将显示在前台页面的标题和介绍区域。</p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm">
                  <span className="text-mute">应用名称</span>
                  <input
                    value={settings.appName}
                    onChange={(e) => setSettings((s) => ({ ...s, appName: e.target.value }))}
                    className="h-11 rounded-xl border border-black/10 bg-white px-3 text-[15px] outline-none focus:border-black/30"
                  />
                </label>

                <label className="grid gap-1.5 text-sm">
                  <span className="text-mute">助手名称</span>
                  <input
                    value={settings.assistantName}
                    onChange={(e) => setSettings((s) => ({ ...s, assistantName: e.target.value }))}
                    className="h-11 rounded-xl border border-black/10 bg-white px-3 text-[15px] outline-none focus:border-black/30"
                  />
                </label>

                <label className="grid gap-1.5 text-sm sm:col-span-2">
                  <span className="text-mute">副标题</span>
                  <input
                    value={settings.assistantSubtitle}
                    onChange={(e) => setSettings((s) => ({ ...s, assistantSubtitle: e.target.value }))}
                    className="h-11 rounded-xl border border-black/10 bg-white px-3 text-[15px] outline-none focus:border-black/30"
                  />
                </label>

                <label className="grid gap-1.5 text-sm sm:col-span-2">
                  <span className="text-mute">头条标语</span>
                  <input
                    value={settings.assistantHeadline}
                    onChange={(e) => setSettings((s) => ({ ...s, assistantHeadline: e.target.value }))}
                    className="h-11 rounded-xl border border-black/10 bg-white px-3 text-[15px] outline-none focus:border-black/30"
                  />
                </label>

                <label className="grid gap-1.5 text-sm sm:col-span-2">
                  <span className="text-mute">空状态欢迎语</span>
                  <textarea
                    value={settings.emptyStateCopy}
                    onChange={(e) => setSettings((s) => ({ ...s, emptyStateCopy: e.target.value }))}
                    className="min-h-20 rounded-xl border border-black/10 bg-white px-3 py-3 text-[15px] outline-none focus:border-black/30"
                  />
                </label>
              </div>
            </section>

            <section className="lux-card border border-black/10 bg-white p-4 sm:p-5">
              <h2 className="text-base font-semibold text-ink">快捷提问</h2>
              <p className="mt-1 text-sm text-[#6b6b6b]">每行一条，显示在前台输入框上方作为快捷入口。</p>

              <label className="mt-4 grid gap-1.5 text-sm">
                <textarea
                  value={starterPromptsText}
                  onChange={(e) => setStarterPromptsText(e.target.value)}
                  className="min-h-32 rounded-xl border border-black/10 bg-white px-3 py-3 text-[15px] outline-none focus:border-black/30"
                  placeholder={"每行一个快捷提问\n例如：\n进入素材中心，帮我找官方图片和宣传文案\n给我3条可以直接复制的朋友圈宣传文案"}
                />
              </label>
            </section>

            <section className="lux-card border border-black/10 bg-white p-4 sm:p-5">
              <h2 className="text-base font-semibold text-ink">新手指导</h2>
              <p className="mt-1 text-sm text-[#6b6b6b]">JSON 数组格式，每项包含 title 和 description。</p>

              <label className="mt-4 grid gap-1.5 text-sm">
                <textarea
                  value={onboardingGuideText}
                  onChange={(e) => setOnboardingGuideText(e.target.value)}
                  className="min-h-40 rounded-xl border border-black/10 bg-white px-3 py-3 text-[13px] outline-none focus:border-black/30 font-mono"
                />
              </label>
            </section>

            <section className="lux-card border border-black/10 bg-white p-4 sm:p-5">
              <h2 className="text-base font-semibold text-ink">功能卡片</h2>
              <p className="mt-1 text-sm text-[#6b6b6b]">JSON 数组格式，每项包含 title 和 description。</p>

              <label className="mt-4 grid gap-1.5 text-sm">
                <textarea
                  value={insightCardsText}
                  onChange={(e) => setInsightCardsText(e.target.value)}
                  className="min-h-32 rounded-xl border border-black/10 bg-white px-3 py-3 text-[13px] outline-none focus:border-black/30 font-mono"
                />
              </label>
            </section>

            <section className="lux-card border border-black/10 bg-white p-4 sm:p-5">
              <h2 className="text-base font-semibold text-ink">知识库大纲</h2>
              <p className="mt-1 text-sm text-[#6b6b6b]">每行一个分类名称。</p>

              <label className="mt-4 grid gap-1.5 text-sm">
                <textarea
                  value={knowledgeOutlineText}
                  onChange={(e) => setKnowledgeOutlineText(e.target.value)}
                  className="min-h-32 rounded-xl border border-black/10 bg-white px-3 py-3 text-[15px] outline-none focus:border-black/30"
                  placeholder={"每行一个分类\n例如：\n产品介绍\n官方图片\n宣传文案"}
                />
              </label>
            </section>

            <section className="lux-card border border-black/10 bg-white p-4 sm:p-5">
              <h2 className="text-base font-semibold text-ink">商务中心 · 联系方式</h2>
              <p className="mt-1 text-sm text-[#6b6b6b]">显示在商务中心的联系卡片中。</p>

              <div className="mt-4 space-y-3">
                {settings.businessContacts.map((contact, i) => (
                  <div key={contact.id} className="grid gap-3 rounded-xl border border-black/10 bg-[#fbfbfb] p-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                    <label className="grid gap-1.5 text-sm flex-1">
                      <span className="text-mute">标签</span>
                      <input
                        value={settings.businessContacts[i].label}
                        onChange={(e) => {
                          const next = [...settings.businessContacts]
                          next[i] = { ...next[i], label: e.target.value }
                          setSettings((s) => ({ ...s, businessContacts: next }))
                        }}
                        className="h-11 rounded-xl border border-black/10 bg-white px-3 text-[15px] outline-none focus:border-black/30"
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm flex-[2]">
                      <span className="text-mute">值</span>
                      <input
                        value={settings.businessContacts[i].value}
                        onChange={(e) => {
                          const next = [...settings.businessContacts]
                          next[i] = { ...next[i], value: e.target.value }
                          setSettings((s) => ({ ...s, businessContacts: next }))
                        }}
                        className="h-11 rounded-xl border border-black/10 bg-white px-3 text-[15px] outline-none focus:border-black/30"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setSettings((s) => ({
                          ...s,
                          businessContacts: s.businessContacts.filter((_, idx) => idx !== i),
                        }))
                      }
                      className="lux-press inline-flex h-10 w-full shrink-0 items-center justify-center rounded-full text-rose transition hover:bg-rose-soft sm:mb-0.5 sm:w-10"
                      aria-label="删除联系方式"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setSettings((s) => ({
                    ...s,
                    businessContacts: [
                      ...s.businessContacts,
                      { id: `c${Date.now()}`, label: "新联系方式", value: "" },
                    ],
                  }))
                }
                className="lux-press mt-3 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-line bg-white px-3 text-sm text-ink transition hover:bg-ivory sm:w-auto"
              >
                <Plus size={14} /> 添加联系方式
              </button>
            </section>

            <section className="lux-card border border-black/10 bg-white p-4 sm:p-5">
              <h2 className="text-base font-semibold text-ink">商务中心 · 价目表</h2>
              <p className="mt-1 text-sm text-[#6b6b6b]">产品名称、价格区间和备注。</p>

              <div className="mt-4 space-y-3">
                {settings.businessPriceTiers.map((tier, i) => (
                  <div key={i} className="grid gap-3 rounded-xl border border-black/10 bg-[#fbfbfb] p-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
                    <label className="grid gap-1.5 text-sm flex-1">
                      <span className="text-mute">名称</span>
                      <input
                        value={tier.name}
                        onChange={(e) => {
                          const next = [...settings.businessPriceTiers]
                          next[i] = { ...next[i], name: e.target.value }
                          setSettings((s) => ({ ...s, businessPriceTiers: next }))
                        }}
                        className="h-11 rounded-xl border border-black/10 bg-white px-3 text-[15px] outline-none focus:border-black/30"
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm flex-1">
                      <span className="text-mute">价格区间</span>
                      <input
                        value={tier.range}
                        onChange={(e) => {
                          const next = [...settings.businessPriceTiers]
                          next[i] = { ...next[i], range: e.target.value }
                          setSettings((s) => ({ ...s, businessPriceTiers: next }))
                        }}
                        className="h-11 rounded-xl border border-black/10 bg-white px-3 text-[15px] outline-none focus:border-black/30"
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm flex-1">
                      <span className="text-mute">备注</span>
                      <input
                        value={tier.note}
                        onChange={(e) => {
                          const next = [...settings.businessPriceTiers]
                          next[i] = { ...next[i], note: e.target.value }
                          setSettings((s) => ({ ...s, businessPriceTiers: next }))
                        }}
                        className="h-11 rounded-xl border border-black/10 bg-white px-3 text-[15px] outline-none focus:border-black/30"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setSettings((s) => ({
                          ...s,
                          businessPriceTiers: s.businessPriceTiers.filter((_, idx) => idx !== i),
                        }))
                      }
                      className="lux-press inline-flex h-10 w-full shrink-0 items-center justify-center rounded-full text-rose transition hover:bg-rose-soft md:mb-0.5 md:w-10"
                      aria-label="删除价目"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setSettings((s) => ({
                    ...s,
                    businessPriceTiers: [
                      ...s.businessPriceTiers,
                      { name: "新产品", range: "¥0 – ¥0", note: "" },
                    ],
                  }))
                }
                className="lux-press mt-3 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full border border-line bg-white px-3 text-sm text-ink transition hover:bg-ivory sm:w-auto"
              >
                <Plus size={14} /> 添加价目
              </button>
            </section>

            <section className="lux-card border border-black/10 bg-white p-4 sm:p-5">
              <h2 className="text-base font-semibold text-ink">商务中心 · 二维码</h2>
              <p className="mt-1 text-sm text-[#6b6b6b]">配置前台商务中心展示的顾问二维码和说明文字。</p>

              <div className="mt-4 grid gap-4 md:grid-cols-[140px_1fr]">
                <div className="grid gap-2">
                  <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-black/10 bg-[#f7f7f7] text-mute">
                    {settings.businessQr.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Admin QR preview supports data URLs saved in settings.
                      <img src={settings.businessQr.imageUrl} alt="商务二维码预览" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-8 w-8" />
                    )}
                  </div>
                  <label className="lux-press inline-flex h-10 cursor-pointer items-center justify-center rounded-full border border-line bg-white px-3 text-sm text-ink transition hover:bg-ivory">
                    上传二维码
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) => handleQrUpload(event.target.files?.[0] || null)}
                    />
                  </label>
                  {settings.businessQr.imageUrl ? (
                    <button
                      type="button"
                      onClick={() => setSettings((s) => ({ ...s, businessQr: { ...s.businessQr, imageUrl: "" } }))}
                      className="lux-press inline-flex h-10 items-center justify-center rounded-full text-sm text-rose transition hover:bg-rose-soft"
                    >
                      清除图片
                    </button>
                  ) : null}
                </div>

                <div className="grid gap-3">
                  <label className="grid gap-1.5 text-sm">
                    <span className="text-mute">标题</span>
                    <input
                      value={settings.businessQr.title}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, businessQr: { ...s.businessQr, title: e.target.value } }))
                      }
                      className="h-11 rounded-xl border border-black/10 bg-white px-3 text-[15px] outline-none focus:border-black/30"
                      placeholder="扫码添加问兰商务顾问"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="text-mute">小标题</span>
                    <input
                      value={settings.businessQr.description}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, businessQr: { ...s.businessQr, description: e.target.value } }))
                      }
                      className="h-11 rounded-xl border border-black/10 bg-white px-3 text-[15px] outline-none focus:border-black/30"
                      placeholder="OFFICIAL · WECHAT"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm">
                    <span className="text-mute">回复时间说明</span>
                    <input
                      value={settings.businessQr.availability}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, businessQr: { ...s.businessQr, availability: e.target.value } }))
                      }
                      className="h-11 rounded-xl border border-black/10 bg-white px-3 text-[15px] outline-none focus:border-black/30"
                      placeholder="工作日 09:30 - 19:00 · 周末顺延回复"
                    />
                  </label>
                </div>
              </div>
            </section>

            <section className="lux-card border border-black/10 bg-white p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-ink">商务中心 · 合作申请</h2>
                  <p className="mt-1 text-sm text-[#6b6b6b]">前台提交的合作申请会显示在这里。</p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadApplications()}
                  className="lux-press inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-line bg-white px-3 text-sm text-ink transition hover:bg-ivory sm:w-auto"
                >
                  {applicationsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  刷新申请
                </button>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-black/10">
                {applications.length === 0 ? (
                  <div className="flex min-h-28 items-center justify-center px-4 text-center text-sm text-mute">
                    当前还没有合作申请。前台商务中心提交后会自动记录到这里。
                  </div>
                ) : (
                  <div className="divide-y divide-black/[0.06]">
                    {applications.slice(0, 20).map((application) => (
                      <article key={application.id} className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_1.4fr_1fr] md:items-start">
                        <div>
                          <div className="text-sm font-medium text-ink">{application.name}</div>
                          <div className="mt-1 text-xs text-mute">{application.city || "未填写城市"}</div>
                        </div>
                        <div className="text-sm text-ink-soft">{application.contact}</div>
                        <div className="text-sm leading-6 text-mute">{application.note || "未填写合作意向"}</div>
                        <div className="text-xs text-mute md:text-right">
                          {new Date(application.createdAt).toLocaleString("zh-CN", { hour12: false })}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="lux-card border border-black/10 bg-white p-4 sm:p-5">
              <h2 className="text-base font-semibold text-ink">系统提示词</h2>
              <p className="mt-1 text-sm text-[#6b6b6b]">这是每次对话发送给 AI 模型的系统指令。</p>

              <label className="mt-4 grid gap-1.5 text-sm">
                <textarea
                  value={settings.defaultSystemPrompt}
                  onChange={(e) => setSettings((s) => ({ ...s, defaultSystemPrompt: e.target.value }))}
                  className="min-h-72 rounded-xl border border-black/10 bg-white px-3 py-3 text-[14px] outline-none focus:border-black/30 font-mono leading-relaxed"
                />
              </label>
            </section>

            <section className="lux-card border border-black/10 bg-white p-4 sm:p-5">
              <h2 className="text-base font-semibold text-ink">后端默认值</h2>
              <p className="mt-1 text-sm text-[#6b6b6b]">当环境变量未配置时使用的默认值。</p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm">
                  <span className="text-mute">默认 Dify Dataset ID</span>
                  <input
                    value={settings.defaultDifyDatasetId}
                    onChange={(e) => setSettings((s) => ({ ...s, defaultDifyDatasetId: e.target.value }))}
                    className="h-11 rounded-xl border border-black/10 bg-white px-3 text-[15px] outline-none focus:border-black/30 font-mono text-sm"
                  />
                </label>

                <label className="grid gap-1.5 text-sm">
                  <span className="text-mute">默认 Dify 接口地址</span>
                  <input
                    value={settings.defaultDifyBaseUrl}
                    onChange={(e) => setSettings((s) => ({ ...s, defaultDifyBaseUrl: e.target.value }))}
                    className="h-11 rounded-xl border border-black/10 bg-white px-3 text-[15px] outline-none focus:border-black/30 font-mono text-sm"
                  />
                </label>
              </div>
            </section>

            {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
            {message ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}

            <div className="sticky bottom-0 -mx-3 flex justify-end border-t border-black/10 bg-ivory/95 px-3 py-3 backdrop-blur sm:static sm:mx-0 sm:border-t-0 sm:bg-transparent sm:px-0 sm:pb-8 sm:pt-0 sm:backdrop-blur-0">
              <button
                type="submit"
                disabled={saving}
                className="lux-press inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-white transition hover:bg-ink-soft disabled:cursor-not-allowed disabled:bg-[#888] sm:w-auto"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "保存中..." : "保存配置"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
