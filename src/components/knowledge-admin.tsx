"use client"

import type { FormEvent } from "react"
import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import {
  FileText,
  Image as ImageIcon,
  Loader2,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Table2,
  Trash2,
  Upload,
} from "lucide-react"

import { AppSidebar, MobileAppSidebar } from "@/components/app-sidebar"
import { normalizeKnowledgeKey } from "@/lib/knowledge"
import type { KnowledgeItem, KnowledgeKind } from "@/types/knowledge"

const kindTabs: Array<{ kind: KnowledgeKind; label: string; icon: typeof FileText }> = [
  { kind: "article", label: "文章", icon: FileText },
  { kind: "table", label: "表格", icon: Table2 },
  { kind: "image", label: "图片", icon: ImageIcon },
]

const kindDescriptions: Record<KnowledgeKind, string> = {
  article: "填写文章链接或粘贴正文，系统会抓取正文快照并写入知识库。",
  table: "上传常见电子表格文件，作为结构化知识进入资料库。",
  image: "上传图片素材并补充用途说明，让问兰智能体系统能引用这类素材。",
}

type FormState = {
  title: string
  knowledgeKey: string
  sourceUrl: string
  description: string
  content: string
  file: File | null
  files: File[]
  batchUrls: string
}

const emptyFormState: FormState = {
  title: "",
  knowledgeKey: "",
  sourceUrl: "",
  description: "",
  content: "",
  file: null,
  files: [],
  batchUrls: "",
}

type UploadMode = "single" | "batch"

