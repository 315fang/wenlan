"use client"

import type { FormEvent } from "react"
import { useEffect, useState } from "react"
import { Loader2, Menu, RefreshCw, Save } from "lucide-react"

import { AppSidebar, MobileAppSidebar } from "@/components/app-sidebar"
import type { AppSettings } from "@/types/settings"

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
}

export function AdminConfigPanel() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const [starterPromptsText, setStarterPromptsText] = useState("")
  const [knowledgeOutlineText, setKnowledgeOutlineText] = useState("")
  const [onboardingGuideText, setOnboardingGuideText] = useState("")
  const [insightCardsText, setInsightCardsText] = useState("")

  useEffect(() => {
    void loadSettings()
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
      <div className="flex min-h-dvh items-center justify-center bg-[#f6f6f4]">
        <Loader2 className="h-6 w-6 animate-spin text-[#666]" />
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh bg-[#f6f6f4] text-[#111111]">
      <aside className="hidden w-[18rem] shrink-0 lg:block">
        <AppSidebar active="config" sections={["config"]} />
      </aside>

      <MobileAppSidebar
        active="config"
        sections={["config"]}
        open={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-dvh w-full max-w-[1000px] flex-col px-4 py-4 sm:px-6 lg:px-8">
          <header className="mb-4 flex items-center justify-between border-b border-black/10 pb-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#5b5b5b] transition hover:bg-white lg:hidden"
                onClick={() => setMobileSidebarOpen(true)}
                type="button"
                aria-label="打开侧边菜单"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <div className="text-[18px] font-semibold tracking-tight">系统配置</div>
                <div className="text-sm text-[#666]">管理前台文案、默认提示词和后端接口默认地址。</div>
              </div>
            </div>

            <button
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[#333] transition hover:bg-[#f7f7f7]"
              onClick={() => void loadSettings()}
            >
              <RefreshCw className="h-4 w-4" />
              刷新
            </button>
          </header>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <section className="border border-black/10 bg-white p-4 sm:p-5">
              <h2 className="text-base font-semibold text-[#121212]">基本信息</h2>
              <p className="mt-1 text-sm text-[#6b6b6b]">这些信息将显示在前台页面的标题和介绍区域。</p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm">
                  <span className="text-[#444]">应用名称</span>
                  <input
                    value={settings.appName}
                    onChange={(e) => setSettings((s) => ({ ...s, appName: e.target.value }))}
                    className="h-11 rounded-xl border border-black/10 bg-white px-3 text-[15px] outline-none focus:border-black/30"
                  />
                </label>

                <label className="grid gap-1.5 text-sm">
                  <span className="text-[#444]">助手名称</span>
                  <input
                    value={settings.assistantName}
                    onChange={(e) => setSettings((s) => ({ ...s, assistantName: e.target.value }))}
                    className="h-11 rounded-xl border border-black/10 bg-white px-3 text-[15px] outline-none focus:border-black/30"
                  />
                </label>

                <label className="grid gap-1.5 text-sm sm:col-span-2">
                  <span className="text-[#444]">副标题</span>
                  <input
                    value={settings.assistantSubtitle}
                    onChange={(e) => setSettings((s) => ({ ...s, assistantSubtitle: e.target.value }))}
                    className="h-11 rounded-xl border border-black/10 bg-white px-3 text-[15px] outline-none focus:border-black/30"
                  />
                </label>

                <label className="grid gap-1.5 text-sm sm:col-span-2">
                  <span className="text-[#444]">头条标语</span>
                  <input
                    value={settings.assistantHeadline}
                    onChange={(e) => setSettings((s) => ({ ...s, assistantHeadline: e.target.value }))}
                    className="h-11 rounded-xl border border-black/10 bg-white px-3 text-[15px] outline-none focus:border-black/30"
                  />
                </label>

                <label className="grid gap-1.5 text-sm sm:col-span-2">
                  <span className="text-[#444]">空状态欢迎语</span>
                  <textarea
                    value={settings.emptyStateCopy}
                    onChange={(e) => setSettings((s) => ({ ...s, emptyStateCopy: e.target.value }))}
                    className="min-h-20 rounded-xl border border-black/10 bg-white px-3 py-3 text-[15px] outline-none focus:border-black/30"
                  />
                </label>
              </div>
            </section>

            <section className="border border-black/10 bg-white p-4 sm:p-5">
              <h2 className="text-base font-semibold text-[#121212]">快捷提问</h2>
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

            <section className="border border-black/10 bg-white p-4 sm:p-5">
              <h2 className="text-base font-semibold text-[#121212]">新手指导</h2>
              <p className="mt-1 text-sm text-[#6b6b6b]">JSON 数组格式，每项包含 title 和 description。</p>

              <label className="mt-4 grid gap-1.5 text-sm">
                <textarea
                  value={onboardingGuideText}
                  onChange={(e) => setOnboardingGuideText(e.target.value)}
                  className="min-h-40 rounded-xl border border-black/10 bg-white px-3 py-3 text-[13px] outline-none focus:border-black/30 font-mono"
                />
              </label>
            </section>

            <section className="border border-black/10 bg-white p-4 sm:p-5">
              <h2 className="text-base font-semibold text-[#121212]">功能卡片</h2>
              <p className="mt-1 text-sm text-[#6b6b6b]">JSON 数组格式，每项包含 title 和 description。</p>

              <label className="mt-4 grid gap-1.5 text-sm">
                <textarea
                  value={insightCardsText}
                  onChange={(e) => setInsightCardsText(e.target.value)}
                  className="min-h-32 rounded-xl border border-black/10 bg-white px-3 py-3 text-[13px] outline-none focus:border-black/30 font-mono"
                />
              </label>
            </section>

            <section className="border border-black/10 bg-white p-4 sm:p-5">
              <h2 className="text-base font-semibold text-[#121212]">知识库大纲</h2>
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

            <section className="border border-black/10 bg-white p-4 sm:p-5">
              <h2 className="text-base font-semibold text-[#121212]">系统提示词</h2>
              <p className="mt-1 text-sm text-[#6b6b6b]">这是每次对话发送给 AI 模型的系统指令。</p>

              <label className="mt-4 grid gap-1.5 text-sm">
                <textarea
                  value={settings.defaultSystemPrompt}
                  onChange={(e) => setSettings((s) => ({ ...s, defaultSystemPrompt: e.target.value }))}
                  className="min-h-72 rounded-xl border border-black/10 bg-white px-3 py-3 text-[14px] outline-none focus:border-black/30 font-mono leading-relaxed"
                />
              </label>
            </section>

            <section className="border border-black/10 bg-white p-4 sm:p-5">
              <h2 className="text-base font-semibold text-[#121212]">后端默认值</h2>
              <p className="mt-1 text-sm text-[#6b6b6b]">当环境变量未配置时使用的默认值。</p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm">
                  <span className="text-[#444]">默认 Dify Dataset ID</span>
                  <input
                    value={settings.defaultDifyDatasetId}
                    onChange={(e) => setSettings((s) => ({ ...s, defaultDifyDatasetId: e.target.value }))}
                    className="h-11 rounded-xl border border-black/10 bg-white px-3 text-[15px] outline-none focus:border-black/30 font-mono text-sm"
                  />
                </label>

                <label className="grid gap-1.5 text-sm">
                  <span className="text-[#444]">默认 Dify 接口地址</span>
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

            <div className="flex justify-end pb-8">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#111111] px-5 text-sm font-medium text-white transition hover:bg-[#2e2e2e] disabled:cursor-not-allowed disabled:bg-[#888]"
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
