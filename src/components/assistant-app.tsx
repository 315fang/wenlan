"use client"

import type { KeyboardEvent, ReactNode, RefObject } from "react"
import Image from "next/image"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowUp,
  Check,
  CircleDashed,
  Copy,
  FileText,
  Loader2,
  Menu,
  Mic,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react"

import { AppSidebar, MobileAppSidebar } from "@/components/app-sidebar"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { assistantName, emptyStateCopy, onboardingGuide } from "@/lib/prompts"
import {
  STORAGE_KEYS,
  createId,
  ensureUserId,
  formatClock,
  readStoredJson,
  sortConversations,
  trimText,
  writeStoredJson,
} from "@/lib/storage"
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
  assistantLabel: "智能客服",
}

const mobileShortcuts = [
  {
    icon: FileText,
    label: "找官方图片",
    prompt: "帮我找适合发朋友圈的官方图片素材。",
  },
  {
    icon: Search,
    label: "复制文案",
    prompt: "给我一段可以直接复制的朋友圈宣传文案。",
  },
  {
    icon: ShieldAlert,
    label: "产品卖点",
    prompt: "根据最新资料，帮我整理一下产品卖点。",
  },
]

const launchTitle = "今天你“问”了吗？"
const launchFeatureLabels = ["文章资料", "官方图片", "宣传文案", "语音输入", "字号切换"]

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
type DisplayMode = "youth" | "care"
type LayoutDensity = "regular" | "compact" | "tight"

const fontSizeOptions: Array<{ value: FontSizeMode; label: string }> = [
  { value: "sm", label: "小" },
  { value: "md", label: "中" },
  { value: "lg", label: "大" },
]

const displayModeOptions: Array<{ value: DisplayMode; label: string }> = [
  { value: "youth", label: "青年版" },
  { value: "care", label: "关爱版" },
]

function useLayoutDensity() {
  const [density, setDensity] = useState<LayoutDensity>("regular")

  useEffect(() => {
    const update = () => {
      const width = Math.round(window.visualViewport?.width || window.innerWidth || 0)
      if (width <= 375) {
        setDensity("tight")
        return
      }
      if (width <= 430) {
        setDensity("compact")
        return
      }
      setDensity("regular")
    }

    update()
    window.addEventListener("resize", update)
    window.addEventListener("orientationchange", update)
    window.visualViewport?.addEventListener("resize", update)

    return () => {
      window.removeEventListener("resize", update)
      window.removeEventListener("orientationchange", update)
      window.visualViewport?.removeEventListener("resize", update)
    }
  }, [])

  return density
}

const fontSizeStyles: Record<
  FontSizeMode,
  {
    body: string
    title: string
    prompt: string
    input: string
    meta: string

    // Header sizes
    headerHeight: string
    headerTitle: string
    headerSubtitle: string
    headerNewChatBtn: string

    // Sidebar sizes
    sidebarWidth: string
    sidebarNewChatBtn: string
    sidebarGuideBtn: string
    sidebarHeading: string
    sidebarItemTitle: string
    sidebarItemDate: string
    sidebarItemBtn: string
    sidebarPrefBtn: string

    // Message Row sizes
    messageSpacing: string
    userBubble: string
    copyBtn: string

    // Empty State / Welcome Panel sizes
    welcomeShell: string
    welcomeLogoBox: string
    welcomeLogoSize: number
    welcomeSubtitleChip: string
    welcomeTitleMargin: string
    welcomeCopyMargin: string
    welcomeChipMargin: string
    welcomeFeatureChip: string

    // Mobile Quick Actions
    qaSpacing: string
    qaPadding: string
    qaIconBox: string
    qaIcon: string
    qaTitle: string
    qaSubtitle: string
  }
