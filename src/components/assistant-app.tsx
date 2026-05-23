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
  Mic,
  Plus,
  Search,
  ShieldAlert,
  Square,
} from "lucide-react"

import { MarkdownRenderer } from "@/components/markdown-renderer"
import { assistantName } from "@/lib/prompts"
import { createId, ensureUserId, readStoredJson, trimText, writeStoredJson } from "@/lib/storage"
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

type FontSizeMode = "sm" | "md" | "lg"

const fontSizeOptions: Array<{ value: FontSizeMode; label: string }> = [
  { value: "sm", label: "小" },
  { value: "md", label: "中" },
  { value: "lg", label: "大" },
]

const fontSizeStyles: Record<
  FontSizeMode,
  {
    body: string
    title: string
    prompt: string
    input: string
    meta: string
  }
> = {
  sm: {
    body: "text-[14px] leading-6",
    title: "text-[2rem] sm:text-[2.15rem]",
    prompt: "text-[13px]",
    input: "text-[14px]",
    meta: "text-[11px]",
  },
  md: {
    body: "text-[15px] leading-7",
    title: "text-[2.15rem] sm:text-[2.35rem]",
    prompt: "text-[14px]",
    input: "text-[15px]",
    meta: "text-[12px]",
  },
  lg: {
    body: "text-[17px] leading-8",
    title: "text-[2.35rem] sm:text-[2.65rem]",
    prompt: "text-[15px]",
    input: "text-[16px]",
    meta: "text-[13px]",
  },
}

const preferredRecorderMimeTypes = [
  "audio/mp4",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/webm;codecs=opus",
  "audio/webm",
]

function pickRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") return ""
  for (const mimeType of preferredRecorderMimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType
    }
  }
  return ""
}

function audioBufferToWavBuffer(buffer: AudioBuffer) {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = buffer.length * blockAlign
  const wavBuffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(wavBuffer)
  let offset = 0

  const writeString = (value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index))
    }
    offset += value.length
  }

  writeString("RIFF")
  view.setUint32(offset, 36 + dataSize, true)
  offset += 4
  writeString("WAVE")
  writeString("fmt ")
  view.setUint32(offset, 16, true)
  offset += 4
  view.setUint16(offset, 1, true)
  offset += 2
  view.setUint16(offset, numChannels, true)
  offset += 2
  view.setUint32(offset, sampleRate, true)
  offset += 4
  view.setUint32(offset, byteRate, true)
  offset += 4
  view.setUint16(offset, blockAlign, true)
  offset += 2
  view.setUint16(offset, bytesPerSample * 8, true)
  offset += 2
  writeString("data")
  view.setUint32(offset, dataSize, true)
  offset += 4

  const channelData = Array.from({ length: numChannels }, (_, index) => buffer.getChannelData(index))
  for (let frame = 0; frame < buffer.length; frame += 1) {
    for (let channel = 0; channel < numChannels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][frame]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }

  return wavBuffer
}

async function convertRecordedBlobToWav(blob: Blob) {
  if (blob.type === "audio/wav") {
    return blob
  }

  const AudioContextClass =
    window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) {
    throw new Error("当前浏览器不支持语音转文字所需的音频转换能力")
  }

  const audioContext = new AudioContextClass()
  try {
    const decodedBuffer = await audioContext.decodeAudioData(await blob.arrayBuffer())
    return new Blob([audioBufferToWavBuffer(decodedBuffer)], { type: "audio/wav" })
  } finally {
    await audioContext.close().catch(() => {})
  }
}

