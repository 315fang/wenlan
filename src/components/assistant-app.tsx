"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Check,
  ChevronDown,
  Copy,
  Layers3,
  Menu,
  Mic,
  MessageSquareText,
  Plus,
  RefreshCcw,
  Send,
  Settings,
  ShieldAlert,
  Square,
  Sparkles,
  Trash2,
} from "lucide-react"

import { MarkdownRenderer } from "@/components/markdown-renderer"
import { assistantHeadline, assistantName, assistantSubtitle, emptyStateCopy, insightCards, knowledgeOutline, starterPrompts } from "@/lib/prompts"
import { createId, ensureUserId, formatClock, readStoredJson, sortConversations, trimText, writeStoredJson } from "@/lib/storage"
import type { ChatConversation, ChatMessage, PortalConfig, ServerStatus } from "@/types/chat"

type AssistantAppProps = {
  initialConfig: PortalConfig
}

type StreamEvent = {
  event?: string
  answer?: string
  conversation_id?: string
  [key: string]: unknown
}

const emptyConversation = (): ChatConversation => ({
  id: createId("conv"),
  title: "新对话",
  messages: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

const initialServerStatus: ServerStatus = {
  chatReady: false,
  transcribeReady: false,
  provider: "dify",
  baseUrl: "",
  assistantName,
  assistantLabel: "Dify",
}

function parseSseBlock(block: string) {
  const lines = block.split(/\r?\n/)
  let event = ""
  const dataLines: string[] = []

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim()
      continue
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart())
    }
  }

  const raw = dataLines.join("\n").trim()
  if (!raw || raw === "[DONE]") return null

  try {
    return {
      event,
      data: JSON.parse(raw) as StreamEvent,
    }
  } catch {
    return null
  }
}

function buildConversationTitle(prompt: string) {
  return trimText(prompt.replace(/[？?。，、:：]/g, " "), 16)
}

function scrollElementIntoView(ref: React.RefObject<HTMLDivElement | null>) {
  requestAnimationFrame(() => {
    ref.current?.scrollIntoView({ block: "end", behavior: "smooth" })
  })
}

