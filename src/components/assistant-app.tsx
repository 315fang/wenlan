"use client"

import type { KeyboardEvent, ReactNode, RefObject } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import {
  ArrowUp,
  Check,
  CircleDashed,
  Copy,
  FileText,
  Loader2,
  Menu,
  Mic,
  PanelLeftClose,
  Plus,
  Search,
  ShieldAlert,
  Square,
  Trash2,
} from "lucide-react"

import { MarkdownRenderer } from "@/components/markdown-renderer"
import { assistantName } from "@/lib/prompts"
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

const mobileShortcuts = [
  {
    icon: FileText,
    label: "新人上手",
    prompt: "新人第一次使用后台，应该先熟悉哪些模块？",
  },
  {
    icon: Search,
    label: "后台查询",
    prompt: "我想查询一个代理商状态，应该怎么操作？",
  },
  {
    icon: ShieldAlert,
    label: "异常排查",
    prompt: "代理商说看不到素材，后台应该排查哪些地方？",
  },
]

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

function scrollElementIntoView(ref: RefObject<HTMLDivElement | null>) {
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
  const [copiedMessageId, setCopiedMessageId] = useState("")
  const [serverStatus, setServerStatus] = useState<ServerStatus>(initialServerStatus)

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
      // Clipboard can be unavailable in restricted browser contexts.
    }
  }

  async function toggleVoiceRecording() {
    if (isTranscribing || !serverStatus.transcribeReady) return
    if (isRecording) {
      recorderRef.current?.stop()
      recorderRef.current = null
      setIsRecording(false)
      recorderStreamRef.current?.getTracks().forEach((track) => track.stop())
      recorderStreamRef.current = null
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
          if (activeConversation?.id) {
            appendMessage(activeConversation.id, {
              id: createId("msg"),
              role: "assistant",
              content: message,
              createdAt: new Date().toISOString(),
              status: "error",
            })
          }
        } finally {
          setIsTranscribing(false)
        }
      }

      recorder.start()
      setIsRecording(true)
    } catch {
      // Permission denial is handled by the browser prompt.
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

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    if (!isSending) {
      void handleSubmit()
    }
  }

  const composer = (
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
      onNewChat={startNewChat}
      onToggleVoice={toggleVoiceRecording}
    />
  )

  return (
    <div className="flex h-dvh overflow-hidden bg-white text-[#0d0d0d]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[min(86vw,17rem)] bg-[#f9f9f9] transition-transform duration-200 lg:static lg:z-auto lg:w-[16.5rem] lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <Sidebar
          appName={initialConfig.appName}
          conversations={sortedConversations}
          activeConversationId={activeConversationId}
          onNewChat={startNewChat}
          onSelectConversation={setActiveConversation}
          onDeleteConversation={removeConversation}
          onCloseMobile={() => setSidebarOpen(false)}
        />
      </aside>

      {sidebarOpen ? (
        <button
          aria-label="关闭侧栏"
          className="fixed inset-0 z-30 bg-black/25 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <main className="flex min-w-0 flex-1 flex-col bg-white">
        <header className="shrink-0 border-b border-black/[0.04] bg-white/95">
          <div className="flex h-16 items-center justify-between px-3 sm:px-4 lg:hidden">
            <button
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#121212] shadow-[0_8px_28px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.06] transition hover:bg-[#f7f7f7]"
              onClick={() => setSidebarOpen(true)}
              aria-label="打开侧栏"
            >
              <Menu className="h-5 w-5" />
            </button>

            <button className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[15px] font-medium text-[#2a2a2a] shadow-[0_10px_30px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.05]">
              <Image src="/wenlan-yizhantong.ico" alt="" width={20} height={20} unoptimized className="h-5 w-5 rounded-sm" />
              <span>问兰</span>
            </button>

            <button
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#121212] shadow-[0_8px_28px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.06] transition hover:bg-[#f7f7f7]"
              onClick={startNewChat}
              aria-label="新建对话"
            >
              <CircleDashed className="h-5 w-5" />
            </button>
          </div>

          <div className="hidden h-14 items-center justify-between px-3 sm:px-4 lg:flex">
            <div className="flex min-w-0 items-center gap-2">
              <button className="truncate rounded-lg px-2 py-1.5 text-lg font-medium text-[#303030] transition hover:bg-[#f7f7f7]">
                {initialConfig.assistantName}
              </button>
            </div>
          </div>
        </header>

        {!hasMessages ? (
          <>
            <section className="hidden min-h-0 flex-1 items-center justify-center px-4 pb-20 pt-4 lg:flex">
              <EmptyState
                prompts={initialConfig.starterPrompts}
                composer={composer}
                onQuickPrompt={handleQuickPrompt}
              />
            </section>

            <section className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-5 lg:hidden">
              <div className="flex-1" />
              <div className="mx-auto flex w-full max-w-md flex-col gap-6">
                <MobileQuickActions onQuickPrompt={handleQuickPrompt} />
                {composer}
              </div>
            </section>
          </>
        ) : (
          <section className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto]">
            <div className="min-h-0 overflow-y-auto px-4">
              <div className="mx-auto max-w-3xl space-y-7 py-6 pb-10">
                {activeMessages.map((message) => (
                  <MessageRow
                    key={message.id}
                    message={message}
                    onCopy={copyMessage}
                    copiedMessageId={copiedMessageId}
                  />
                ))}
                <div ref={streamAnchorRef} />
              </div>
            </div>

            <div className="bg-white px-3 pb-4 pt-2 sm:px-4">
              {composer}
              <p className="mx-auto mt-2 max-w-3xl text-center text-xs leading-5 text-[#7d7d7d]">
                重要操作请以后台实际状态为准，涉及权限、资金、删除等动作需人工复核。
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

type SidebarProps = {
  appName: string
  conversations: ChatConversation[]
  activeConversationId: string
  onNewChat: () => void
  onSelectConversation: (conversation: ChatConversation) => void
  onDeleteConversation: (conversationId: string) => void
  onCloseMobile: () => void
}

function Sidebar({
  appName,
  conversations,
  activeConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onCloseMobile,
}: SidebarProps) {
  return (
    <div className="flex h-full flex-col border-r border-black/[0.04]">
      <div className="flex h-14 shrink-0 items-center justify-between px-2">
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#5d5d5d] transition hover:bg-black/[0.06] lg:hidden"
          onClick={onCloseMobile}
          aria-label="关闭侧栏"
        >
          <PanelLeftClose className="h-5 w-5" />
        </button>
        <button
          className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#5d5d5d] transition hover:bg-black/[0.06]"
          onClick={onNewChat}
          aria-label="新建对话"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <div className="px-2">
        <button
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[#171717] transition hover:bg-black/[0.06]"
          onClick={onNewChat}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#111111] text-xs font-semibold text-white">
            问
          </span>
          <span className="truncate">新对话</span>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-4">
        <div className="px-3 pb-2 text-xs font-medium text-[#8a8a8a]">最近</div>
        <div className="space-y-0.5">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`group flex items-center gap-1 rounded-lg pr-1 transition ${
                conversation.id === activeConversationId ? "bg-black/[0.06]" : "hover:bg-black/[0.05]"
              }`}
            >
              <button
                className="min-w-0 flex-1 px-3 py-2.5 text-left"
                onClick={() => onSelectConversation(conversation)}
              >
                <div className="truncate text-sm text-[#2f2f2f]">{conversation.title}</div>
                <div className="mt-0.5 truncate text-[11px] text-[#8a8a8a]">{formatClock(conversation.updatedAt)}</div>
              </button>
              <button
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#8a8a8a] opacity-0 transition hover:bg-black/[0.08] hover:text-[#d1242f] group-hover:opacity-100"
                onClick={(event) => {
                  event.stopPropagation()
                  onDeleteConversation(conversation.id)
                }}
                aria-label="删除会话"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="shrink-0 px-3 py-3 text-xs text-[#8a8a8a]">
        <div className="truncate">{appName}</div>
      </div>
    </div>
  )
}

type MessageRowProps = {
  message: ChatMessage
  copiedMessageId: string
  onCopy: (content: string, messageId: string) => void
}

function MessageRow({ message, copiedMessageId, onCopy }: MessageRowProps) {
  const isUser = message.role === "user"
  const isPending = message.status === "pending" && !message.content

  if (isUser) {
    return (
      <article className="flex justify-end">
        <div className="max-w-[min(75%,42rem)] rounded-[1.35rem] bg-[#f4f4f4] px-5 py-3 text-[15px] leading-7 text-[#0d0d0d]">
          {message.content}
        </div>
      </article>
    )
  }

  return (
    <article className="group">
      <div className={`text-[15px] leading-7 ${message.status === "error" ? "text-[#d1242f]" : "text-[#0d0d0d]"}`}>
        {isPending ? (
          <div className="flex items-center gap-2 text-sm text-[#6f6f6f]">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在回复
          </div>
        ) : (
          <MarkdownRenderer content={message.content || "暂未生成内容。"} />
        )}
      </div>

      {message.content ? (
        <button
          className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-[#6f6f6f] opacity-100 transition hover:bg-[#f4f4f4] hover:text-[#171717] md:opacity-0 md:group-hover:opacity-100"
          onClick={() => onCopy(message.content, message.id)}
        >
          {copiedMessageId === message.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copiedMessageId === message.id ? "已复制" : "复制"}
        </button>
      ) : null}
    </article>
  )
}

function EmptyState({
  prompts,
  composer,
  onQuickPrompt,
}: {
  prompts: string[]
  composer: ReactNode
  onQuickPrompt: (prompt: string) => void
}) {
  return (
    <div className="w-full max-w-3xl">
      <h1 className="text-center text-3xl font-medium tracking-normal text-[#2f2f2f] sm:text-[2rem]">
        有什么可以帮忙的？
      </h1>

      <div className="mt-8">{composer}</div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {prompts.slice(0, 4).map((prompt) => (
          <button
            key={prompt}
            className="max-w-full rounded-full border border-[#e3e3e3] bg-white px-3 py-2 text-sm text-[#4f4f4f] transition hover:bg-[#f7f7f7]"
            onClick={() => onQuickPrompt(prompt)}
          >
            <span className="block max-w-[24rem] truncate">{prompt}</span>
          </button>
        ))}
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
  onNewChat,
  onToggleVoice,
}: {
  draft: string
  textareaRef: RefObject<HTMLTextAreaElement | null>
  isSending: boolean
  isRecording: boolean
  isTranscribing: boolean
  canTranscribe: boolean
  onChange: (value: string) => void
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  onSubmit: () => void
  onNewChat: () => void
  onToggleVoice: () => void
}) {
  const canSend = draft.trim().length > 0 && !isSending && !isTranscribing

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="hidden rounded-[1.65rem] border border-[#d9d9d9] bg-white p-2 shadow-[0_2px_16px_rgba(0,0,0,0.08)] lg:block">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={isTranscribing ? "正在识别语音..." : "给问兰助手发送消息"}
          className="max-h-48 min-h-14 w-full resize-none bg-transparent px-3 py-3 text-[15px] leading-6 text-[#0d0d0d] outline-none placeholder:text-[#8f8f8f]"
          rows={1}
        />

        <div className="flex items-center justify-between px-1 pb-1">
          <button
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition ${
              isRecording
                ? "bg-[#d1242f] text-white"
                : "text-[#5f5f5f] hover:bg-[#f4f4f4] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
            }`}
            title={canTranscribe ? (isRecording ? "停止录音" : "语音输入") : "语音输入暂不可用"}
            onClick={onToggleVoice}
            disabled={!canTranscribe || isTranscribing}
            aria-label={isRecording ? "停止录音" : "语音输入"}
          >
            {isRecording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
          </button>

          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#111111] text-white transition hover:bg-[#303030] disabled:cursor-not-allowed disabled:bg-[#d7d7d7] disabled:text-white"
            onClick={() => void onSubmit()}
            disabled={!canSend}
            aria-label="发送"
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div className="lg:hidden">
        <div className="rounded-[1.9rem] border border-[#e0e0e0] bg-white p-3 shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
          <div className="flex items-end gap-2">
            <button
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#1a1a1a] transition hover:bg-[#f4f4f4]"
              onClick={onNewChat}
              aria-label="新建对话"
              title="新建对话"
            >
              <Plus className="h-6 w-6" />
            </button>

            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={isTranscribing ? "正在识别语音..." : "问问 问兰"}
              className="min-h-11 flex-1 resize-none bg-transparent px-1 py-2 text-[16px] leading-6 text-[#0d0d0d] outline-none placeholder:text-[#8f8f8f]"
              rows={1}
            />

            <button
              className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${
                isRecording
                  ? "bg-[#d1242f] text-white"
                  : "text-[#7a7a7a] hover:bg-[#f4f4f4] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
              }`}
              title={canTranscribe ? (isRecording ? "停止录音" : "语音输入") : "语音输入暂不可用"}
              onClick={onToggleVoice}
              disabled={!canTranscribe || isTranscribing}
              aria-label={isRecording ? "停止录音" : "语音输入"}
            >
              {isRecording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-5 w-5" />}
            </button>

            <button
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#111111] text-white transition hover:bg-[#303030] disabled:cursor-not-allowed disabled:bg-[#d7d7d7] disabled:text-white"
              onClick={() => void onSubmit()}
              disabled={!canSend}
              aria-label="发送"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MobileQuickActions({ onQuickPrompt }: { onQuickPrompt: (prompt: string) => void }) {
  return (
    <div className="space-y-2">
      {mobileShortcuts.map(({ icon: Icon, label, prompt }) => (
        <button
          key={label}
          className="flex w-full items-center gap-4 rounded-2xl px-1 py-3 text-left transition hover:bg-black/[0.03]"
          onClick={() => onQuickPrompt(prompt)}
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-black/[0.08] bg-white text-[#111111] shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
            <Icon className="h-5 w-5" />
          </span>
          <span className="text-[17px] font-medium tracking-normal text-[#111111]">{label}</span>
        </button>
      ))}
    </div>
  )
}