export function AssistantApp({ initialConfig }: AssistantAppProps) {
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState("")
  const [draft, setDraft] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [fontSize, setFontSize] = useState<FontSizeMode>(() => {
    if (typeof window === "undefined") return "md"
    const stored = window.localStorage.getItem(`${initialConfig.appName}:fontSize`)
    return stored === "sm" || stored === "md" || stored === "lg" ? stored : "md"
  })
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
    window.localStorage.setItem(`${initialConfig.appName}:fontSize`, fontSize)
  }, [fontSize, initialConfig.appName])

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) || conversations[0],
    [conversations, activeConversationId]
  )
  const activeMessages = activeConversation?.messages ?? []
  const hasMessages = activeMessages.length > 0
  const fontClasses = fontSizeStyles[fontSize]

  function patchConversation(conversationId: string, updater: (conversation: ChatConversation) => ChatConversation) {
    setConversations((current) =>
      current.map((conversation) => (conversation.id === conversationId ? updater(conversation) : conversation))
    )
  }

  function startNewChat() {
    const conversation = emptyConversation()
    setConversations((current) => [conversation, ...current])
    setActiveConversationId(conversation.id)
    setDraft("")
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
      const mimeType = pickRecorderMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
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
          const recordedBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" })
          const blob = await convertRecordedBlobToWav(recordedBlob)
          const formData = new FormData()
          formData.append("file", blob, "voice.wav")
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
      fontSizeClass={fontClasses.input}
    />
  )

  return (
    <div className="flex h-dvh overflow-hidden bg-[#f6f6f4] text-[#0d0d0d]">
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-black/[0.05] bg-white/[0.96]">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111111] text-white">
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
                <div className="truncate text-[17px] font-semibold tracking-tight text-[#111]">问兰</div>
                <div className="truncate text-xs text-[#7a7a7a]">{initialConfig.headline}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="inline-flex items-center rounded-full bg-[#f2f2f2] p-1 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
                {fontSizeOptions.map((option) => (
                  <button
                    key={option.value}
                    className={`h-8 min-w-10 rounded-full px-3 text-sm transition ${
                      option.value === fontSize ? "bg-white text-[#111] shadow-sm" : "text-[#666] hover:text-[#111]"
                    }`}
                    onClick={() => setFontSize(option.value)}
                    type="button"
                    aria-label={`切换到${option.label}字号`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <button
                className="inline-flex items-center gap-2 rounded-full bg-[#111111] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#2f2f2f]"
                onClick={startNewChat}
                type="button"
              >
                <CircleDashed className="h-4 w-4" />
                <span className="hidden sm:inline">新对话</span>
              </button>
            </div>
          </div>
        </header>

        {!hasMessages ? (
          <>
            <section className="hidden min-h-0 flex-1 items-center justify-center px-4 py-6 lg:flex">
              <EmptyState
                prompts={initialConfig.starterPrompts}
                composer={composer}
                onQuickPrompt={handleQuickPrompt}
                titleClass={fontClasses.title}
                promptClass={fontClasses.prompt}
                metaClass={fontClasses.meta}
              />
            </section>

            <section className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-5 lg:hidden">
              <div className="flex-1" />
              <div className="mx-auto flex w-full max-w-md flex-col gap-6">
                <MobileQuickActions onQuickPrompt={handleQuickPrompt} labelClass={fontClasses.body} />
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
                    fontSizeClass={fontClasses.body}
                  />
                ))}
                <div ref={streamAnchorRef} />
              </div>
            </div>

            <div className="bg-white px-3 pb-4 pt-2 sm:px-4">
              {composer}
              <p className={`mx-auto mt-2 max-w-3xl text-center leading-5 text-[#7d7d7d] ${fontClasses.meta}`}>
                重要操作请以后台实际状态为准，涉及权限、资金、删除等动作需人工复核。
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

type MessageRowProps = {
  message: ChatMessage
  copiedMessageId: string
  onCopy: (content: string, messageId: string) => void
  fontSizeClass: string
}

function MessageRow({ message, copiedMessageId, onCopy, fontSizeClass }: MessageRowProps) {
  const isUser = message.role === "user"
  const isPending = message.status === "pending" && !message.content

  if (isUser) {
    return (
      <article className="flex justify-end">
        <div className={`max-w-[min(75%,42rem)] rounded-[1.35rem] bg-[#f4f4f4] px-5 py-3 text-[#0d0d0d] ${fontSizeClass}`}>
          {message.content}
        </div>
      </article>
    )
  }

  return (
    <article className="group">
      <div className={`${fontSizeClass} ${message.status === "error" ? "text-[#d1242f]" : "text-[#0d0d0d]"}`}>
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
  titleClass,
  promptClass,
  metaClass,
}: {
  prompts: string[]
  composer: ReactNode
  onQuickPrompt: (prompt: string) => void
  titleClass: string
  promptClass: string
  metaClass: string
}) {
  return (
    <div className="w-full max-w-3xl">
      <h1 className={`text-center font-medium tracking-normal text-[#2f2f2f] ${titleClass}`}>
        有什么可以帮忙的？
      </h1>
      <p className={`mt-3 text-center leading-6 text-[#777] ${metaClass}`}>问兰 · 企业级知识增强大模型系统</p>

      <div className="mt-8">{composer}</div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {prompts.slice(0, 4).map((prompt) => (
          <button
            key={prompt}
            className={`max-w-full rounded-full border border-[#e3e3e3] bg-white px-3 py-2 text-[#4f4f4f] transition hover:bg-[#f7f7f7] ${promptClass}`}
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
  fontSizeClass,
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
  fontSizeClass: string
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
          className={`max-h-48 min-h-14 w-full resize-none bg-transparent px-3 py-3 text-[#0d0d0d] outline-none placeholder:text-[#8f8f8f] ${fontSizeClass}`}
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
              className={`min-h-11 flex-1 resize-none bg-transparent px-1 py-2 text-[#0d0d0d] outline-none placeholder:text-[#8f8f8f] ${fontSizeClass}`}
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

function MobileQuickActions({ onQuickPrompt, labelClass }: { onQuickPrompt: (prompt: string) => void; labelClass: string }) {
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
          <span className={`font-medium tracking-normal text-[#111111] ${labelClass}`}>{label}</span>
        </button>
      ))}
    </div>
  )
}