export function AssistantApp({ initialConfig }: AssistantAppProps) {
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState("")
  const [draft, setDraft] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [copiedMessageId, setCopiedMessageId] = useState("")
  const [serverStatus, setServerStatus] = useState<ServerStatus>(initialServerStatus)
  const [statusLoading, setStatusLoading] = useState(true)

  const streamAnchorRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recorderStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const userIdRef = useRef("browser")

  useEffect(() => {
    userIdRef.current = ensureUserId()
  }, [initialConfig.appName])

  useEffect(() => {
    if (conversations.length > 0) {
      writeStoredJson(`${initialConfig.appName}:conversations`, conversations)
    }
  }, [conversations, initialConfig.appName])

  useEffect(() => {
    if (activeConversationId) {
      writeStoredJson(`${initialConfig.appName}:activeConversationId`, activeConversationId)
    }
  }, [activeConversationId, initialConfig.appName])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const response = await fetch("/api/config", { cache: "no-store" })
        if (!response.ok) throw new Error("config unavailable")
        const payload = (await response.json()) as ServerStatus
        if (alive) {
          setServerStatus(payload)
        }
      } catch {
        if (alive) {
          setServerStatus(initialServerStatus)
        }
      } finally {
        if (alive) setStatusLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    let alive = true
    queueMicrotask(() => {
      if (!alive) return
      const storedConversations = readStoredJson<ChatConversation[]>(`${initialConfig.appName}:conversations`, [])
      const storedActiveId = readStoredJson<string>(`${initialConfig.appName}:activeConversationId`, "")

      if (storedConversations.length > 0) {
        setConversations(storedConversations)
        setActiveConversationId(storedActiveId || storedConversations[0].id)
        return
      }

      const firstConversation = emptyConversation()
      setConversations([firstConversation])
      setActiveConversationId(firstConversation.id)
    })
    return () => {
      alive = false
    }
  }, [initialConfig.appName])

  useEffect(() => {
    scrollElementIntoView(streamAnchorRef)
  }, [conversations, activeConversationId, isSending])

  useEffect(() => {
    if (!sidebarOpen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [sidebarOpen])

  const sortedConversations = useMemo(() => sortConversations(conversations), [conversations])
  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) || conversations[0],
    [conversations, activeConversationId]
  )
  const activeMessages = activeConversation?.messages ?? []
  const hasMessages = activeMessages.length > 0
  const configStatus = serverStatus.chatReady ? "已连接后端" : "等待部署配置"
  const configTone = serverStatus.chatReady
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
    : "border-amber-500/30 bg-amber-500/10 text-amber-100"

  function patchConversation(conversationId: string, updater: (conversation: ChatConversation) => ChatConversation) {
    setConversations((current) =>
      current.map((conversation) => (conversation.id === conversationId ? updater(conversation) : conversation))
    )
  }

  function setActiveConversation(conversation: ChatConversation) {
    setActiveConversationId(conversation.id)
    setSidebarOpen(false)
    setDraft("")
  }

  function startNewChat() {
    const conversation = emptyConversation()
    setConversations((current) => [conversation, ...current])
    setActiveConversation(conversation)
  }

  function appendMessage(conversationId: string, message: ChatMessage) {
    patchConversation(conversationId, (conversation) => ({
      ...conversation,
      messages: [...conversation.messages, message],
      updatedAt: new Date().toISOString(),
    }))
  }

  function updateMessage(conversationId: string, messageId: string, nextContent: string, status?: ChatMessage["status"]) {
    patchConversation(conversationId, (conversation) => ({
      ...conversation,
      messages: conversation.messages.map((message) =>
        message.id === messageId ? { ...message, content: nextContent, status } : message
      ),
      updatedAt: new Date().toISOString(),
    }))
  }

  function syncConversationTitle(conversationId: string, prompt: string) {
    patchConversation(conversationId, (conversation) => {
      if (conversation.title !== "新对话") return conversation
      return {
        ...conversation,
        title: buildConversationTitle(prompt),
        updatedAt: new Date().toISOString(),
      }
    })
  }

  async function sendPrompt(promptText: string) {
    const prompt = promptText.trim()
    if (!prompt || isSending) return

    const conversation = activeConversation ?? emptyConversation()
    if (!conversations.some((item) => item.id === conversation.id)) {
      setConversations((current) => [conversation, ...current])
      setActiveConversationId(conversation.id)
    }

    const conversationId = conversation.id
    const userMessage: ChatMessage = {
      id: createId("msg"),
      role: "user",
      content: prompt,
      createdAt: new Date().toISOString(),
      status: "done",
    }
    const assistantMessageId = createId("msg")
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      status: "pending",
    }

    setIsSending(true)
    setDraft("")
    setActiveConversationId(conversationId)

    appendMessage(conversationId, userMessage)
    appendMessage(conversationId, assistantMessage)
    syncConversationTitle(conversationId, prompt)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: prompt,
          conversationId: conversation.difyConversationId || "",
          userId: userIdRef.current,
          pagePath: window.location.pathname,
        }),
      })

      if (!response.ok || !response.body) {
        const errorPayload = await response.json().catch(() => ({}))
        throw new Error((errorPayload as { error?: string }).error || "AI 服务暂时不可用")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder("utf-8")
      let buffer = ""
      let assistantText = ""
      let latestConversationId = conversation.difyConversationId || ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        let delimiterIndex = buffer.indexOf("\n\n")

        while (delimiterIndex !== -1) {
          const block = buffer.slice(0, delimiterIndex).trim()
          buffer = buffer.slice(delimiterIndex + 2)
          const parsed = parseSseBlock(block)
          if (parsed?.data) {
            const payload = parsed.data
            if (typeof payload.conversation_id === "string" && payload.conversation_id) {
              latestConversationId = payload.conversation_id
            }
            if (typeof payload.answer === "string" && payload.answer) {
              assistantText += payload.answer
              updateMessage(conversationId, assistantMessageId, assistantText, "pending")
            } else if (payload.event === "message_end" && assistantText) {
              updateMessage(conversationId, assistantMessageId, assistantText, "done")
            }
          }
          delimiterIndex = buffer.indexOf("\n\n")
        }
      }

      updateMessage(conversationId, assistantMessageId, assistantText || "AI 暂时没有返回正文。", "done")
      if (latestConversationId) {
        patchConversation(conversationId, (item) => ({
          ...item,
          difyConversationId: latestConversationId,
          updatedAt: new Date().toISOString(),
        }))
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 助手暂时无法回复"
      updateMessage(conversationId, assistantMessageId, message, "error")
    } finally {
      setIsSending(false)
    }
  }

  async function handleSubmit() {
    await sendPrompt(draft)
  }

  async function handleQuickPrompt(prompt: string) {
    await sendPrompt(prompt)
  }

  async function copyMessage(content: string, messageId: string) {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedMessageId(messageId)
      window.setTimeout(() => setCopiedMessageId(""), 1200)
    } catch {
      // ignore clipboard failures
    }
  }

  async function toggleVoiceRecording() {
    if (isTranscribing) return
    if (isRecording) {
      recorderRef.current?.stop()
      recorderRef.current = null
      setIsRecording(false)
      recorderStreamRef.current?.getTracks().forEach((track) => track.stop())
      recorderStreamRef.current = null
      return
    }

    if (!serverStatus.transcribeReady) {
      setSettingsOpen(true)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recorderStreamRef.current = stream
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        setIsTranscribing(true)
        try {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" })
          const formData = new FormData()
          formData.append("file", blob, "voice.webm")
          const response = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          })
          if (!response.ok) {
            const errorPayload = await response.json().catch(() => ({}))
            throw new Error((errorPayload as { error?: string }).error || "语音转文字失败")
          }
          const payload = (await response.json()) as { text?: string }
          const text = (payload.text || "").trim()
          if (text) {
            setDraft((current) => `${current ? `${current} ` : ""}${text}`)
            textareaRef.current?.focus()
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "语音转文字失败"
          updateMessage(activeConversation.id, createId("voice"), message, "error")
        } finally {
          setIsTranscribing(false)
        }
      }

      recorder.start()
      setIsRecording(true)
    } catch {
      // ignore permission denial
    }
  }

  function removeConversation(conversationId: string) {
    setConversations((current) => {
      const next = current.filter((conversation) => conversation.id !== conversationId)
      if (conversationId === activeConversationId) {
        const fallback = next[0] || emptyConversation()
        if (next.length === 0) {
          setActiveConversationId(fallback.id)
          return [fallback]
        }
        setActiveConversationId(fallback.id)
      }
      return next
    })
  }

  function handleTextareaKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    if (!isSending) {
      void handleSubmit()
    }
  }

  return (
    <div className="min-h-screen bg-[#06101d] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-4 p-4 lg:p-5">
        <aside className={`fixed inset-y-0 left-0 z-40 w-[min(88vw,21rem)] border-r border-white/10 bg-[#07111c]/95 backdrop-blur-xl transition-transform duration-200 lg:static lg:z-auto lg:w-[20.5rem] lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
          <Sidebar
            appName={initialConfig.appName}
            assistantName={initialConfig.assistantName}
            assistantSubtitle={initialConfig.subtitle}
            configTone={configTone}
            configStatus={configStatus}
            statusLoading={statusLoading}
            serverStatus={serverStatus}
            conversations={sortedConversations}
            activeConversationId={activeConversationId}
            onNewChat={startNewChat}
            onSelectConversation={setActiveConversation}
            onDeleteConversation={removeConversation}
            onQuickPrompt={handleQuickPrompt}
            onOpenSettings={() => setSettingsOpen(true)}
            onCloseMobile={() => setSidebarOpen(false)}
          />
        </aside>

        {sidebarOpen ? (
          <button
            aria-label="关闭侧栏"
            className="fixed inset-0 z-30 bg-slate-950/55 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] shadow-[0_18px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <button
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-100 transition hover:bg-white/10 lg:hidden"
                onClick={() => setSidebarOpen(true)}
                aria-label="打开侧栏"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-[15px] font-semibold tracking-tight text-white sm:text-base">
                    {initialConfig.assistantName}
                  </h1>
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${configTone}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${serverStatus.chatReady ? "bg-emerald-300" : "bg-amber-200"}`} />
                    {configStatus}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-400">
                  {assistantHeadline} · {assistantSubtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 transition hover:bg-white/10 md:inline-flex"
                onClick={startNewChat}
              >
                <Plus className="h-4 w-4" />
                新对话
              </button>
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-100 transition hover:bg-white/10"
                onClick={() => setSettingsOpen(true)}
                aria-label="打开设置"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </header>

          <section className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto]">
            <div className="relative min-h-0 overflow-y-auto px-4 py-5 sm:px-6">
              {!hasMessages ? (
                <EmptyState
                  appName={initialConfig.appName}
                  assistantName={initialConfig.assistantName}
                  subtitle={initialConfig.subtitle}
                  prompts={initialConfig.starterPrompts}
                  onQuickPrompt={handleQuickPrompt}
                />
              ) : (
                <div className="space-y-4 pb-8">
                  {activeMessages.map((message) => (
                    <MessageRow
                      key={message.id}
                      message={message}
                      assistantName={initialConfig.assistantName}
                      onCopy={copyMessage}
                      copiedMessageId={copiedMessageId}
                    />
                  ))}
                </div>
              )}
              <div ref={streamAnchorRef} />
            </div>

            <Composer
              draft={draft}
              textareaRef={textareaRef}
              isSending={isSending}
              isRecording={isRecording}
              isTranscribing={isTranscribing}
              canTranscribe={serverStatus.transcribeReady}
              onChange={setDraft}
              onKeyDown={handleTextareaKeyDown}
              onSubmit={handleSubmit}
              onQuickPrompt={handleQuickPrompt}
              onToggleVoice={toggleVoiceRecording}
            />
          </section>
        </main>
      </div>

      {settingsOpen ? (
        <SettingsDrawer
          onClose={() => setSettingsOpen(false)}
          serverStatus={serverStatus}
          initialConfig={initialConfig}
        />
      ) : null}
    </div>
  )
}