export function KnowledgeAdminPanel() {
  const [kind, setKind] = useState<KnowledgeKind>("article")
  const [uploadMode, setUploadMode] = useState<UploadMode>("single")
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [configured, setConfigured] = useState(true)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [form, setForm] = useState<FormState>(emptyFormState)

  const currentKey = normalizeKnowledgeKey(form.knowledgeKey || form.title)
  const batchUrlEntries = useMemo(
    () =>
      form.batchUrls
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    [form.batchUrls]
  )
  const batchItemCount = kind === "article" ? batchUrlEntries.length : form.files.length

  const nextVersion = useMemo(() => {
    if (!currentKey) return 1
    const versions = items
      .filter((item) => item.kind === kind && normalizeKnowledgeKey(item.knowledgeKey) === currentKey)
      .map((item) => item.version)
    return versions.length > 0 ? Math.max(...versions) + 1 : 1
  }, [currentKey, items, kind])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadItems(false)
    }, 180)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, query])

  useEffect(() => {
    void loadItems(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadItems(firstLoad: boolean) {
    if (firstLoad) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }
    setError("")
    try {
      const params = new URLSearchParams()
      params.set("kind", kind)
      if (query.trim()) {
        params.set("query", query.trim())
      }
      const response = await fetch(`/api/admin/knowledge?${params.toString()}`, {
        cache: "no-store",
      })
      const payload = (await response.json().catch(() => ({}))) as {
        items?: KnowledgeItem[]
        error?: string
        configured?: boolean
      }
      if (!response.ok) {
        throw new Error(payload.error || "读取知识库失败")
      }
      setConfigured(payload.configured !== false)
      setItems(payload.items || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "读取知识库失败")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  function filterItemsForCurrentView(nextItems: KnowledgeItem[]) {
    const normalizedQuery = query.trim().toLowerCase()
    return nextItems.filter((item) => {
      if (item.kind !== kind) return false
      if (!normalizedQuery) return true
      return `${item.title} ${item.knowledgeKey}`.toLowerCase().includes(normalizedQuery)
    })
  }

  function syncItemsSoon() {
    window.setTimeout(() => {
      void loadItems(false)
    }, 1800)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError("")
    setMessage(uploadMode === "single" ? "正在上传资料，请稍等..." : `正在批量上传 ${batchItemCount} 条资料，请稍等...`)

    try {
      const formData = new FormData()
      formData.set("kind", kind)
      formData.set("mode", uploadMode)
      if (form.description.trim()) formData.set("description", form.description.trim())
      if (uploadMode === "single") {
        formData.set("title", form.title.trim())
        formData.set("knowledgeKey", form.knowledgeKey.trim() || form.title.trim())
        formData.set("version", String(nextVersion))
        if (form.sourceUrl.trim()) formData.set("sourceUrl", form.sourceUrl.trim())
        if (kind === "article") {
          if (form.content.trim()) formData.set("content", form.content.trim())
        } else if (form.file) {
          formData.set("file", form.file)
        }
      } else if (kind === "article") {
        formData.set("batchUrls", batchUrlEntries.join("\n"))
      } else {
        form.files.forEach((file) => formData.append("files", file))
      }

      const response = await fetch("/api/admin/knowledge", {
        method: "POST",
        body: formData,
      })
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        removedPrevious?: number
        createdCount?: number
        failedCount?: number
        failures?: Array<{ title?: string; error?: string }>
        items?: KnowledgeItem[]
      }
      if (!response.ok) {
        throw new Error(payload.error || "上传失败")
      }

      if (uploadMode === "batch") {
        const createdCount = payload.createdCount || 0
        const failedCount = payload.failedCount || 0
        const overwriteText = payload.removedPrevious ? `，自动移除 ${payload.removedPrevious} 条旧版本` : ""
        const failureText = (payload.failures || [])
          .slice(0, 2)
          .map((item) => `${item.title || "未命名"}：${item.error || "上传失败"}`)
          .join("；")
        setMessage(
          `已批量上传 ${createdCount} 条${failedCount ? `，失败 ${failedCount} 条` : ""}${overwriteText}${failureText ? `。${failureText}` : ""}。`
        )
      } else {
        setMessage(payload.removedPrevious ? `已上传，自动移除 ${payload.removedPrevious} 条旧版本。` : "已上传。")
      }
      if (payload.items) {
        setItems(filterItemsForCurrentView(payload.items))
        syncItemsSoon()
      } else {
        await loadItems(false)
      }
      setForm(emptyFormState)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "上传失败")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(documentId: string) {
    if (!documentId || deletingId) return
    if (!window.confirm("确定删除这条知识资料吗？")) return
    setError("")
    setMessage("正在删除资料，请稍等...")
    setDeletingId(documentId)
    try {
      const response = await fetch(`/api/admin/knowledge/${documentId}`, {
        method: "DELETE",
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || "删除失败")
      }
      setItems((current) => current.filter((item) => item.documentId !== documentId))
      setMessage("已删除。")
      syncItemsSoon()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除失败")
      setMessage("")
    } finally {
      setDeletingId(null)
    }
  }

  const filteredCount = items.length
  const submitButtonLabel = submitting
    ? uploadMode === "single"
      ? "正在上传..."
      : "正在批量上传..."
    : uploadMode === "single"
      ? "上传资料"
      : `批量上传${batchItemCount ? `（${batchItemCount}）` : ""}`

  return (
    <div className="flex min-h-dvh overflow-x-hidden bg-ivory text-ink">
      <aside className="hidden w-[18rem] shrink-0 lg:block">
        <AppSidebar active="knowledge" sections={["knowledge", "config"]} />
      </aside>

      <MobileAppSidebar
        active="knowledge"
        sections={["knowledge", "config"]}
        open={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-dvh w-full max-w-[1600px] flex-col px-3 py-3 sm:px-6 sm:py-4 lg:px-8">
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
            <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink text-white sm:flex lg:hidden">
              <Image
                src="/wenlan-yizhantong.ico"
                alt=""
                width={22}
                height={22}
                unoptimized
                className="h-6 w-6 rounded-sm"
              />
            </div>
            <div className="min-w-0">
              <div className="text-[18px] font-semibold tracking-tight">问兰知识库</div>
              <div className="text-sm text-mute">后台上传文章、表格和图片素材，系统按最新版本覆盖旧答案。</div>
            </div>
          </div>

          <button
            className="lux-press inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 text-sm text-ink-soft transition hover:bg-[#f7f7f7] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            disabled={refreshing || submitting || Boolean(deletingId)}
            onClick={() => void loadItems(false)}
            type="button"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            刷新
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-rows-[auto_auto_1fr] gap-4">
          <section className="border-b border-black/10 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              {kindTabs.map(({ kind: tabKind, label, icon: Icon }) => (
                <button
                  key={tabKind}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${
                    tabKind === kind ? "bg-ink text-white" : "bg-white text-mute hover:bg-[#efefef]"
                  }`}
                  onClick={() => {
                    setKind(tabKind)
                    setUploadMode("single")
                    setForm(emptyFormState)
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-mute">{kindDescriptions[kind]}</p>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.1fr_1.4fr]">
            <form className="lux-card lux-in border border-black/10 bg-white p-4 sm:p-5" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-ink">上传资料</h2>
                  <p className="mt-1 text-sm text-[#6b6b6b]">
                    {uploadMode === "single" ? "同关键词的新版本会自动覆盖旧版本。" : "批量上传会按标题或文件名自动生成关键词，减少重复录入。"}
                  </p>
                </div>
                <div className="inline-flex w-fit items-center gap-1 rounded-full bg-[#f4f4f4] px-3 py-1 text-xs text-mute">
                  <Plus className="h-3.5 w-3.5" />
                  {uploadMode === "single" ? `第 ${nextVersion} 版` : `本次 ${batchItemCount} 条`}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 rounded-full bg-[#f4f4f4] p-1 text-sm sm:inline-grid">
                {(["single", "batch"] as UploadMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`lux-press rounded-full px-3 py-1.5 transition ${
                      uploadMode === mode ? "bg-white text-ink shadow-sm" : "text-mute hover:text-ink"
                    }`}
                    onClick={() => {
                      setUploadMode(mode)
                      setForm(emptyFormState)
                    }}
                  >
                    {mode === "single" ? "单条上传" : "批量上传"}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid gap-3">
                {uploadMode === "single" ? (
                  <>
                    <label className="grid gap-1.5 text-sm">
                      <span className="text-mute">资料标题</span>
                      <input
                        value={form.title}
                        onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                        className="h-11 rounded-xl border border-black/10 bg-white px-3 text-[15px] outline-none ring-0 placeholder:text-mute focus:border-black/30"
                        placeholder={kind === "article" ? "例如：代理政策更新说明" : "例如：销售数据统计表"}
                      />
                    </label>

                    <label className="grid gap-1.5 text-sm">
                      <span className="text-mute">关键词</span>
                      <input
                        value={form.knowledgeKey}
                        onChange={(event) => setForm((current) => ({ ...current, knowledgeKey: event.target.value }))}
                        className="h-11 rounded-xl border border-black/10 bg-white px-3 text-[15px] outline-none ring-0 placeholder:text-mute focus:border-black/30"
                        placeholder="例如：代理政策、等级说明、问兰前身"
                      />
                    </label>

                    <div className="grid gap-3">
                      <label className="grid gap-1.5 text-sm">
                        <span className="text-mute">来源链接</span>
                        <input
                          value={form.sourceUrl}
                          onChange={(event) => setForm((current) => ({ ...current, sourceUrl: event.target.value }))}
                          className="h-11 rounded-xl border border-black/10 bg-white px-3 text-[15px] outline-none ring-0 placeholder:text-mute focus:border-black/30"
                          placeholder="可选"
                        />
                      </label>
                    </div>

                    {kind === "article" ? (
                      <>
                        <label className="grid gap-1.5 text-sm">
                          <span className="text-mute">正文快照或补充内容</span>
                          <textarea
                            value={form.content}
                            onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
                            className="min-h-36 rounded-xl border border-black/10 bg-white px-3 py-3 text-[15px] outline-none ring-0 placeholder:text-mute focus:border-black/30"
                            placeholder="可粘贴文章正文。若留空，系统会根据来源链接抓取页面正文。"
                          />
                        </label>
                        <label className="grid gap-1.5 text-sm">
                          <span className="text-mute">备注</span>
                          <textarea
                            value={form.description}
                            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                            className="min-h-20 rounded-xl border border-black/10 bg-white px-3 py-3 text-[15px] outline-none ring-0 placeholder:text-mute focus:border-black/30"
                            placeholder="可写明适用场景、分类说明或人工补充信息。"
                          />
                        </label>
                      </>
                    ) : (
                      <>
                        <label className="grid gap-1.5 text-sm">
                          <span className="text-mute">{kind === "image" ? "图片文件" : "表格文件"}</span>
                          <div className="rounded-xl border border-dashed border-black/15 bg-[#fafafa] p-4">
                            <input
                              type="file"
                              accept={kind === "image" ? "image/*" : ".csv,.xls,.xlsx,.ods,.tsv"}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  file: event.target.files?.[0] || null,
                                  title: current.title.trim() || event.target.files?.[0]?.name || "",
                                }))
                              }
                              className="block w-full text-sm text-mute file:mr-4 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:text-white hover:file:bg-ink-soft"
                            />
                            <p className="mt-2 text-xs leading-5 text-mute">
                              {kind === "image"
                                ? "建议同时填写用途说明或图片识别文字，方便模型引用图片素材。"
                                : "支持常见电子表格文件。"}
                            </p>
                          </div>
                        </label>

                        <label className="grid gap-1.5 text-sm">
                          <span className="text-mute">{kind === "image" ? "图片说明 / 识别文字" : "补充说明"}</span>
                          <textarea
                            value={form.description}
                            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                            className="min-h-28 rounded-xl border border-black/10 bg-white px-3 py-3 text-[15px] outline-none ring-0 placeholder:text-mute focus:border-black/30"
                            placeholder={
                              kind === "image"
                                ? "描述这张图片适用的场景、文案要点或图片里能识别的文字。"
                                : "可写明表格含义、字段说明、使用范围。"
                            }
                          />
                        </label>
                      </>
                    )}
                  </>
                ) : kind === "article" ? (
                  <>
                    <label className="grid gap-1.5 text-sm">
                      <span className="text-mute">来源链接列表</span>
                      <textarea
                        value={form.batchUrls}
                        onChange={(event) => setForm((current) => ({ ...current, batchUrls: event.target.value }))}
                        className="min-h-36 rounded-xl border border-black/10 bg-white px-3 py-3 text-[15px] outline-none ring-0 placeholder:text-mute focus:border-black/30"
                        placeholder={"每行一个文章链接。\n系统会自动抓取文章标题，并按标题生成关键词。"}
                      />
                    </label>
                    <label className="grid gap-1.5 text-sm">
                      <span className="text-mute">统一备注</span>
                      <textarea
                        value={form.description}
                        onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                        className="min-h-20 rounded-xl border border-black/10 bg-white px-3 py-3 text-[15px] outline-none ring-0 placeholder:text-mute focus:border-black/30"
                        placeholder="可统一写明这批文章的分类或适用场景。"
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label className="grid gap-1.5 text-sm">
                      <span className="text-mute">{kind === "image" ? "图片文件" : "表格文件"}</span>
                      <div className="rounded-xl border border-dashed border-black/15 bg-[#fafafa] p-4">
                        <input
                          type="file"
                          multiple
                          accept={kind === "image" ? "image/*" : ".csv,.xls,.xlsx,.ods,.tsv"}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              files: Array.from(event.target.files || []),
                            }))
                          }
                          className="block w-full text-sm text-mute file:mr-4 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-sm file:text-white hover:file:bg-ink-soft"
                        />
                        <p className="mt-2 text-xs leading-5 text-mute">
                          {kind === "image"
                            ? "可一次选择多张图片，系统会按文件名自动生成标题和关键词。"
                            : "可一次选择多个表格文件，系统会按文件名自动生成标题和关键词。"}
                        </p>
                        {form.files.length > 0 ? (
                          <p className="mt-2 text-xs font-medium text-ink-soft">已选择 {form.files.length} 个文件。</p>
                        ) : null}
                      </div>
                    </label>

                    <label className="grid gap-1.5 text-sm">
                      <span className="text-mute">{kind === "image" ? "统一图片说明" : "统一补充说明"}</span>
                      <textarea
                        value={form.description}
                        onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                        className="min-h-24 rounded-xl border border-black/10 bg-white px-3 py-3 text-[15px] outline-none ring-0 placeholder:text-mute focus:border-black/30"
                        placeholder={
                          kind === "image"
                            ? "这批图片都适用于什么场景、配什么文案，可统一写在这里。"
                            : "这批表格的用途、字段说明、使用范围，可统一写在这里。"
                        }
                      />
                    </label>
                  </>
                )}
              </div>

              {error ? <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
              {message ? <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}
              {!configured ? (
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  当前还没有配置知识库接口地址、资料集编号或接口密钥，所以这里只能查看管理界面，不能真正写入知识库。
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="lux-press mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink px-4 text-sm font-medium text-white transition hover:bg-ink-soft disabled:cursor-not-allowed disabled:bg-[#888] sm:w-auto"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {submitButtonLabel}
              </button>
            </form>

            <section className="lux-card border border-black/10 bg-white p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-ink">资料列表</h2>
                  <p className="mt-1 text-sm text-[#6b6b6b]">共 {filteredCount} 条，默认以最新上传版本为准。</p>
                </div>

                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <div className="relative w-full sm:w-auto">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a8a8a]" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="搜索标题或关键词"
                      className="h-10 w-full rounded-full border border-black/10 bg-white pl-9 pr-3 text-sm outline-none focus:border-black/30 sm:w-[16rem]"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-black/10">
                <div className="hidden grid-cols-[1.8fr_1.2fr_0.7fr_0.8fr_0.9fr_0.5fr] gap-3 border-b border-black/10 bg-[#f8f8f8] px-4 py-3 text-xs font-medium uppercase tracking-wide text-mute md:grid">
                  <span>标题</span>
                  <span>关键词 / 来源</span>
                  <span>版本</span>
                  <span>状态</span>
                  <span>更新时间</span>
                  <span>操作</span>
                </div>

                <div className="max-h-none overflow-y-auto md:max-h-[58vh]">
                  {loading ? (
                    <div className="flex min-h-60 items-center justify-center text-sm text-mute">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      正在加载资料...
                    </div>
                  ) : items.length === 0 ? (
                    <div className="flex min-h-60 items-center justify-center px-6 text-center text-sm leading-6 text-mute">
                      当前没有资料。你可以先上传一篇文章、一张图片或一个表格，作为问兰智能体系统的知识来源。
                    </div>
                  ) : (
                    items.map((item) => {
                      const isDeleting = deletingId === item.documentId

                      return (
                        <article
                          key={item.documentId}
                          className={`lux-row-in grid gap-3 border-b border-black/[0.06] px-3 py-4 transition last:border-b-0 md:grid-cols-[1.8fr_1.2fr_0.7fr_0.8fr_0.9fr_0.5fr] md:items-center md:px-4 md:py-3 ${
                            isDeleting ? "bg-red-50/50 opacity-70" : ""
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-ink">{item.title}</div>
                            <div className="mt-1 truncate text-xs text-mute">
                              {item.kind === "article" ? "文章" : item.kind === "table" ? "表格" : "图片"} · {item.documentId}
                            </div>
                          </div>

                          <div className="min-w-0 text-sm text-mute">
                            <span className="mb-1 block text-[11px] font-medium text-mute md:hidden">关键词 / 来源</span>
                            <div className="truncate">{item.knowledgeKey || "未命名关键词"}</div>
                            {item.sourceUrl ? <div className="mt-1 truncate text-xs text-mute">{item.sourceUrl}</div> : null}
                          </div>

                          <div className="flex items-center justify-between text-sm text-ink-soft md:block">
                            <span className="text-[11px] font-medium text-mute md:hidden">版本</span>
                            <span>第 {item.version} 版</span>
                          </div>

                          <div className="flex items-center justify-between md:block">
                            <span className="text-[11px] font-medium text-mute md:hidden">状态</span>
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                isDeleting
                                  ? "bg-red-50 text-red-600"
                                  : item.status === "active"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : item.status === "indexing"
                                      ? "bg-amber-50 text-amber-700"
                                      : "bg-neutral-100 text-neutral-600"
                              }`}
                            >
                              {isDeleting
                                ? "删除中"
                                : item.status === "active"
                                  ? "已发布"
                                  : item.status === "indexing"
                                    ? "索引中"
                                    : "已归档"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-sm text-mute md:block">
                            <span className="text-[11px] font-medium text-mute md:hidden">更新时间</span>
                            <span>{new Date(item.updatedAt).toLocaleString("zh-CN", { hour12: false })}</span>
                          </div>

                          <div className="flex justify-end border-t border-black/[0.06] pt-2 md:border-t-0 md:pt-0">
                            <button
                              className="lux-press inline-flex h-9 w-9 items-center justify-center rounded-full text-mute transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
                              aria-label={isDeleting ? "正在删除资料" : "删除资料"}
                              disabled={Boolean(deletingId) || !item.documentId}
                              onClick={() => void handleDelete(item.documentId)}
                            >
                              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </button>
                          </div>
                        </article>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-1 text-xs text-mute sm:flex-row sm:items-center sm:justify-between">
                <span>连接知识库接口后，将直接显示真实资料状态。</span>
                <span>{deletingId ? "正在删除..." : refreshing ? "正在同步资料列表..." : "就绪"}</span>
              </div>
            </section>
          </section>
        </div>
        </div>
      </main>
    </div>
  )
}