> = {
  sm: {
    body: "text-[34px] leading-[1.65]",
    title: "text-[4.1rem] sm:text-[4.45rem]",
    prompt: "text-[29px]",
    input: "text-[33px]",
    meta: "text-[25px]",
    headerHeight: "h-25 sm:h-28",
    headerTitle: "text-[30px] sm:text-[33px]",
    headerSubtitle: "text-[20px] sm:text-[22px]",
    headerNewChatBtn: "h-16 px-6 text-[20px] gap-3",
    sidebarWidth: "w-[30rem]",
    sidebarNewChatBtn: "h-20 text-[25px] gap-4 rounded-[1.75rem]",
    sidebarGuideBtn: "h-19 text-[24px] gap-3 rounded-[1.75rem]",
    sidebarHeading: "text-[20px]",
    sidebarItemTitle: "text-[26px]",
    sidebarItemDate: "text-[22px]",
    sidebarItemBtn: "px-6 py-4",
    sidebarPrefBtn: "h-15 text-[22px] rounded-xl",
    messageSpacing: "space-y-12 py-9 pb-15",
    userBubble: "px-5 py-3 rounded-2xl max-w-[88%] bg-[#e3effd] border border-[#d2e3fc]/30",
    copyBtn: "h-16 px-5 text-[22.5px] gap-3",
    welcomeShell: "px-7.5 py-7.5 sm:px-10 sm:py-10",
    welcomeLogoBox: "h-25 w-25 rounded-[1.6rem] p-3.5",
    welcomeLogoSize: 75,
    welcomeSubtitleChip: "text-[22px] gap-3 mt-2.5",
    welcomeTitleMargin: "mt-5.5",
    welcomeCopyMargin: "mt-6.5",
    welcomeChipMargin: "mt-7",
    welcomeFeatureChip: "rounded-full border border-[#e5e5e5] bg-[#fafafa] px-6 py-3 text-[22px] font-medium text-[#555]",
    qaSpacing: "space-y-5",
    qaPadding: "gap-6.5 rounded-[1.9rem] p-6.5",
    qaIconBox: "h-20 w-20 rounded-[1.5rem]",
    qaIcon: "h-9 w-9",
    qaTitle: "text-[26px]",
    qaSubtitle: "text-[22px] mt-0.5",
  },
  md: {
    body: "text-[40px] leading-[1.65]",
    title: "text-[4.9rem] sm:text-[5.3rem]",
    prompt: "text-[35px]",
    input: "text-[38px]",
    meta: "text-[29px]",
    headerHeight: "h-30 sm:h-35",
    headerTitle: "text-[36px] sm:text-[40px]",
    headerSubtitle: "text-[24.5px] sm:text-[27px]",
    headerNewChatBtn: "h-20 px-9 text-[25px] gap-4",
    sidebarWidth: "w-[34rem]",
    sidebarNewChatBtn: "h-24 text-[30px] gap-4.5 rounded-[2.1rem]",
    sidebarGuideBtn: "h-22 text-[28px] gap-4 rounded-[2.1rem]",
    sidebarHeading: "text-[24px]",
    sidebarItemTitle: "text-[29px]",
    sidebarItemDate: "text-[24.5px]",
    sidebarItemBtn: "px-6.5 py-4.5",
    sidebarPrefBtn: "h-19 text-[26px] rounded-[1.5rem]",
    messageSpacing: "space-y-15 py-12 pb-22",
    userBubble: "px-6 py-4 rounded-[1.4rem] max-w-[88%] bg-[#e3effd] border border-[#d2e3fc]/30",
    copyBtn: "h-19 px-6 text-[26px] gap-4",
    welcomeShell: "px-9.5 py-9.5 sm:px-12.5 sm:py-12.5",
    welcomeLogoBox: "h-35 w-35 rounded-[2.2rem] p-5",
    welcomeLogoSize: 98,
    welcomeSubtitleChip: "text-[24px] gap-4 mt-3",
    welcomeTitleMargin: "mt-7",
    welcomeCopyMargin: "mt-7.5",
    welcomeChipMargin: "mt-9",
    welcomeFeatureChip: "rounded-full border border-[#e5e5e5] bg-[#fafafa] px-7.5 py-4 text-[26.5px] font-medium text-[#555]",
    qaSpacing: "space-y-6",
    qaPadding: "gap-7.5 rounded-[2.2rem] p-8",
    qaIconBox: "h-25 w-25 rounded-[1.9rem]",
    qaIcon: "h-12 w-12",
    qaTitle: "text-[32.5px]",
    qaSubtitle: "text-[25px] mt-2",
  },
  lg: {
    body: "text-[50px] leading-[1.7]",
    title: "text-[5.75rem] sm:text-[6.25rem]",
    prompt: "text-[44px]",
    input: "text-[48px]",
    meta: "text-[36px]",
    headerHeight: "h-35 sm:h-40",
    headerTitle: "text-[45px] sm:text-[50px]",
    headerSubtitle: "text-[30px] sm:text-[34px]",
    headerNewChatBtn: "h-25 px-11.5 text-[31px] gap-4.5",
    sidebarWidth: "w-[40rem]",
    sidebarNewChatBtn: "h-30 text-[36px] gap-5 rounded-[2.6rem]",
    sidebarGuideBtn: "h-26 text-[34px] gap-4.5 rounded-[2.6rem]",
    sidebarHeading: "text-[28px]",
    sidebarItemTitle: "text-[36px]",
    sidebarItemDate: "text-[29px]",
    sidebarItemBtn: "px-9 py-6",
    sidebarPrefBtn: "h-21 text-[31px] rounded-[1.9rem]",
    messageSpacing: "space-y-19 py-17 pb-32",
    userBubble: "px-8 py-5.5 rounded-[1.8rem] max-w-[88%] bg-[#e3effd] border border-[#d2e3fc]/30",
    copyBtn: "h-22.5 px-7.5 text-[31px] gap-4.5",
    welcomeShell: "px-12 py-12 sm:px-17.5 sm:py-17.5",
    welcomeLogoBox: "h-44 w-44 rounded-[3rem] p-6.5",
    welcomeLogoSize: 135,
    welcomeSubtitleChip: "text-[30px] gap-4.5 mt-4",
    welcomeTitleMargin: "mt-8",
    welcomeCopyMargin: "mt-9",
    welcomeChipMargin: "mt-10",
    welcomeFeatureChip: "rounded-full border border-[#e5e5e5] bg-[#fafafa] px-9.5 py-5 text-[32px] font-medium text-[#555]",
    qaSpacing: "space-y-7.5",
    qaPadding: "gap-9.5 rounded-[2.75rem] p-10",
    qaIconBox: "h-35 w-35 rounded-[2.4rem]",
    qaIcon: "h-16 w-16",
    qaTitle: "text-[42.5px]",
    qaSubtitle: "text-[32px] mt-3",
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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [guideModalOpen, setGuideModalOpen] = useState(false)
  const [displayMode, setDisplayMode] = useState<DisplayMode>(() => {
    if (typeof window === "undefined") return "youth"
    const stored = window.localStorage.getItem(STORAGE_KEYS.displayMode)
    if (stored === "care" || stored === "youth") return stored
    const legacyFontSize =
      window.localStorage.getItem(STORAGE_KEYS.fontSize) ||
      window.localStorage.getItem("问兰 AI Portal:fontSize") ||
      "md"
    return legacyFontSize === "lg" ? "care" : "youth"
  })
  const [fontSize, setFontSize] = useState<FontSizeMode>(() => {
    if (typeof window === "undefined") return "md"
    const stored =
      window.localStorage.getItem(STORAGE_KEYS.fontSize) ||
      window.localStorage.getItem(`${initialConfig.appName}:fontSize`) ||
      window.localStorage.getItem("问兰 AI Portal:fontSize")
    return stored === "sm" || stored === "md" || stored === "lg" ? stored : "md"
  })
  const [copiedMessageId, setCopiedMessageId] = useState("")
  const [serverStatus, setServerStatus] = useState<ServerStatus>(initialServerStatus)

  const streamAnchorRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recorderStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const voiceFrameRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const voiceDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const userIdRef = useRef("browser")
  const [voiceLevel, setVoiceLevel] = useState(0)

  useEffect(() => {
    userIdRef.current = ensureUserId()
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const hasSeenGuide = window.localStorage.getItem(STORAGE_KEYS.onboardingGuideSeen)
        if (!hasSeenGuide) {
          setGuideModalOpen(true)
          window.localStorage.setItem(STORAGE_KEYS.onboardingGuideSeen, "1")
        }
      } catch {
        setGuideModalOpen(true)
      }
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (conversations.length > 0) {
      writeStoredJson(STORAGE_KEYS.conversations, conversations)
    }
  }, [conversations])

  useEffect(() => {
    if (activeConversationId) {
      writeStoredJson(STORAGE_KEYS.activeConversationId, activeConversationId)
    }
  }, [activeConversationId])

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
      const legacyConversations = readStoredJson<ChatConversation[]>(
        `${initialConfig.appName}:conversations`,
        readStoredJson<ChatConversation[]>("问兰 AI Portal:conversations", [])
      )
      const legacyActiveId = readStoredJson<string>(
        `${initialConfig.appName}:activeConversationId`,
        readStoredJson<string>("问兰 AI Portal:activeConversationId", "")
      )
      const storedConversations = readStoredJson<ChatConversation[]>(STORAGE_KEYS.conversations, legacyConversations)
      const storedActiveId = readStoredJson<string>(STORAGE_KEYS.activeConversationId, legacyActiveId)

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
    window.localStorage.setItem(STORAGE_KEYS.fontSize, fontSize)
  }, [fontSize])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.displayMode, displayMode)
  }, [displayMode])

  useEffect(() => {
    return () => {
      stopVoiceMeter()
      recorderStreamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) || conversations[0],
    [conversations, activeConversationId]
  )
  const sortedConversations = useMemo(() => sortConversations(conversations), [conversations])
  const activeMessages = activeConversation?.messages ?? []
  const hasMessages = activeMessages.length > 0
  const fontClasses = fontSizeStyles[fontSize]
  const layoutDensity = useLayoutDensity()

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
    setMobileSidebarOpen(false)
  }

  function selectConversation(conversationId: string) {
    setActiveConversationId(conversationId)
    setMobileSidebarOpen(false)
  }

  function deleteConversation(conversationId: string) {
    const remaining = conversations.filter((conversation) => conversation.id !== conversationId)
    if (remaining.length === 0) {
      const replacement = emptyConversation()
      setConversations([replacement])
      setActiveConversationId(replacement.id)
      setMobileSidebarOpen(false)
      return
    }

    setConversations(remaining)
    if (activeConversationId === conversationId) {
      const nextActive = sortConversations(remaining)[0]
      if (nextActive) {
        setActiveConversationId(nextActive.id)
      }
    }
    setMobileSidebarOpen(false)
  }

  function openGuideModal() {
    setGuideModalOpen(true)
    setMobileSidebarOpen(false)
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
        throw new Error((errorPayload as { error?: string }).error || "模型服务暂时不可用")
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

      updateMessage(conversationId, assistantMessageId, assistantText || "模型暂时没有返回正文。", "done")
      if (latestConversationId) {
        patchConversation(conversationId, (item) => ({
          ...item,
          difyConversationId: latestConversationId,
          updatedAt: new Date().toISOString(),
        }))
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "助手暂时无法回复"
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

  function changeDisplayMode(mode: DisplayMode) {
    setDisplayMode(mode)
    setFontSize(mode === "care" ? "lg" : "md")
  }

  function stopVoiceMeter() {
    if (voiceFrameRef.current !== null) {
      window.cancelAnimationFrame(voiceFrameRef.current)
      voiceFrameRef.current = null
    }
    analyserRef.current = null
    voiceDataRef.current = null
    setVoiceLevel(0)
    const audioContext = audioContextRef.current
    audioContextRef.current = null
    if (audioContext) {
      void audioContext.close().catch(() => {})
    }
  }

  function startVoiceMeter(stream: MediaStream) {
    stopVoiceMeter()
    const AudioContextClass =
      window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return

    const audioContext = new AudioContextClass()
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.72
    audioContext.createMediaStreamSource(stream).connect(analyser)

    audioContextRef.current = audioContext
    analyserRef.current = analyser
    voiceDataRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>

    const updateLevel = () => {
      const currentAnalyser = analyserRef.current
      const data = voiceDataRef.current
      if (!currentAnalyser || !data) return

      currentAnalyser.getByteTimeDomainData(data)
      let total = 0
      for (const value of data) {
        const normalized = (value - 128) / 128
        total += normalized * normalized
      }
      const rms = Math.sqrt(total / data.length)
      setVoiceLevel(Math.min(1, Math.max(0, rms * 5)))
      voiceFrameRef.current = window.requestAnimationFrame(updateLevel)
    }

    updateLevel()
  }

  async function toggleVoiceRecording() {
    if (isTranscribing || !serverStatus.transcribeReady) return
    if (isRecording) {
      recorderRef.current?.stop()
      recorderRef.current = null
      setIsRecording(false)
      stopVoiceMeter()
      recorderStreamRef.current?.getTracks().forEach((track) => track.stop())
      recorderStreamRef.current = null
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recorderStreamRef.current = stream
      startVoiceMeter(stream)
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
          stopVoiceMeter()
        }
      }

      recorder.start()
      setIsRecording(true)
    } catch {
      stopVoiceMeter()
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
      voiceLevel={voiceLevel}
      canTranscribe={serverStatus.transcribeReady}
      onChange={setDraft}
      onKeyDown={handleTextareaKeyDown}
      onSubmit={handleSubmit}
      onNewChat={startNewChat}
      onToggleVoice={toggleVoiceRecording}
      fontSizeClass={fontClasses.input}
      density={layoutDensity}
      fontSizeMode={fontSize}
    />
  )

  const sidebarBody = (
    <div className="flex h-full flex-col gap-3 px-3 pb-3 pt-1">
      <button
        className={`inline-flex items-center justify-center font-medium text-white transition hover:bg-[#2f2f2f] ${fontClasses.sidebarNewChatBtn}`}
        onClick={startNewChat}
        type="button"
      >
        <CircleDashed className={fontSize === "lg" ? "h-5 w-5" : "h-4 w-4"} />
        新对话
      </button>

      <button
        className={`inline-flex items-center justify-center font-medium text-[#222222] border border-black/[0.08] bg-white transition hover:bg-[#f7f7f7] ${fontClasses.sidebarGuideBtn}`}
        onClick={openGuideModal}
        type="button"
      >
        <Sparkles className={fontSize === "lg" ? "h-5 w-5" : "h-4 w-4"} />
        新手指导
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className={`px-2 pb-2 font-medium uppercase tracking-[0.18em] text-[#888888] ${fontClasses.sidebarHeading}`}>最近对话</div>
        <div className="space-y-1">
          {sortedConversations.map((conversation) => {
            const isActive = conversation.id === activeConversationId
            return (
              <div
                key={conversation.id}
                className={`group flex items-stretch gap-1 rounded-2xl border px-1 py-1 transition ${
                  isActive ? "border-white bg-white shadow-[0_1px_10px_rgba(0,0,0,0.05)]" : "border-transparent bg-transparent"
                }`}
              >
                <button
                  className={`min-w-0 flex-1 rounded-[1rem] text-left transition group-hover:bg-black/[0.02] ${fontClasses.sidebarItemBtn}`}
                  onClick={() => selectConversation(conversation.id)}
                  type="button"
                >
                  <div className={`truncate font-medium text-[#111111] ${fontClasses.sidebarItemTitle}`}>{conversation.title}</div>
                  <div className={`mt-1 truncate text-[#878787] ${fontClasses.sidebarItemDate}`}>{formatClock(conversation.updatedAt)}</div>
                </button>

                <button
                  className={`mt-1 inline-flex shrink-0 items-center justify-center rounded-full text-[#777777] opacity-100 transition hover:bg-red-50 hover:text-red-600 md:opacity-0 md:group-hover:opacity-100 ${
                    fontSize === "sm" ? "h-9 w-9" : fontSize === "md" ? "h-11 w-11" : "h-13 w-13"
                  }`}
                  onClick={() => deleteConversation(conversation.id)}
                  type="button"
                  aria-label={`删除对话：${conversation.title}`}
                >
                  <Trash2 className={fontSize === "lg" ? "h-5 w-5" : "h-4 w-4"} />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-auto border-t border-black/[0.05] pt-3 px-1 space-y-3 shrink-0">
        <div className="flex flex-col gap-1.5">
          <div className={`font-medium uppercase tracking-[0.12em] text-[#888888] px-1 ${fontClasses.sidebarHeading}`}>界面模式</div>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/[0.04] p-1">
            {displayModeOptions.map((option) => (
              <button
                key={option.value}
                className={`rounded-lg font-medium transition ${
                  option.value === displayMode
                    ? "bg-white text-[#111111] shadow-sm"
                    : "text-[#5f5f5f] hover:text-[#111111] hover:bg-black/[0.02]"
                } ${fontClasses.sidebarPrefBtn}`}
                onClick={() => changeDisplayMode(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className={`font-medium uppercase tracking-[0.12em] text-[#888888] px-1 ${fontClasses.sidebarHeading}`}>字体大小</div>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/[0.04] p-1">
            {fontSizeOptions.map((option) => (
              <button
                key={option.value}
                className={`rounded-lg font-medium transition ${
                  option.value === fontSize
                    ? "bg-white text-[#111111] shadow-sm"
                    : "text-[#5f5f5f] hover:text-[#111111] hover:bg-black/[0.02]"
                } ${fontClasses.sidebarPrefBtn}`}
                onClick={() => {
                  setFontSize(option.value)
                  setDisplayMode(option.value === "lg" ? "care" : "youth")
                }}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-dvh overflow-hidden bg-[#f6f6f4] text-[#0d0d0d]">
      <aside className={`hidden shrink-0 lg:block ${fontClasses.sidebarWidth}`}>
        <AppSidebar active="chat" sections={["chat"]} fontSizeMode={fontSize}>
          {sidebarBody}
        </AppSidebar>
      </aside>

      <MobileAppSidebar
        active="chat"
        sections={["chat"]}
        open={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        fontSizeMode={fontSize}
      >
        {sidebarBody}
      </MobileAppSidebar>

      <GuideModal open={guideModalOpen} onClose={() => setGuideModalOpen(false)} />

      <main className="flex min-w-0 flex-1 flex-col bg-[#f6f6f4]">
        <header className={`shrink-0 border-b border-black/[0.05] bg-white/[0.96] flex items-center ${fontClasses.headerHeight}`}>
          <div className="flex w-full items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                className={`inline-flex shrink-0 items-center justify-center rounded-full text-[#5b5b5b] transition hover:bg-[#f4f4f4] lg:hidden ${
                  fontSize === "sm" ? "h-10 w-10" : fontSize === "md" ? "h-11 w-11" : "h-13 w-13"
                }`}
                onClick={() => setMobileSidebarOpen(true)}
                type="button"
                aria-label="打开侧边菜单"
              >
                <Menu className={fontSize === "lg" ? "h-6 w-6" : "h-5 w-5"} />
              </button>

              <div className="min-w-0">
                <div className={`truncate font-semibold tracking-tight text-[#111] ${fontClasses.headerTitle}`}>
                  {hasMessages ? activeConversation?.title || "智能问答" : "问兰智能体"}
                </div>
                <div className={`truncate text-[#7a7a7a] ${fontClasses.headerSubtitle}`}>{initialConfig.headline}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 lg:hidden">
              <button
                className={`inline-flex items-center rounded-full bg-[#111111] text-white transition hover:bg-[#2f2f2f] ${fontClasses.headerNewChatBtn}`}
                onClick={startNewChat}
                type="button"
                aria-label="新对话"
              >
                <CircleDashed className={fontSize === "lg" ? "h-4.5 w-4.5" : "h-3.5 w-3.5"} />
                <span>新对话</span>
              </button>
            </div>

            <div className="hidden items-center gap-2 sm:gap-3 lg:flex">
              <div className="inline-flex items-center rounded-full bg-[#f2f2f2] p-1 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
                {displayModeOptions.map((option) => (
                  <button
                    key={option.value}
                    className={`rounded-full transition ${
                      fontSize === "sm"
                        ? "h-8 min-w-12 px-3 text-sm"
                        : fontSize === "md"
                          ? "h-10 min-w-16 px-4.5 text-[15px]"
                          : "h-12 min-w-20 px-6 text-[18px]"
                    } ${
                      option.value === displayMode ? "bg-white text-[#111] shadow-sm" : "text-[#666] hover:text-[#111]"
                    }`}
                    onClick={() => changeDisplayMode(option.value)}
                    type="button"
                    aria-label={`切换到${option.label}`}
                  >
                    <span className="sm:hidden">{option.value === "youth" ? "青年" : "关爱"}</span>
                    <span className="hidden sm:inline">{option.label}</span>
                  </button>
                ))}
              </div>
              <div className="inline-flex items-center rounded-full bg-[#f2f2f2] p-1 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
                {fontSizeOptions.map((option) => (
                  <button
                    key={option.value}
                    className={`rounded-full transition ${
                      fontSize === "sm"
                        ? "h-8 min-w-10 px-3 text-sm"
                        : fontSize === "md"
                          ? "h-10 min-w-14 px-4.5 text-[15px]"
                          : "h-12 min-w-18 px-5.5 text-[18px]"
                    } ${
                      option.value === fontSize ? "bg-white text-[#111] shadow-sm" : "text-[#666] hover:text-[#111]"
                    }`}
                    onClick={() => {
                      setFontSize(option.value)
                      setDisplayMode(option.value === "lg" ? "care" : "youth")
                    }}
                    type="button"
                    aria-label={`切换到${option.label}字号`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <button
                className={`inline-flex items-center rounded-full bg-[#111111] text-white transition hover:bg-[#2f2f2f] ${fontClasses.headerNewChatBtn}`}
                onClick={startNewChat}
                type="button"
              >
                <CircleDashed className={fontSize === "lg" ? "h-5 w-5" : "h-4 w-4"} />
                <span className="hidden sm:inline">新对话</span>
              </button>
            </div>
          </div>
        </header>

        {!hasMessages ? (
          <>
            <section className="hidden min-h-0 flex-1 items-start justify-center px-4 py-8 lg:flex">
              <EmptyState
                prompts={initialConfig.starterPrompts}
                composer={composer}
                onQuickPrompt={handleQuickPrompt}
                promptClass={fontClasses.prompt}
                fontSizeMode={fontSize}
              />
            </section>

            <section className="flex min-h-0 flex-1 flex-col overflow-hidden lg:hidden w-full">
              <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0 w-full">
                <div className="mx-auto w-full max-w-[600px] min-h-full flex flex-col justify-center items-stretch gap-6 sm:gap-8 py-4">
                  <WelcomePanel
                    framed={false}
                    fontSizeMode={fontSize}
                  />
                  <MobileQuickActions
                    onQuickPrompt={handleQuickPrompt}
                    fontSizeMode={fontSize}
                  />
                </div>
              </div>

              <div className="bg-[#f6f6f4] px-4 pb-4 pt-2 border-t border-black/[0.03] shrink-0 w-full">
                <div className="mx-auto w-full max-w-[600px]">
                  {composer}
                  <p className="mx-auto mt-2 text-center text-[0.65em] text-[#7d7d7d] leading-normal opacity-75 max-w-[600px]">
                    回答来自AI生成，请自行诊断真假
                  </p>
                </div>
              </div>
            </section>
          </>
        ) : (
          <section className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto]">
            <div className="min-h-0 overflow-y-auto px-2 sm:px-4">
              <div className={`mx-auto max-w-[600px] ${fontClasses.messageSpacing}`}>
                {activeMessages.map((message) => (
                  <MessageRow
                    key={message.id}
                    message={message}
                    onCopy={copyMessage}
                    copiedMessageId={copiedMessageId}
                    fontSizeClass={fontClasses.body}
                    fontSizeMode={fontSize}
                  />
                ))}
                <div ref={streamAnchorRef} />
              </div>
            </div>

            <div className="bg-white px-2 pb-4 pt-2 sm:px-4">
              {composer}
              <p className="mx-auto mt-2 text-center text-[0.65em] text-[#7d7d7d] leading-normal opacity-75 max-w-[600px]">
                回答来自AI生成，请自行诊断真假
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
  fontSizeMode?: FontSizeMode
}

function MessageRow({ message, copiedMessageId, onCopy, fontSizeClass, fontSizeMode = "md" }: MessageRowProps) {
  const isUser = message.role === "user"
  const isPending = message.status === "pending" && !message.content
  const fontClasses = fontSizeStyles[fontSizeMode]

  if (isUser) {
    return (
      <article className="flex justify-end">
        <div className={`text-[#0d0d0d] ${fontClasses.userBubble} ${fontSizeClass}`}>
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
          className={`mt-2 inline-flex items-center rounded-lg text-[#6f6f6f] opacity-100 transition hover:bg-[#f4f4f4] hover:text-[#171717] md:opacity-0 md:group-hover:opacity-100 ${fontClasses.copyBtn}`}
          onClick={() => onCopy(message.content, message.id)}
        >
          {copiedMessageId === message.id ? (
            <Check className={fontSizeMode === "lg" ? "h-5 w-5" : "h-4 w-4"} />
          ) : (
            <Copy className={fontSizeMode === "lg" ? "h-5 w-5" : "h-4 w-4"} />
          )}
          {copiedMessageId === message.id ? "已复制" : "复制"}
        </button>
      ) : null}
    </article>
  )
}

function WelcomePanel({
  framed = true,
  fontSizeMode = "md",
}: {
  framed?: boolean
  fontSizeMode?: FontSizeMode
}) {
  const fontClasses = fontSizeStyles[fontSizeMode]
  
  const titleStyle = fontClasses.title
  const copyStyle = fontClasses.meta
  const shellClass = fontClasses.welcomeShell
  const chipClass = fontClasses.welcomeFeatureChip
  const titleMargin = fontClasses.welcomeTitleMargin
  const copyMargin = fontClasses.welcomeCopyMargin
  const chipMargin = fontClasses.welcomeChipMargin
  const logoBoxClass = fontClasses.welcomeLogoBox
  const logoImgSize = fontClasses.welcomeLogoSize
  const subtitleChipClass = fontClasses.welcomeSubtitleChip

  const shellStyle = framed
    ? "border border-black/[0.08] bg-white shadow-[0_1px_12px_rgba(0,0,0,0.03)]"
    : "bg-transparent shadow-none"

  return (
    <section className={`w-full ${shellStyle} ${shellClass}`}>
      <div className="flex flex-col items-center justify-center gap-3">
        <div className={`flex items-center justify-center bg-white shadow-[0_4px_16px_rgba(0,0,0,0.05)] border border-black/[0.04] shrink-0 ${logoBoxClass}`}>
          <Image
            src="/wenlan-yizhantong.ico"
            alt="问兰"
            width={logoImgSize}
            height={logoImgSize}
            unoptimized
            className="h-full w-full rounded-md object-contain"
          />
        </div>
        <div className={`font-semibold uppercase tracking-[0.18em] text-[#8a8a8a] flex items-center ${subtitleChipClass}`}>
          <Sparkles className="h-[1.1em] w-[1.1em] text-amber-500 fill-amber-500 shrink-0" />
          问兰智能体
        </div>
      </div>

      <h1 className={`${titleMargin} text-center font-bold tracking-tight bg-gradient-to-r from-[#111111] via-[#484848] to-[#111111] bg-clip-text text-transparent ${titleStyle}`}>{launchTitle}</h1>

      <p className={`mx-auto ${copyMargin} max-w-2xl text-center text-[#555] ${copyStyle} leading-[1.65]`}>{emptyStateCopy}</p>

      <div className={`${chipMargin} flex flex-wrap justify-center gap-2 ${framed ? "" : "px-0"}`}>
        {launchFeatureLabels.map((label) => (
          <span key={label} className={chipClass}>
            {label}
          </span>
        ))}
      </div>
    </section>
  )
}

function EmptyState({
  prompts,
  composer,
  onQuickPrompt,
  promptClass,
  fontSizeMode = "md",
}: {
  prompts: string[]
  composer: ReactNode
  onQuickPrompt: (prompt: string) => void
  promptClass: string
  fontSizeMode?: FontSizeMode
}) {
  const promptBtnClass = fontSizeMode === "sm"
    ? "px-3 py-2"
    : fontSizeMode === "md"
      ? "px-4.5 py-2.5 text-[18px]"
      : "px-6 py-3.5 text-[22px]"

  return (
    <div className="w-full max-w-[600px]">
      <WelcomePanel fontSizeMode={fontSizeMode} />

      <div className="mt-7">{composer}</div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {prompts.slice(0, 4).map((prompt) => (
          <button
            key={prompt}
            className={`max-w-full rounded-full border border-[#e3e3e3] bg-white text-[#4f4f4f] transition hover:bg-[#f7f7f7] ${promptBtnClass} ${promptClass}`}
            onClick={() => onQuickPrompt(prompt)}
          >
            <span className="block max-w-[24rem] truncate">{prompt}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function UsageGuide({ compact = false }: { compact?: boolean }) {
  const content = (
    <div className={compact ? "grid gap-2" : "grid gap-3 sm:grid-cols-2"}>
      {onboardingGuide.map((step, index) => (
        <div
          key={step.title}
          className={`rounded-2xl border border-black/[0.08] bg-white px-4 py-3 shadow-[0_1px_12px_rgba(0,0,0,0.03)] ${
            compact ? "px-3 py-3" : ""
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#111111] text-[11px] font-semibold text-white">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-normal text-[#111111]">{step.title}</div>
              <p className="mt-1 text-sm leading-6 text-[#666666]">{step.description}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  if (compact) {
    return content
  }

  return (
    <section className="mt-7 rounded-[2rem] border border-black/[0.08] bg-white p-4 shadow-[0_1px_12px_rgba(0,0,0,0.03)] sm:p-5">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[#8a8a8a]">
        <Sparkles className="h-4 w-4" />
        初次使用引导
      </div>
      <div className="mt-4">{content}</div>
    </section>
  )
}

function GuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6">
      <button className="absolute inset-0 bg-black/35" onClick={onClose} type="button" aria-label="关闭新手指导" />

      <section className="relative max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-black/[0.08] bg-white p-5 text-[#111111] shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[#8a8a8a]">
              <Sparkles className="h-4 w-4" />
              新手指导
            </div>
            <h2 className="mt-2 text-[24px] font-semibold tracking-normal text-[#202020]">第一次使用可以这样开始</h2>
            <p className="mt-2 text-sm leading-6 text-[#666666]">
              前台只负责提问、找官方图片、复制宣传文案和语音输入；上传和删除资料请进入受保护的后台知识库。
            </p>
          </div>

          <button
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#666666] transition hover:bg-[#f4f4f4] hover:text-[#111111]"
            onClick={onClose}
            type="button"
            aria-label="关闭新手指导"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="mt-5">
          <UsageGuide compact />
        </div>

        <button
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#111111] px-4 text-sm font-medium text-white transition hover:bg-[#2f2f2f]"
          onClick={onClose}
          type="button"
        >
          我知道了
        </button>
      </section>
    </div>
  )
}

function Composer({
  draft,
  textareaRef,
  isSending,
  isRecording,
  isTranscribing,
  voiceLevel,
  canTranscribe,
  onChange,
  onKeyDown,
  onSubmit,
  onNewChat,
  onToggleVoice,
  fontSizeClass,
  density = "regular",
  fontSizeMode = "md",
}: {
  draft: string
  textareaRef: RefObject<HTMLTextAreaElement | null>
  isSending: boolean
  isRecording: boolean
  isTranscribing: boolean
  voiceLevel: number
  canTranscribe: boolean
  onChange: (value: string) => void
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  onSubmit: () => void
  onNewChat: () => void
  onToggleVoice: () => void
  fontSizeClass: string
  density?: LayoutDensity
  fontSizeMode?: FontSizeMode
}) {
  const canSend = draft.trim().length > 0 && !isSending && !isTranscribing
  const isCompact = density !== "regular"
  const placeholder = isTranscribing
    ? "正在识别语音..."
    : isCompact
      ? "输入问题，回车发送"
      : "输入问题、产品名或关键词，按回车发送"

  // Dynamic Scale Variables
  const btnSize = fontSizeMode === "sm"
    ? "h-[4.5rem] w-[4.5rem]"
    : fontSizeMode === "md"
      ? "h-20 w-20"
      : "h-25 w-25"
  const iconSize = fontSizeMode === "sm"
    ? "h-7.5 w-7.5"
    : fontSizeMode === "md"
      ? "h-[2.5rem] w-[2.5rem]"
      : "h-14 w-14"

  const containerPadding = fontSizeMode === "sm"
    ? "p-5 rounded-[2.8rem]"
    : fontSizeMode === "md"
      ? "p-7 rounded-[3.2rem]"
      : "p-9 rounded-[4rem]"
  const mobileContainerPadding = fontSizeMode === "sm"
    ? "px-3.5 py-2.5 rounded-2xl"
    : fontSizeMode === "md"
      ? "px-4.5 py-3 rounded-[1.4rem]"
      : "px-6 py-4 rounded-[1.8rem]"
  const textareaPadding = fontSizeMode === "sm"
    ? "px-6 py-5"
    : fontSizeMode === "md"
      ? "px-[1.8rem] py-[1.3rem]"
      : "px-9.5 py-6.5"
  const textareaMinHeight = fontSizeMode === "sm"
    ? "min-h-[4.5rem]"
    : fontSizeMode === "md"
      ? "min-h-20"
      : "min-h-24"

  // Mobile specific variables to make input "宽长" (wide and long)
  const mobileBtnSize = fontSizeMode === "sm"
    ? "h-11 w-11"
    : fontSizeMode === "md"
      ? "h-14 w-14"
      : "h-17 w-17"
  const mobileIconSize = fontSizeMode === "sm"
    ? "h-5.5 w-5.5"
    : fontSizeMode === "md"
      ? "h-7 w-7"
      : "h-8.5 w-8.5"
  const mobileTextareaMinHeight = fontSizeMode === "sm"
    ? "min-h-12"
    : fontSizeMode === "md"
      ? "min-h-14"
      : "min-h-17"

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const maxHeight = fontSizeMode === "sm"
      ? 195
      : fontSizeMode === "md"
        ? 260
        : 340
    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden"
  }, [draft, fontSizeMode, textareaRef])

  return (
    <div className="mx-auto w-full max-w-[600px]">
      <div className={`hidden border border-[#d9d9d9] bg-white shadow-[0_2px_16px_rgba(0,0,0,0.08)] lg:block ${containerPadding}`}>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={`max-h-48 w-full resize-none bg-transparent text-[#0d0d0d] outline-none placeholder:text-[#8f8f8f] ${textareaMinHeight} ${textareaPadding} ${fontSizeClass}`}
          rows={1}
        />

        <VoiceMeter isRecording={isRecording} isTranscribing={isTranscribing} voiceLevel={voiceLevel} />

        <div className="flex items-center justify-between px-1 pb-1">
          <button
            className={`inline-flex items-center justify-center rounded-full transition ${btnSize} ${
              isRecording
                ? "bg-[#d1242f] text-white"
                : "text-[#5f5f5f] hover:bg-[#f4f4f4] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
            }`}
            title={canTranscribe ? (isRecording ? "停止录音" : "语音输入") : "语音输入暂不可用"}
            onClick={onToggleVoice}
            disabled={!canTranscribe || isTranscribing}
            aria-label={isRecording ? "停止录音" : "语音输入"}
          >
            {isRecording ? <Square className={iconSize} /> : <Mic className={iconSize} />}
          </button>

          <button
            className={`inline-flex items-center justify-center rounded-full bg-[#111111] text-white transition hover:bg-[#303030] disabled:cursor-not-allowed disabled:bg-[#d7d7d7] disabled:text-white ${btnSize}`}
            onClick={() => void onSubmit()}
            disabled={!canSend}
            aria-label="发送"
          >
            {isSending ? <Loader2 className={`${iconSize} animate-spin`} /> : <ArrowUp className={iconSize} />}
          </button>
        </div>
      </div>

      <div className="lg:hidden">
        <div className={`border border-[#e0e0e0] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.08)] ${mobileContainerPadding}`}>
          <div className="flex items-end gap-2">
            <button
              className={`inline-flex shrink-0 items-center justify-center rounded-full text-[#1a1a1a] transition hover:bg-[#f4f4f4] ${mobileBtnSize}`}
              onClick={onNewChat}
              aria-label="新建对话"
              title="新建对话"
            >
              <Plus className={mobileIconSize} />
            </button>

            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              className={`flex-1 resize-none bg-transparent px-2 py-1 text-[#0d0d0d] outline-none placeholder:text-[#8f8f8f] placeholder:text-[0.8em] leading-normal ${mobileTextareaMinHeight} ${fontSizeClass}`}
              rows={1}
            />

            <button
              className={`inline-flex shrink-0 items-center justify-center rounded-full transition ${mobileBtnSize} ${
                isRecording
                  ? "bg-[#d1242f] text-white"
                  : "text-[#7a7a7a] hover:bg-[#f4f4f4] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
              }`}
              title={canTranscribe ? (isRecording ? "停止录音" : "语音输入") : "语音输入暂不可用"}
              onClick={onToggleVoice}
              disabled={!canTranscribe || isTranscribing}
              aria-label={isRecording ? "停止录音" : "语音输入"}
            >
              {isRecording ? <Square className={mobileIconSize} /> : <Mic className={mobileIconSize} />}
            </button>

            <button
              className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[#111111] text-white transition hover:bg-[#303030] disabled:cursor-not-allowed disabled:bg-[#d7d7d7] disabled:text-white ${mobileBtnSize}`}
              onClick={() => void onSubmit()}
              disabled={!canSend}
              aria-label="发送"
            >
              {isSending ? <Loader2 className={`${mobileIconSize} animate-spin`} /> : <ArrowUp className={mobileIconSize} />}
            </button>
          </div>
          <VoiceMeter isRecording={isRecording} isTranscribing={isTranscribing} voiceLevel={voiceLevel} compact />
        </div>
      </div>
    </div>
  )
}

function VoiceMeter({
  isRecording,
  isTranscribing,
  voiceLevel,
  compact = false,
}: {
  isRecording: boolean
  isTranscribing: boolean
  voiceLevel: number
  compact?: boolean
}) {
  if (!isRecording && !isTranscribing) return null

  const isSpeaking = voiceLevel > 0.05
  const bars = Array.from({ length: compact ? 8 : 12 }, (_, index) => {
    // If not speaking, keep it flat (height 6px, low opacity)
    if (!isSpeaking && !isTranscribing) {
      return { height: 6, opacity: 0.25 }
    }
    // If transcribing, keep it at a flat, medium height/opacity (e.g. 8px)
    if (isTranscribing) {
      return { height: compact ? 8 : 10, opacity: 0.4 }
    }
    // When speaking, show the dynamic wave
    const wave = 0.35 + Math.sin((voiceLevel * 12 + index) * 1.3) * 0.25
    const height = Math.max(6, Math.round((compact ? 14 : 22) * (wave + voiceLevel * 0.95)))
    const opacity = Math.max(0.3, 0.4 + voiceLevel * 0.6)
    return { height, opacity }
  })

  const statusText = isTranscribing ? "正在识别语音..." : voiceLevel > 0.08 ? "已检测到声音" : "正在录音，请开始说话"
  const helperText = isRecording ? "点击麦克风结束录音" : "录音结束后自动转写"
  const toneClass = isTranscribing ? "text-amber-800" : isRecording ? "text-rose-700" : "text-[#666]"
  const dotClass = isTranscribing ? "bg-amber-500" : voiceLevel > 0.08 || isRecording ? "bg-rose-500" : "bg-[#111111]"
  const containerClass = isTranscribing
    ? "border-amber-200 bg-amber-50/70"
    : isRecording
      ? "border-rose-200 bg-rose-50/70"
      : "border-black/[0.06] bg-[#fafafa]"
  const barClass = isTranscribing ? "bg-amber-500" : isRecording ? "bg-rose-500" : "bg-[#111111]"

  return (
    <div className={`px-3 ${compact ? "pb-2 pt-1" : "pb-3 pt-2"}`} aria-live="polite">
      <div className={`rounded-2xl border px-3 py-2.5 ${containerClass}`}>
        <div className="flex items-center justify-between gap-3">
          <div className={`flex items-center gap-2 text-xs font-medium ${toneClass}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${dotClass} ${isRecording || isTranscribing ? "animate-pulse" : ""}`} />
            <span>{statusText}</span>
          </div>
          <span className={`text-[11px] ${isTranscribing ? "text-amber-800/80" : isRecording ? "text-rose-700/80" : "text-[#8a8a8a]"}`}>
            {helperText}
          </span>
        </div>

        <div className="mt-3 flex h-9 items-end gap-1.5">
          {bars.map((bar, index) => (
            <span
              key={index}
              className={`w-1.5 rounded-full transition-all duration-150 ${barClass}`}
              style={{
                height: `${bar.height}px`,
                opacity: bar.opacity,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function MobileQuickActions({
  onQuickPrompt,
  fontSizeMode = "md",
}: {
  onQuickPrompt: (prompt: string) => void
  fontSizeMode?: FontSizeMode
}) {
  const fontClasses = fontSizeStyles[fontSizeMode]
  return (
    <div className={`w-full ${fontClasses.qaSpacing}`}>
      {mobileShortcuts.map(({ icon: Icon, label, prompt }) => (
        <button
          key={label}
          className={`flex w-full items-center text-left transition bg-white border border-black/[0.06] shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:bg-[#fafafa] hover:border-black/[0.1] active:scale-[0.99] active:shadow-[0_1px_4px_rgba(0,0,0,0.02)] ${fontClasses.qaPadding}`}
          onClick={() => onQuickPrompt(prompt)}
          type="button"
        >
          <span
            className={`flex shrink-0 items-center justify-center bg-[#f4f4f4] text-[#111111] ${fontClasses.qaIconBox}`}
          >
            <Icon className={fontClasses.qaIcon} />
          </span>
          <div className="min-w-0 flex-1 ml-0.5">
            <span className={`block font-semibold tracking-tight text-[#111111] ${fontClasses.qaTitle}`}>
              {label}
            </span>
            <span className={`block truncate font-normal text-[#777777] ${fontClasses.qaSubtitle}`}>
              {prompt}
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}