type SidebarProps = {
  appName: string
  assistantName: string
  assistantSubtitle: string
  configTone: string
  configStatus: string
  statusLoading: boolean
  serverStatus: ServerStatus
  conversations: ChatConversation[]
  activeConversationId: string
  onNewChat: () => void
  onSelectConversation: (conversation: ChatConversation) => void
  onDeleteConversation: (conversationId: string) => void
  onQuickPrompt: (prompt: string) => void
  onOpenSettings: () => void
  onCloseMobile: () => void
}

function Sidebar({
  appName,
  assistantName,
  assistantSubtitle,
  configTone,
  configStatus,
  statusLoading,
  serverStatus,
  conversations,
  activeConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onQuickPrompt,
  onOpenSettings,
  onCloseMobile,
}: SidebarProps) {
  const providerLabel = serverStatus.provider === "custom" ? "自定义后端" : serverStatus.provider === "dify" ? "Dify" : "未配置"

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-200">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{appName}</div>
              <div className="truncate text-xs text-slate-400">{assistantName}</div>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-400">{assistantSubtitle}</p>
        </div>
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10 lg:hidden"
          onClick={onCloseMobile}
          aria-label="关闭侧栏"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3 border-b border-white/10 p-4 sm:p-5">
        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-400"
          onClick={onNewChat}
        >
          <Plus className="h-4 w-4" />
          新建对话
        </button>
        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100 transition hover:bg-white/10"
          onClick={onOpenSettings}
        >
          <Settings className="h-4 w-4" />
          部署与连接
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
        <SectionTitle icon={<MessageSquareIcon />} title="最近会话" />
        <div className="mt-3 space-y-2">
          {conversations.length === 0 ? (
            <EmptySidebarBlock title="暂无会话" description="创建一个新对话开始。">
              <button className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100" onClick={onNewChat}>
                立即开始
              </button>
            </EmptySidebarBlock>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`group rounded-lg border px-3 py-3 transition ${
                  conversation.id === activeConversationId
                    ? "border-cyan-500/40 bg-cyan-500/10"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button className="min-w-0 flex-1 text-left" onClick={() => onSelectConversation(conversation)}>
                    <div className="truncate text-sm font-medium text-white">{conversation.title}</div>
                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
                      {conversation.messages.length > 0
                        ? conversation.messages[conversation.messages.length - 1].content
                        : "等待开始"}
                    </div>
                  </button>
                  <button
                    className="rounded-full p-1 text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-rose-300"
                    onClick={(event) => {
                      event.stopPropagation()
                      onDeleteConversation(conversation.id)
                    }}
                    aria-label="删除会话"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <SectionTitle icon={<Sparkles className="h-4 w-4" />} title="快捷提问" />
        <div className="mt-3 grid gap-2">
          {starterPrompts.map((prompt) => (
            <button
              key={prompt}
              className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-left text-sm leading-6 text-slate-100 transition hover:border-cyan-500/30 hover:bg-cyan-500/10"
              onClick={() => onQuickPrompt(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>

        <SectionTitle icon={<ShieldAlert className="h-4 w-4" />} title="知识边界" />
        <div className="mt-3 space-y-2">
          {knowledgeOutline.map((item) => (
            <div key={item} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-200">
              {item}
            </div>
          ))}
        </div>

        <SectionTitle icon={<LayersIcon />} title="写作风格" />
        <div className="mt-3 space-y-2">
          {insightCards.map((card) => (
            <div key={card.title} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3">
              <div className="text-sm font-medium text-white">{card.title}</div>
              <p className="mt-1 text-xs leading-5 text-slate-400">{card.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10 p-4 sm:p-5">
        <div className={`rounded-lg border px-3 py-3 ${configTone}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium text-white">{configStatus}</div>
            <span className="text-[11px] uppercase tracking-[0.22em] text-slate-300">
              {statusLoading ? "检查中" : providerLabel}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-300/90">
            {serverStatus.chatReady
              ? `聊天与转写已启用 · ${serverStatus.baseUrl || "已配置"}`
              : "请在 Vercel 环境变量中配置 Dify 连接信息。"}
          </p>
        </div>
      </div>
    </div>
  )
}

type MessageRowProps = {
  message: ChatMessage
  assistantName: string
  copiedMessageId: string
  onCopy: (content: string, messageId: string) => void
}

function MessageRow({ message, assistantName, copiedMessageId, onCopy }: MessageRowProps) {
  const isUser = message.role === "user"
  return (
    <article className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[min(46rem,100%)] ${isUser ? "ml-12" : "mr-12"} w-full`}>
        <div
          className={`rounded-xl border px-4 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.16)] sm:px-5 ${
            isUser
              ? "border-cyan-500/20 bg-cyan-500/15 text-white"
              : "border-white/10 bg-[#0b1321]/92 text-slate-100"
          }`}
        >
          <div className="mb-3 flex items-center justify-between gap-3 text-xs text-slate-300/80">
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${isUser ? "bg-cyan-400/15 text-cyan-200" : "bg-white/10 text-white"}`}>
                {isUser ? "我" : assistantName.slice(0, 1)}
              </span>
              <span className="font-medium text-slate-100">{isUser ? "我" : assistantName}</span>
              {message.status === "pending" ? <span className="text-cyan-200">回复中</span> : null}
              {message.status === "error" ? <span className="text-rose-300">异常</span> : null}
            </div>
            <div className="flex items-center gap-2">
              <span>{formatClock(message.createdAt)}</span>
              {!isUser ? (
                <button
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-200 transition hover:bg-white/10"
                  onClick={() => onCopy(message.content, message.id)}
                >
                  {copiedMessageId === message.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedMessageId === message.id ? "已复制" : "复制"}
                </button>
              ) : null}
            </div>
          </div>
          <MarkdownRenderer content={message.content || (message.status === "pending" ? " " : "暂未生成内容。")} />
        </div>
      </div>
    </article>
  )
}

function EmptyState({
  appName,
  assistantName,
  subtitle,
  prompts,
  onQuickPrompt,
}: {
  appName: string
  assistantName: string
  subtitle: string
  prompts: string[]
  onQuickPrompt: (prompt: string) => void
}) {
  return (
    <div className="flex min-h-[calc(100vh-24rem)] flex-col justify-center py-4">
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-200">
            <Sparkles className="h-3.5 w-3.5" />
            {appName}
          </div>
          <div>
            <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">{assistantName}</h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">{emptyStateCopy}</p>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">{subtitle}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {insightCards.map((card) => (
              <div key={card.title} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <div className="text-sm font-medium text-white">{card.title}</div>
                <p className="mt-2 text-sm leading-6 text-slate-400">{card.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0b1321]/90 p-4 sm:p-5">
          <div className="text-sm font-medium text-white">快捷问题</div>
          <div className="mt-4 grid gap-3">
            {prompts.map((prompt) => (
              <button
                key={prompt}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-4 text-left text-sm leading-6 text-slate-100 transition hover:border-cyan-500/30 hover:bg-cyan-500/10"
                onClick={() => onQuickPrompt(prompt)}
              >
                <div className="flex items-start justify-between gap-3">
                  <span>{prompt}</span>
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Composer({
  draft,
  textareaRef,
  isSending,
  isRecording,
  isTranscribing,
  canTranscribe,
  onChange,
  onKeyDown,
  onSubmit,
  onQuickPrompt,
  onToggleVoice,
}: {
  draft: string
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  isSending: boolean
  isRecording: boolean
  isTranscribing: boolean
  canTranscribe: boolean
  onChange: (value: string) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onSubmit: () => void
  onQuickPrompt: (prompt: string) => void
  onToggleVoice: () => void
}) {
  return (
    <div className="border-t border-white/10 bg-[#07111e]/96 px-4 py-4 backdrop-blur-xl sm:px-6">
      <div className="mx-auto max-w-5xl space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {starterPrompts.slice(0, 3).map((prompt) => (
            <button
              key={prompt}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-200 transition hover:bg-white/10"
              onClick={() => onQuickPrompt(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0b1321] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.22)]">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="和 问兰后台操作助手 聊天"
            className="min-h-[5.5rem] w-full resize-none bg-transparent px-2 py-1 text-[15px] leading-7 text-white outline-none placeholder:text-slate-500"
            rows={3}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-1 pt-3">
            <div className="flex items-center gap-2">
              <button
                className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border transition ${
                  isRecording
                    ? "border-rose-400/40 bg-rose-500/20 text-rose-100"
                    : "border-white/10 bg-white/[0.03] text-slate-100 hover:bg-white/10"
                } ${!canTranscribe ? "opacity-60" : ""}`}
                title={canTranscribe ? (isRecording ? "停止录音" : "语音输入") : "请先配置转写服务"}
                onClick={onToggleVoice}
              >
                {isRecording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-slate-100 transition hover:bg-white/10"
                onClick={() => onChange("")}
              >
                <Trash2 className="h-4 w-4" />
                清空输入
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-slate-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onSubmit}
                disabled={isSending || isTranscribing || !draft.trim()}
              >
                {isSending ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isSending ? "发送中" : isTranscribing ? "转写中" : "发送"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SettingsDrawer({
  onClose,
  serverStatus,
  initialConfig,
}: {
  onClose: () => void
  serverStatus: ServerStatus
  initialConfig: PortalConfig
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm">
      <button className="absolute inset-0" aria-label="关闭设置" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-[min(100vw,32rem)] overflow-y-auto border-l border-white/10 bg-[#07111c] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-base font-semibold text-white">部署与连接</div>
            <p className="mt-1 text-xs text-slate-400">面向 Vercel 的运行说明</p>
          </div>
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-100 transition hover:bg-white/10"
            onClick={onClose}
            aria-label="关闭设置"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Bot className="h-4 w-4 text-cyan-300" />
              当前应用
            </div>
            <div className="mt-3 space-y-2 text-sm text-slate-300">
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">名称</span>
                <span className="text-right text-white">{initialConfig.assistantName}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">副标题</span>
                <span className="text-right text-white">{initialConfig.subtitle}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">状态</span>
                <span className="text-right text-emerald-200">{serverStatus.chatReady ? "已连接" : "未配置"}</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <ArrowUpRight className="h-4 w-4 text-cyan-300" />
              Vercel 环境变量
            </div>
            <div className="mt-3 space-y-3 text-sm leading-6 text-slate-300">
              <EnvRow name="CHAT_BACKEND_URL / DIFY_BASE_URL" value={serverStatus.baseUrl || "未配置"} />
              <EnvRow name="CHAT_BACKEND_KEY / DIFY_API_KEY" value={serverStatus.chatReady ? "已配置" : "未配置"} />
              <EnvRow name="MIMO_API_KEY" value={serverStatus.transcribeReady ? "已配置" : "未配置"} />
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <AlertTriangle className="h-4 w-4 text-amber-300" />
              国内访问建议
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
              <li>Vercel 前端可配自定义域名，移动端会比直接 IP 友好得多。</li>
              <li>后端接口建议放在你自己的服务器或 CloudBase，再由 Vercel Serverless 代理。</li>
              <li>如果要追求大陆稳定，香港前端一般比美国更稳一点。</li>
            </ul>
          </div>
        </div>
      </aside>
    </div>
  )
}

function EnvRow({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-[#09131f] px-3 py-3">
      <span className="font-mono text-xs tracking-[0.18em] text-cyan-200">{name}</span>
      <span className="text-right text-sm text-slate-100">{value}</span>
    </div>
  )
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mt-5 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
      <span className="text-cyan-300">{icon}</span>
      <span>{title}</span>
    </div>
  )
}

function EmptySidebarBlock({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.03] px-4 py-4">
      <div className="text-sm font-medium text-white">{title}</div>
      <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
      <div className="mt-3">{children}</div>
    </div>
  )
}

function MessageSquareIcon() {
  return <MessageSquareText className="h-4 w-4" />
}

function LayersIcon() {
  return <Layers3 className="h-4 w-4" />
}
