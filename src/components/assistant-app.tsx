"use client"

/* eslint-disable @next/next/no-img-element */

import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowUp,
  Check,
  CircleDashed,
  Copy,
  Loader2,
  Menu,
  Mic,
  Phone,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"

import { AppSidebar, MobileAppSidebar } from "@/components/app-sidebar"
import { BrandMark } from "@/components/brand-mark"
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
import type { ChatAttachment, ChatConversation, ChatMessage, PortalConfig, ServerStatus } from "@/types/chat"

type AssistantAppProps = {
  initialConfig: PortalConfig
}

type StreamEvent = {
  event?: string
  answer?: string
  conversation_id?: string
  files?: unknown[]
  attachments?: unknown[]
  message_files?: unknown[]
  images?: unknown[]
  data?: unknown
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

const centerActions: Array<{
  icon: typeof Search
  title: string
  description: string
  prompt: string
}> = [
  {
    icon: Search,
    title: "素材中心",
    description: "官方图片、朋友圈文案、社群文案",
    prompt: "进入素材中心，请根据后台最新资料，帮我查找官方图片素材和可直接复制的宣传文案。",
  },
  {
    icon: Phone,
    title: "商务中心",
    description: "联系方式、合作咨询、对接流程",
    prompt: "进入商务中心，请根据后台最新资料，告诉我最新联系方式、联系人和合作流程。",
  },
]

const launchTitle = "今天你“问”了吗？"

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

function sanitizeAssistantReply(text: string) {
  let cleaned = text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\/?think>/gi, "")
    .trim()

  const cutMarkers = [
    "如果您还有其他问题",
    "欢迎继续提问",
    "建议联系后台补充上传",
    "如需更详细的信息",
    "如需更详尽的信息",
  ]

  let cutIndex = -1
  for (const marker of cutMarkers) {
    const markerIndex = cleaned.indexOf(marker)
    if (markerIndex !== -1 && (cutIndex === -1 || markerIndex < cutIndex)) {
      cutIndex = markerIndex
    }
  }

  if (cutIndex !== -1) {
    cleaned = cleaned.slice(0, cutIndex).trim()
  }

  const fallbackPatterns = [
    /后台没有/,
    /资料库没有/,
    /当前资料未覆盖/,
    /资料未覆盖/,
    /没有搜索到/,
    /没有检索到/,
    /未单独列出/,
  ]

  if (fallbackPatterns.some((pattern) => pattern.test(cleaned))) {
    return "你可以提问的再具体一些，便于我回答。\n\n我们品牌方会尽快明确政策，给您答复反馈。"
  }

  return cleaned.replace(/[。！？,，、；;：:\s]+$/g, "").trim()
}

function isImageUrl(value: string) {
  return value.startsWith("data:image/") || /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?.*)?$/i.test(value)
}

function normalizeAttachment(candidate: unknown, fallbackKind?: ChatAttachment["kind"]): ChatAttachment | null {
  if (!candidate) return null
  if (typeof candidate === "string") {
    const url = candidate.trim()
    if (!url) return null
    return {
      url,
      kind: fallbackKind || (isImageUrl(url) ? "image" : "file"),
    }
  }
  if (typeof candidate !== "object") return null

  const record = candidate as Record<string, unknown>
  const id = typeof record.id === "string" ? record.id.trim() : ""
  const fileId =
    typeof record.file_id === "string"
      ? record.file_id.trim()
      : typeof record.fileId === "string"
        ? record.fileId.trim()
        : id
  const rawUrl =
    typeof record.url === "string"
      ? record.url.trim()
      : typeof record.preview_url === "string"
        ? record.preview_url.trim()
        : typeof record.previewUrl === "string"
          ? record.previewUrl.trim()
          : typeof record.source_url === "string"
            ? record.source_url.trim()
            : typeof record.sourceUrl === "string"
              ? record.sourceUrl.trim()
              : typeof record.original_url === "string"
                ? record.original_url.trim()
                : typeof record.originalUrl === "string"
                  ? record.originalUrl.trim()
                  : ""
  const mimeType =
    typeof record.mime_type === "string"
      ? record.mime_type.trim()
      : typeof record.mimeType === "string"
        ? record.mimeType.trim()
        : ""
  const name =
    typeof record.name === "string"
      ? record.name.trim()
      : typeof record.filename === "string"
        ? record.filename.trim()
        : typeof record.file_name === "string"
          ? record.file_name.trim()
          : ""
  const alt =
    typeof record.alt === "string"
      ? record.alt.trim()
      : typeof record.text === "string"
        ? record.text.trim()
        : name

  const url = rawUrl || (fileId ? `/api/files/${encodeURIComponent(fileId)}/preview` : "")
  if (!url) return null

  const kind =
    typeof record.kind === "string"
      ? record.kind === "image"
        ? "image"
        : "file"
      : fallbackKind
        ? fallbackKind
      : mimeType.startsWith("image/") || isImageUrl(url)
        ? "image"
        : "file"

  return {
    id: id || fileId || undefined,
    name: name || undefined,
    url,
    kind,
    mimeType: mimeType || undefined,
    alt: alt || undefined,
  }
}

function mergeAttachments(existing: ChatAttachment[], incoming: ChatAttachment[]) {
  const map = new Map<string, ChatAttachment>()
  for (const attachment of existing) {
    map.set(`${attachment.kind}:${attachment.url}`, attachment)
  }
  for (const attachment of incoming) {
    map.set(`${attachment.kind}:${attachment.url}`, attachment)
  }
  return Array.from(map.values())
}

function extractAttachmentsFromPayload(payload: StreamEvent) {
  const source: Array<{ value: unknown; kind?: ChatAttachment["kind"] }> = []

  if (Array.isArray(payload.files)) source.push(...payload.files.map((value) => ({ value })))
  if (Array.isArray(payload.attachments)) source.push(...payload.attachments.map((value) => ({ value })))
  if (Array.isArray(payload.message_files)) source.push(...payload.message_files.map((value) => ({ value })))
  if (Array.isArray(payload.images)) source.push(...payload.images.map((value) => ({ value, kind: "image" as const })))

  const nested = payload.data
  if (nested && typeof nested === "object") {
    const nestedRecord = nested as Record<string, unknown>
    if (Array.isArray(nestedRecord.files)) source.push(...nestedRecord.files.map((value) => ({ value })))
    if (Array.isArray(nestedRecord.attachments)) source.push(...nestedRecord.attachments.map((value) => ({ value })))
    if (Array.isArray(nestedRecord.message_files)) source.push(...nestedRecord.message_files.map((value) => ({ value })))
    if (Array.isArray(nestedRecord.images)) source.push(...nestedRecord.images.map((value) => ({ value, kind: "image" as const })))
  }

  return source
    .map((item) => normalizeAttachment(item.value, item.kind))
    .filter((item): item is ChatAttachment => Boolean(item))
}

function scrollElementIntoView(ref: RefObject<HTMLDivElement | null>) {
  requestAnimationFrame(() => {
    ref.current?.scrollIntoView({ block: "end", behavior: "smooth" })
  })
}

type FontSizeMode = "sm" | "md" | "lg"
type DisplayMode = "fashion" | "efficiency"
type LayoutDensity = "regular" | "compact" | "tight"

const displayModeOptions: Array<{ value: DisplayMode; label: string }> = [
  { value: "fashion", label: "时尚版" },
  { value: "efficiency", label: "效率版" },
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
    body: "text-[clamp(14.5px,3.8vw,22px)] leading-relaxed",
    title: "text-[clamp(20px,5.5vw,36px)]",
    prompt: "text-[clamp(13px,3.2vw,18px)]",
    input: "text-[clamp(14px,3.5vw,20px)]",
    meta: "text-[clamp(11.5px,2.8vw,15px)]",
    headerHeight: "h-14 sm:h-16",
    headerTitle: "text-[clamp(14.5px,3.7vw,17px)]",
    headerSubtitle: "text-[clamp(10px,2.6vw,12px)]",
    headerNewChatBtn: "h-9 px-3 text-[11px] gap-1.5",
    sidebarWidth: "w-[16rem]",
    sidebarNewChatBtn: "h-10 text-[14px] gap-2 rounded-xl",
    sidebarGuideBtn: "h-9.5 text-[13.5px] gap-2 rounded-xl",
    sidebarHeading: "text-[11px]",
    sidebarItemTitle: "text-[13.5px]",
    sidebarItemDate: "text-[11px]",
    sidebarItemBtn: "px-3.5 py-2.5",
    sidebarPrefBtn: "h-8 text-[12px] rounded-lg",
    messageSpacing: "space-y-4 py-4 pb-10",
    userBubble: "px-3 py-2 rounded-xl max-w-[84%] bg-[#f1e4d5] border border-[#dcc6ae]/60",
    copyBtn: "h-8 px-2.5 text-[11px] gap-1.5",
    welcomeShell: "px-4 py-4",
    welcomeLogoBox: "h-12 w-12 rounded-xl p-1.5",
    welcomeLogoSize: 44,
    welcomeSubtitleChip: "text-[11.5px] gap-1.5 mt-2",
    welcomeTitleMargin: "mt-3",
    welcomeCopyMargin: "mt-2.5",
    welcomeChipMargin: "mt-4",
    welcomeFeatureChip: "rounded-full border border-[#dfe7f2] bg-[#fbfdff] px-3 py-1 text-[11.5px] font-medium text-[#5d6878]",
    qaSpacing: "space-y-2",
    qaPadding: "gap-3 rounded-xl p-3",
    qaIconBox: "h-9 w-9 rounded-lg",
    qaIcon: "h-4.5 w-4.5",
    qaTitle: "text-[13.5px]",
    qaSubtitle: "text-[11.5px] mt-0.5",
  },
  md: {
    body: "text-[clamp(16px,4.2vw,26px)] leading-relaxed",
    title: "text-[clamp(24px,6.5vw,44px)]",
    prompt: "text-[clamp(14px,3.6vw,20px)]",
    input: "text-[clamp(15px,3.8vw,22px)]",
    meta: "text-[clamp(12px,3vw,16px)]",
    headerHeight: "h-15 sm:h-18",
    headerTitle: "text-[clamp(15.5px,4vw,19px)]",
    headerSubtitle: "text-[clamp(10.5px,2.8vw,13px)]",
    headerNewChatBtn: "h-9 px-3.5 text-[12px] gap-1.5",
    sidebarWidth: "w-[18rem]",
    sidebarNewChatBtn: "h-11.5 text-[15.5px] gap-2 rounded-2xl",
    sidebarGuideBtn: "h-11 text-[15px] gap-2 rounded-2xl",
    sidebarHeading: "text-[12px]",
    sidebarItemTitle: "text-[14.5px]",
    sidebarItemDate: "text-[11.5px]",
    sidebarItemBtn: "px-4 py-3",
    sidebarPrefBtn: "h-9 text-[13.5px] rounded-xl",
    messageSpacing: "space-y-5.5 py-5 pb-12",
    userBubble: "px-4 py-2.5 rounded-2xl max-w-[84%] bg-[#f1e4d5] border border-[#dcc6ae]/60",
    copyBtn: "h-9 px-3 text-[12.5px] gap-2",
    welcomeShell: "px-4 py-3",
    welcomeLogoBox: "h-13 w-13 rounded-2xl p-1.5",
    welcomeLogoSize: 48,
    welcomeSubtitleChip: "text-[12.5px] gap-1.5 mt-2",
    welcomeTitleMargin: "mt-3",
    welcomeCopyMargin: "mt-2",
    welcomeChipMargin: "mt-4",
    welcomeFeatureChip: "rounded-full border border-[#dfe7f2] bg-[#fbfdff] px-3.5 py-1.5 text-[13px] font-medium text-[#5d6878]",
    qaSpacing: "space-y-2",
    qaPadding: "gap-3 rounded-2xl p-3",
    qaIconBox: "h-10 w-10 rounded-xl",
    qaIcon: "h-5 w-5",
    qaTitle: "text-[14.5px]",
    qaSubtitle: "text-[12.5px] mt-1",
  },
  lg: {
    body: "text-[clamp(18.5px,4.8vw,32px)] leading-relaxed",
    title: "text-[clamp(28px,7.5vw,52px)]",
    prompt: "text-[clamp(16px,4.2vw,24px)]",
    input: "text-[clamp(17px,4.4vw,26px)]",
    meta: "text-[clamp(13px,3.4vw,18px)]",
    headerHeight: "h-18 sm:h-20",
    headerTitle: "text-[clamp(16.5px,4.3vw,21px)]",
    headerSubtitle: "text-[clamp(12px,3vw,14px)]",
    headerNewChatBtn: "h-10 px-4 text-[13px] gap-2",
    sidebarWidth: "w-[21rem]",
    sidebarNewChatBtn: "h-13 text-[17px] gap-2.5 rounded-2xl",
    sidebarGuideBtn: "h-12 text-[16.5px] gap-2.5 rounded-2xl",
    sidebarHeading: "text-[14px]",
    sidebarItemTitle: "text-[16px]",
    sidebarItemDate: "text-[12.5px]",
    sidebarItemBtn: "px-5 py-4",
    sidebarPrefBtn: "h-10 text-[15px] rounded-xl",
    messageSpacing: "space-y-7 py-6 pb-14",
    userBubble: "px-5 py-3 rounded-2xl max-w-[84%] bg-[#f1e4d5] border border-[#dcc6ae]/60",
    copyBtn: "h-10 px-3.5 text-[14px] gap-2.5",
    welcomeShell: "px-6 py-6",
    welcomeLogoBox: "h-18 w-18 rounded-2xl p-2.5",
    welcomeLogoSize: 72,
    welcomeSubtitleChip: "text-[14.5px] gap-2 mt-3",
    welcomeTitleMargin: "mt-5",
    welcomeCopyMargin: "mt-4",
    welcomeChipMargin: "mt-6",
    welcomeFeatureChip: "rounded-full border border-[#dfe7f2] bg-[#fbfdff] px-4 py-2 text-[14.5px] font-medium text-[#5d6878]",
    qaSpacing: "space-y-3.5",
    qaPadding: "gap-4 rounded-2xl p-4",
    qaIconBox: "h-12.5 w-12.5 rounded-xl",
    qaIcon: "h-6 w-6",
    qaTitle: "text-[16px]",
    qaSubtitle: "text-[13.5px] mt-1.5",
  },
}

const desktopBaseStyles = {
  body: "text-[15px] leading-7",
  title: "text-[2.35rem] leading-tight",
  prompt: "text-[14px]",
  input: "text-[15px]",
  meta: "text-[12px]",
  headerHeight: "h-16",
  headerTitle: "text-[17px]",
  headerSubtitle: "text-xs",
  headerNewChatBtn: "h-10 px-4 text-sm gap-2",
  sidebarWidth: "w-[18rem]",
  sidebarNewChatBtn: "h-11 text-sm gap-2 rounded-2xl",
  sidebarGuideBtn: "h-10 text-sm gap-2 rounded-2xl",
  sidebarHeading: "text-xs",
  sidebarItemTitle: "text-sm",
  sidebarItemDate: "text-xs",
  sidebarItemBtn: "px-3 py-2",
  sidebarPrefBtn: "h-8 text-xs rounded-lg",
  messageSpacing: "space-y-7 py-6 pb-10",
  userBubble: "px-5 py-3 rounded-[1.35rem] max-w-[75%] bg-[#f1e4d5]",
  copyBtn: "h-8 px-2 text-xs gap-1.5",
  welcomeShell: "rounded-[2rem] px-5 py-5 sm:px-6 sm:py-6",
  welcomeLogoBox: "h-12 w-12 rounded-xl p-1.5",
  welcomeLogoSize: 44,
  welcomeSubtitleChip: "text-xs gap-2 mt-2.5",
  welcomeTitleMargin: "mt-3",
  welcomeCopyMargin: "mt-3",
  welcomeChipMargin: "mt-4",
  welcomeFeatureChip: "rounded-full border border-[#dfe7f2] bg-[#fbfdff] px-3 py-1.5 text-xs font-medium text-[#5d6878]",
  qaSpacing: "space-y-2",
  qaPadding: "gap-4 rounded-2xl px-1 py-3",
  qaIconBox: "h-11 w-11 rounded-2xl",
  qaIcon: "h-5 w-5",
  qaTitle: "text-[14.5px]",
  qaSubtitle: "text-[12px] mt-1",
} satisfies (typeof fontSizeStyles)["md"]

const desktopFontSizeStyles: typeof fontSizeStyles = {
  sm: desktopBaseStyles,
  md: desktopBaseStyles,
  lg: desktopBaseStyles,
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
    if (typeof window === "undefined") return "fashion"
    const stored = window.localStorage.getItem(STORAGE_KEYS.displayMode)
    if (stored === "fashion" || stored === "efficiency") return stored
    if (stored === "care") return "efficiency"
    if (stored === "youth") return "fashion"
    const legacyFontSize =
      window.localStorage.getItem(STORAGE_KEYS.fontSize) ||
      window.localStorage.getItem("问兰 AI Portal:fontSize") ||
      "md"
    return legacyFontSize === "lg" ? "efficiency" : "fashion"
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

  const desktopStreamAnchorRef = useRef<HTMLDivElement | null>(null)
  const mobileStreamAnchorRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recorderStreamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const voiceFrameRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const voiceDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const voicePressActiveRef = useRef(false)
  const voiceStartPendingRef = useRef(false)
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
    scrollElementIntoView(desktopStreamAnchorRef)
    scrollElementIntoView(mobileStreamAnchorRef)
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
  const mobileFontClasses = fontSizeStyles[fontSize]
  const desktopFontSize: FontSizeMode = "md"
  const desktopFontClasses = desktopFontSizeStyles[desktopFontSize]
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

  function updateMessage(
    conversationId: string,
    messageId: string,
    nextContent: string,
    status?: ChatMessage["status"],
    attachments?: ChatAttachment[]
  ) {
    patchConversation(conversationId, (conversation) => ({
      ...conversation,
      messages: conversation.messages.map((message) =>
        message.id === messageId
          ? {
              ...message,
              content: nextContent,
              status,
              attachments: attachments ?? message.attachments,
            }
          : message
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
      attachments: [],
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
      let assistantAttachments: ChatAttachment[] = []
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
            const incomingAttachments = extractAttachmentsFromPayload(payload)
            if (incomingAttachments.length > 0) {
              assistantAttachments = mergeAttachments(assistantAttachments, incomingAttachments)
            }
            if (typeof payload.answer === "string" && payload.answer) {
              assistantText += payload.answer
              updateMessage(
                conversationId,
                assistantMessageId,
                sanitizeAssistantReply(assistantText),
                "pending",
                assistantAttachments
              )
            } else if ((payload.event === "message_end" || parsed.event === "message_end") && (assistantText || assistantAttachments.length > 0)) {
              updateMessage(
                conversationId,
                assistantMessageId,
                sanitizeAssistantReply(assistantText),
                "done",
                assistantAttachments
              )
            }
          }
          delimiterIndex = buffer.indexOf("\n\n")
        }
      }

      updateMessage(
        conversationId,
        assistantMessageId,
        sanitizeAssistantReply(assistantText) ||
          (assistantAttachments.length > 0 ? "" : "你可以提问的再具体一些，便于我回答。"),
        "done",
        assistantAttachments
      )
      if (latestConversationId) {
        patchConversation(conversationId, (item) => ({
          ...item,
          difyConversationId: latestConversationId,
          updatedAt: new Date().toISOString(),
        }))
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "助手暂时无法回复"
      updateMessage(conversationId, assistantMessageId, message, "error", [])
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
    setFontSize(mode === "efficiency" ? "lg" : "md")
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

  function stopVoiceRecording() {
    voicePressActiveRef.current = false
    if (!isRecording && !voiceStartPendingRef.current) return
    voiceStartPendingRef.current = false

    const recorder = recorderRef.current
    recorderRef.current = null
    setIsRecording(false)
    stopVoiceMeter()
    recorderStreamRef.current?.getTracks().forEach((track) => track.stop())
    recorderStreamRef.current = null

    recorder?.stop()
  }

  async function startVoiceRecording() {
    if (isTranscribing || !serverStatus.transcribeReady || isRecording || voiceStartPendingRef.current) return
    voicePressActiveRef.current = true
    voiceStartPendingRef.current = true
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!voicePressActiveRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
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
      voicePressActiveRef.current = false
      stopVoiceMeter()
      // Permission denial is handled by the browser prompt.
    } finally {
      voiceStartPendingRef.current = false
    }
  }

  function handleVoicePressStart(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!serverStatus.transcribeReady || isTranscribing || isRecording || voiceStartPendingRef.current) return
    event.preventDefault()
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Ignore capture issues on browsers that do not support it cleanly.
    }
    void startVoiceRecording()
  }

  function handleVoicePressEnd(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch {
      // Ignore capture issues.
    }
    stopVoiceRecording()
  }

  function handleVoiceKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== " " && event.key !== "Enter") return
    if (event.repeat) return
    event.preventDefault()
    void startVoiceRecording()
  }

  function handleVoiceKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== " " && event.key !== "Enter") return
    event.preventDefault()
    stopVoiceRecording()
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
      onVoicePressStart={handleVoicePressStart}
      onVoicePressEnd={handleVoicePressEnd}
      onVoiceKeyDown={handleVoiceKeyDown}
      onVoiceKeyUp={handleVoiceKeyUp}
      desktopFontSizeClass={desktopFontClasses.input}
      mobileFontSizeClass={mobileFontClasses.input}
      density={layoutDensity}
      mobileFontSizeMode={fontSize}
    />
  )

  function renderSidebarBody(
    uiClasses: (typeof fontSizeStyles)["md"],
    uiFontSize: FontSizeMode,
    showPreferences: boolean
  ) {
    return (
    <div className="flex h-full flex-col gap-3 px-3 pb-3 pt-1">
      <button
        className={`inline-flex items-center justify-center border border-[#e6dccb] bg-white font-medium text-[#1a1410] transition hover:bg-[#fbf8f3] ${uiClasses.sidebarGuideBtn}`}
        onClick={openGuideModal}
        type="button"
      >
        <Sparkles className={uiFontSize === "lg" ? "h-5 w-5" : "h-4 w-4"} />
        新手指导
      </button>

      <div className="space-y-1">
        <div className={`px-2 pb-1 font-medium uppercase tracking-[0.18em] text-[#8c8276] ${uiClasses.sidebarHeading}`}>功能入口</div>
        <div className="space-y-1.5">
          {centerActions.map(({ icon: Icon, title, description, prompt }) => (
            <button
              key={title}
              className={`flex w-full items-center gap-3 rounded-2xl border border-[#e6dccb] bg-white text-left transition hover:border-[#d6c5ad] hover:bg-[#fbf8f3] ${uiClasses.sidebarItemBtn}`}
              onClick={() => {
                setMobileSidebarOpen(false)
                void handleQuickPrompt(prompt)
              }}
              type="button"
            >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1a1410] text-[#c9a87a]">
                <Icon className={uiFontSize === "lg" ? "h-5 w-5" : "h-4 w-4"} />
              </span>
              <span className="min-w-0">
                <span className={`block truncate font-semibold text-[#1a1410] ${uiClasses.sidebarItemTitle}`}>{title}</span>
                <span className={`mt-0.5 block truncate text-[#8c8276] ${uiClasses.sidebarItemDate}`}>{description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className={`px-2 pb-2 font-medium uppercase tracking-[0.18em] text-[#8c8276] ${uiClasses.sidebarHeading}`}>最近对话</div>
        <div className="space-y-1">
          {sortedConversations.map((conversation) => {
            const isActive = conversation.id === activeConversationId
            return (
              <div
                key={conversation.id}
                className={`group flex items-stretch gap-1 rounded-2xl border px-1 py-1 transition ${
                  isActive ? "border-[#e6dccb] bg-white shadow-[0_1px_10px_rgba(26,20,16,0.05)]" : "border-transparent bg-transparent"
                }`}
              >
                <button
                  className={`min-w-0 flex-1 rounded-[1rem] text-left transition group-hover:bg-black/[0.02] ${uiClasses.sidebarItemBtn}`}
                  onClick={() => selectConversation(conversation.id)}
                  type="button"
                >
                  <div className={`truncate font-medium text-[#1a1410] ${uiClasses.sidebarItemTitle}`}>{conversation.title}</div>
                  <div className={`mt-1 truncate text-[#8c8276] ${uiClasses.sidebarItemDate}`}>{formatClock(conversation.updatedAt)}</div>
                </button>

                <button
                  className={`mt-1 inline-flex shrink-0 items-center justify-center rounded-full text-[#8190a3] opacity-100 transition hover:bg-red-50 hover:text-red-600 md:opacity-0 md:group-hover:opacity-100 ${
                    uiFontSize === "sm" ? "h-9 w-9" : uiFontSize === "md" ? "h-11 w-11" : "h-13 w-13"
                  }`}
                  onClick={() => deleteConversation(conversation.id)}
                  type="button"
                  aria-label={`删除对话：${conversation.title}`}
                >
                  <Trash2 className={uiFontSize === "lg" ? "h-5 w-5" : "h-4 w-4"} />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-auto shrink-0 space-y-3 border-t border-black/[0.05] px-1 pt-3">
        <button
          className={`inline-flex w-full items-center justify-center bg-[#1a1410] font-medium text-[#f7f3ec] transition hover:bg-[#332922] ${uiClasses.sidebarNewChatBtn}`}
          onClick={startNewChat}
          type="button"
        >
          <CircleDashed className={uiFontSize === "lg" ? "h-5 w-5" : "h-4 w-4"} />
          新对话
        </button>

        {showPreferences ? (
          <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/[0.04] p-1">
            {displayModeOptions.map((option) => (
              <button
                key={option.value}
                className={`rounded-lg font-medium transition ${
                  option.value === displayMode
                    ? "bg-white text-[#1a1410] shadow-sm"
                    : "text-[#5f5f5f] hover:text-[#1a1410] hover:bg-black/[0.02]"
                } ${uiClasses.sidebarPrefBtn}`}
                  onClick={() => changeDisplayMode(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
  }

  const desktopSidebarBody = renderSidebarBody(desktopFontClasses, desktopFontSize, false)
  const mobileSidebarBody = renderSidebarBody(mobileFontClasses, fontSize, true)

  return (
    <div className="flex h-dvh overflow-hidden bg-[#f7f3ec] text-[#1a1410]">
      <aside className={`hidden shrink-0 lg:block ${desktopFontClasses.sidebarWidth}`}>
        <AppSidebar active="chat" sections={[]} fontSizeMode={desktopFontSize}>
          {desktopSidebarBody}
        </AppSidebar>
      </aside>

      <MobileAppSidebar
        active="chat"
        sections={[]}
        open={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        fontSizeMode={fontSize}
      >
        {mobileSidebarBody}
      </MobileAppSidebar>

      <GuideModal open={guideModalOpen} onClose={() => setGuideModalOpen(false)} />

      <main className="flex min-w-0 flex-1 flex-col bg-[#f7f3ec]">
        <header className="shrink-0 border-b border-[#e6dccb] bg-white/[0.94]">
          <div className={`mx-auto flex w-full max-w-[430px] items-center justify-between px-4 lg:hidden ${mobileFontClasses.headerHeight}`}>
            <div className="flex min-w-0 flex-1 items-center gap-3 pr-2">
              <button
                className={`inline-flex shrink-0 items-center justify-center rounded-full text-[#8c8276] transition hover:bg-[#f4eee5] lg:hidden ${
                  fontSize === "sm" ? "h-10 w-10" : fontSize === "md" ? "h-11 w-11" : "h-13 w-13"
                }`}
                onClick={() => setMobileSidebarOpen(true)}
                type="button"
                aria-label="打开侧边菜单"
              >
                <Menu className={fontSize === "lg" ? "h-6 w-6" : "h-5 w-5"} />
              </button>

              <div className="min-w-0">
                <div className={`truncate font-serif font-semibold tracking-[0.02em] text-[#1a1410] ${mobileFontClasses.headerTitle}`}>
                  {hasMessages ? activeConversation?.title || "智能问答" : "问兰智能体系统"}
                </div>
                <div className={`truncate text-[#8c8276] ${mobileFontClasses.headerSubtitle}`}>{initialConfig.headline}</div>
              </div>
            </div>

            <div className="flex shrink-0 items-center">
              <button
                className={`inline-flex items-center rounded-full bg-[#1a1410] text-[#f7f3ec] transition hover:bg-[#332922] ${mobileFontClasses.headerNewChatBtn}`}
                onClick={startNewChat}
                type="button"
                aria-label="新对话"
              >
                <CircleDashed className={fontSize === "lg" ? "h-4.5 w-4.5" : "h-3.5 w-3.5"} />
                <span>新对话</span>
              </button>
            </div>
          </div>

          <div className={`hidden w-full items-center justify-between px-8 lg:flex ${desktopFontClasses.headerHeight}`}>
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0">
                <div className={`truncate font-serif font-semibold tracking-[0.02em] text-[#1a1410] ${desktopFontClasses.headerTitle}`}>
                  {hasMessages ? activeConversation?.title || "智能问答" : "问兰智能体系统"}
                </div>
                <div className={`truncate text-[#8c8276] ${desktopFontClasses.headerSubtitle}`}>{initialConfig.headline}</div>
              </div>
            </div>

            <button
              className={`inline-flex items-center rounded-full bg-[#1a1410] text-[#f7f3ec] transition hover:bg-[#332922] ${desktopFontClasses.headerNewChatBtn}`}
              onClick={startNewChat}
              type="button"
            >
              <CircleDashed className="h-4 w-4" />
              <span>新对话</span>
            </button>
          </div>
        </header>

        {!hasMessages ? (
          <>
            <section className="hidden min-h-0 flex-1 items-start justify-center px-4 py-8 lg:flex">
              <EmptyState
                prompts={initialConfig.starterPrompts}
                composer={composer}
                onQuickPrompt={handleQuickPrompt}
                promptClass={desktopFontClasses.prompt}
                fontSizeMode={desktopFontSize}
                uiClasses={desktopFontClasses}
              />
            </section>

            <section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden lg:hidden">
              <div className="min-h-0 w-full flex-1 overflow-y-auto px-4 py-4">
                <div className="mx-auto flex min-h-full w-full max-w-[430px] flex-col items-stretch justify-start gap-5 pb-8 pt-5 sm:gap-8">
                  <WelcomePanel framed={false} fontSizeMode={fontSize} uiClasses={mobileFontClasses} />
                  <MobileQuickActions onQuickPrompt={handleQuickPrompt} fontSizeMode={fontSize} />
                </div>
              </div>

              <div className="w-full shrink-0 border-t border-[#e6dccb] bg-[#f7f3ec] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2">
                <div className="mx-auto w-full max-w-[430px]">
                  {composer}
                  <p className="mx-auto mt-2 text-center text-[0.65em] leading-normal text-[#7d7d7d] opacity-75">
                    回答来自AI生成，请以官方最新资料为准
                  </p>
                </div>
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="hidden min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] lg:grid">
              <div className="min-h-0 overflow-y-auto px-4">
                <div className={`mx-auto max-w-3xl ${desktopFontClasses.messageSpacing}`}>
                  {activeMessages.map((message) => (
                    <MessageRow
                      key={message.id}
                      message={message}
                      onCopy={copyMessage}
                      copiedMessageId={copiedMessageId}
                      fontSizeClass={desktopFontClasses.body}
                      fontSizeMode={desktopFontSize}
                      uiClasses={desktopFontClasses}
                    />
                  ))}
                  <div ref={desktopStreamAnchorRef} />
                </div>
              </div>

              <div className="bg-[#f7f3ec] px-4 pb-4 pt-2">
                {composer}
                <p className="mx-auto mt-2 max-w-3xl text-center text-xs leading-5 text-[#7d7d7d]">
                  回答来自AI生成，请以官方最新资料为准
                </p>
              </div>
            </section>

            <section className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] lg:hidden">
              <div className="min-h-0 overflow-y-auto px-4">
                <div className={`mx-auto w-full max-w-[430px] ${mobileFontClasses.messageSpacing}`}>
                  {activeMessages.map((message) => (
                    <MessageRow
                      key={message.id}
                      message={message}
                      onCopy={copyMessage}
                      copiedMessageId={copiedMessageId}
                      fontSizeClass={mobileFontClasses.body}
                      fontSizeMode={fontSize}
                      uiClasses={mobileFontClasses}
                    />
                  ))}
                  <div ref={mobileStreamAnchorRef} />
                </div>
              </div>

              <div className="bg-[#f7f3ec] px-4 pb-4 pt-2">
                <div className="mx-auto w-full max-w-[430px]">
                {composer}
                <p className="mx-auto mt-2 text-center text-[0.65em] leading-normal text-[#7d7d7d] opacity-75">
                  回答来自AI生成，请以官方最新资料为准
                </p>
                </div>
              </div>
            </section>
          </>
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
  uiClasses?: (typeof fontSizeStyles)["md"]
}

function MessageRow({ message, copiedMessageId, onCopy, fontSizeClass, fontSizeMode = "md", uiClasses }: MessageRowProps) {
  const isUser = message.role === "user"
  const isPending = message.status === "pending" && !message.content
  const attachments = message.attachments ?? []
  const hasAttachments = attachments.length > 0
  const hasContent = Boolean(message.content.trim())
  const fontClasses = uiClasses ?? fontSizeStyles[fontSizeMode]

  if (isUser) {
    return (
      <article className="flex w-full justify-end">
        <div className={`min-w-0 break-words text-[#1a1410] ${fontClasses.userBubble} ${fontSizeClass}`}>
          {message.content}
        </div>
      </article>
    )
  }

  return (
    <article className="group w-full min-w-0">
      <div
        className={`min-w-0 overflow-x-hidden ${fontSizeClass} ${message.status === "error" ? "text-[#d1242f]" : "text-[#1a1410]"}`}
      >
        {isPending ? (
          <div className="flex items-center gap-2 text-sm text-[#8c8276]">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在回复
          </div>
        ) : (
          <div className="space-y-3">
            {hasAttachments ? (
              <div className="space-y-3">
                {attachments.map((attachment) => (
                  <figure key={`${attachment.kind}:${attachment.url}`} className="overflow-hidden rounded-2xl border border-[#e6dccb] bg-white">
                    {attachment.kind === "image" ? (
                      <img
                        src={attachment.url}
                        alt={attachment.alt || attachment.name || "图片"}
                        loading="lazy"
                        className="block h-auto w-full max-w-full bg-[#fbf8f3] object-contain"
                      />
                    ) : (
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 px-4 py-3 text-sm text-[#1a1410] transition hover:bg-[#fbf8f3]"
                      >
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-xs font-medium text-[#444]">
                          文件
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{attachment.name || "附件"}</span>
                          <span className="block truncate text-xs text-[#8c8276]">{attachment.mimeType || attachment.url}</span>
                        </span>
                      </a>
                    )}
                  </figure>
                ))}
              </div>
            ) : null}
            {hasContent ? <MarkdownRenderer content={message.content} /> : null}
            {!hasContent && !hasAttachments ? <MarkdownRenderer content="暂未生成内容。" /> : null}
          </div>
        )}
      </div>

      {hasContent ? (
        <button
          className={`mt-2 inline-flex items-center rounded-lg text-[#8c8276] opacity-100 transition hover:bg-[#f4eee5] hover:text-[#1a1410] md:opacity-0 md:group-hover:opacity-100 ${fontClasses.copyBtn}`}
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
  uiClasses,
}: {
  framed?: boolean
  fontSizeMode?: FontSizeMode
  uiClasses?: (typeof fontSizeStyles)["md"]
}) {
  const fontClasses = uiClasses ?? fontSizeStyles[fontSizeMode]
  
  const titleStyle = fontClasses.title
  const copyStyle = fontClasses.meta
  const shellClass = fontClasses.welcomeShell
  const titleMargin = fontClasses.welcomeTitleMargin
  const copyMargin = fontClasses.welcomeCopyMargin
  const logoImgSize = fontClasses.welcomeLogoSize
  const subtitleChipClass = fontClasses.welcomeSubtitleChip

  const shellStyle = framed
    ? "border border-black/[0.08] bg-white shadow-[0_1px_12px_rgba(0,0,0,0.03)]"
    : "bg-transparent shadow-none"

  return (
    <section className={`w-full ${shellStyle} ${shellClass}`}>
      <div className="flex flex-col items-center justify-center gap-3">
        <BrandMark size={logoImgSize} />
        <div className={`font-serif font-semibold uppercase tracking-[0.18em] text-[#8c8276] flex items-center ${subtitleChipClass}`}>
          <Sparkles className="h-[1.1em] w-[1.1em] text-[#c9a87a] fill-[#c9a87a] shrink-0" />
          问兰智能体系统
        </div>
      </div>

      <h1 className={`${titleMargin} text-center font-serif font-bold tracking-tight text-[#1a1410] ${titleStyle}`}>{launchTitle}</h1>

      <p className={`mx-auto ${copyMargin} max-w-2xl text-center text-[#3a322a] ${copyStyle} leading-[1.65]`}>{emptyStateCopy}</p>
    </section>
  )
}

function EmptyState({
  prompts,
  composer,
  onQuickPrompt,
  promptClass,
  fontSizeMode = "md",
  uiClasses,
}: {
  prompts: string[]
  composer: ReactNode
  onQuickPrompt: (prompt: string) => void
  promptClass: string
  fontSizeMode?: FontSizeMode
  uiClasses?: (typeof fontSizeStyles)["md"]
}) {
  const promptBtnClass =
    uiClasses === desktopBaseStyles
      ? "px-3 py-2"
      : fontSizeMode === "sm"
        ? "px-3 py-2"
        : fontSizeMode === "md"
          ? "px-4.5 py-2.5 text-[18px]"
          : "px-6 py-3.5 text-[22px]"

  return (
    <div className="w-full max-w-[600px]">
      <WelcomePanel fontSizeMode={fontSizeMode} uiClasses={uiClasses} />

      <div className="mt-7">{composer}</div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {prompts.slice(0, 4).map((prompt) => (
          <button
            key={prompt}
            className={`max-w-full rounded-full border border-[#e6dccb] bg-white text-[#1a1410] transition hover:bg-[#fbf8f3] ${promptBtnClass} ${promptClass}`}
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
          className={`rounded-xl border border-black/[0.08] bg-white px-4 py-3 shadow-[0_1px_12px_rgba(0,0,0,0.03)] sm:rounded-2xl ${
            compact ? "px-3 py-2.5 sm:px-3 sm:py-3" : ""
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1a1410] text-[10.5px] font-semibold text-[#c9a87a] sm:h-8 sm:w-8 sm:text-[11px]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold tracking-normal text-[#1a1410] sm:text-sm">{step.title}</div>
              <p className="mt-1 text-[13px] leading-5 text-[#627084] sm:text-sm sm:leading-6">{step.description}</p>
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
      <section className="mt-7 rounded-[2rem] border border-[#e6dccb] bg-white p-4 shadow-[0_1px_12px_rgba(26,20,16,0.03)] sm:p-5">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[#8c8276]">
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-3 py-3 sm:px-4 sm:py-6">
      <button className="absolute inset-0 bg-black/35" onClick={onClose} type="button" aria-label="关闭新手指导" />

      <section className="relative max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-[1.5rem] border border-[#e6dccb] bg-white p-4 text-[#1a1410] shadow-[0_18px_60px_rgba(26,20,16,0.16)] sm:rounded-[2rem] sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[#8c8276]">
              <Sparkles className="h-4 w-4" />
              新手指导
            </div>
            <h2 className="mt-2 text-[22px] font-serif font-semibold leading-tight tracking-normal text-[#1a1410] sm:text-[24px]">第一次使用可以这样开始</h2>
            <p className="mt-2 text-[13.5px] leading-6 text-[#3a322a] sm:text-sm">
              前台只保留提问、素材中心、商务中心和语音输入；上传和删除资料请进入受保护的后台知识库。
            </p>
          </div>

          <button
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#8c8276] transition hover:bg-[#f4eee5] hover:text-[#1a1410]"
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
          className="sticky bottom-0 mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#1a1410] px-4 text-sm font-medium text-[#f7f3ec] shadow-[0_-10px_22px_rgba(255,255,255,0.92)] transition hover:bg-[#332922] sm:mt-5"
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
  onVoicePressStart,
  onVoicePressEnd,
  onVoiceKeyDown,
  onVoiceKeyUp,
  density = "regular",
  desktopFontSizeClass,
  mobileFontSizeClass,
  mobileFontSizeMode = "md",
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
  onVoicePressStart: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onVoicePressEnd: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onVoiceKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void
  onVoiceKeyUp: (event: KeyboardEvent<HTMLButtonElement>) => void
  density?: LayoutDensity
  desktopFontSizeClass: string
  mobileFontSizeClass: string
  mobileFontSizeMode?: FontSizeMode
}) {
  const canSend = draft.trim().length > 0 && !isSending && !isTranscribing
  const isCompact = density !== "regular"
  const placeholder = isTranscribing
    ? "正在识别语音..."
    : isCompact
      ? "输入后回车发送"
      : "输入问题、产品名或关键词，按回车发送"
  const desktopBtnSize = "h-9 w-9"
  const desktopIconSize = "h-4 w-4"
  const desktopContainerPadding = "rounded-[1.65rem] p-2"
  const desktopTextareaPadding = "px-3 py-3"
  const desktopTextareaMinHeight = "min-h-14"

  const mobileBtnSize =
    mobileFontSizeMode === "sm" ? "h-10 w-10" : mobileFontSizeMode === "md" ? "h-12 w-12" : "h-14 w-14"
  const mobileIconSize =
    mobileFontSizeMode === "sm" ? "h-4.5 w-4.5" : mobileFontSizeMode === "md" ? "h-6 w-6" : "h-7 w-7"
  const mobileContainerPadding =
    mobileFontSizeMode === "sm"
      ? "px-3 py-2 rounded-2xl"
      : mobileFontSizeMode === "md"
        ? "px-3.5 py-2.5 rounded-[1.35rem]"
        : "px-4 py-3 rounded-[1.5rem]"
  const mobileTextareaPadding = mobileFontSizeMode === "sm" ? "px-2 py-1" : "px-2 py-1"
  const mobileTextareaMinHeight =
    mobileFontSizeMode === "sm" ? "min-h-12" : mobileFontSizeMode === "md" ? "min-h-14" : "min-h-16"

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const maxHeight = mobileFontSizeMode === "sm" ? 190 : mobileFontSizeMode === "md" ? 230 : 260
    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden"
  }, [draft, mobileFontSizeMode, textareaRef])

  return (
    <div className="mx-auto w-full lg:max-w-[600px]">
      <div className={`hidden border border-[#d9d9d9] bg-white shadow-[0_2px_16px_rgba(0,0,0,0.08)] lg:block ${desktopContainerPadding}`}>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={`max-h-48 w-full resize-none bg-transparent text-[#0d0d0d] outline-none placeholder:text-[#8f8f8f] ${desktopTextareaMinHeight} ${desktopTextareaPadding} ${desktopFontSizeClass}`}
          rows={1}
        />

        <VoiceMeter isRecording={isRecording} isTranscribing={isTranscribing} voiceLevel={voiceLevel} />

        <div className="flex items-center justify-between px-1 pb-1">
          <button
            className={`inline-flex items-center justify-center rounded-full transition touch-none select-none ${desktopBtnSize} ${
              isRecording
                ? "bg-[#d1242f] text-white"
                : "text-[#5f5f5f] hover:bg-[#f4eee5] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
            }`}
            title={canTranscribe ? "按住说话，松开识别" : "语音输入暂不可用"}
            onPointerDown={onVoicePressStart}
            onPointerUp={onVoicePressEnd}
            onPointerCancel={onVoicePressEnd}
            onKeyDown={onVoiceKeyDown}
            onKeyUp={onVoiceKeyUp}
            onContextMenu={(event) => event.preventDefault()}
            disabled={!canTranscribe || isTranscribing}
            aria-label="按住说话，松开识别"
          >
            <Mic className={`${desktopIconSize} ${isRecording ? "animate-pulse" : ""}`} />
          </button>

          <button
            className={`inline-flex items-center justify-center rounded-full bg-[#1a1410] text-[#f7f3ec] transition hover:bg-[#332922] disabled:cursor-not-allowed disabled:bg-[#d7d7d7] disabled:text-white ${desktopBtnSize}`}
            onClick={() => void onSubmit()}
            disabled={!canSend}
            aria-label="发送"
          >
            {isSending ? <Loader2 className={`${desktopIconSize} animate-spin`} /> : <ArrowUp className={desktopIconSize} />}
          </button>
        </div>
      </div>

      <div className="lg:hidden">
        <div className={`border border-[#e0e0e0] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.08)] ${mobileContainerPadding}`}>
          <div className="flex items-end gap-2">
            <button
              className={`inline-flex shrink-0 items-center justify-center rounded-full text-[#1a1410] transition hover:bg-[#f4eee5] ${mobileBtnSize}`}
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
              className={`flex-1 resize-none bg-transparent ${mobileTextareaPadding} text-[#0d0d0d] outline-none placeholder:text-[#8f8f8f] placeholder:text-[0.8em] leading-normal ${mobileTextareaMinHeight} ${mobileFontSizeClass}`}
              rows={1}
            />

            <button
              className={`inline-flex shrink-0 items-center justify-center rounded-full transition touch-none select-none ${mobileBtnSize} ${
                isRecording
                  ? "bg-[#d1242f] text-white"
                  : "text-[#7a7a7a] hover:bg-[#f4eee5] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent"
              }`}
              title={canTranscribe ? "按住说话，松开识别" : "语音输入暂不可用"}
              onPointerDown={onVoicePressStart}
              onPointerUp={onVoicePressEnd}
              onPointerCancel={onVoicePressEnd}
              onKeyDown={onVoiceKeyDown}
              onKeyUp={onVoiceKeyUp}
              onContextMenu={(event) => event.preventDefault()}
              disabled={!canTranscribe || isTranscribing}
              aria-label="按住说话，松开识别"
            >
              <Mic className={`${mobileIconSize} ${isRecording ? "animate-pulse" : ""}`} />
            </button>

            <button
              className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[#1a1410] text-[#f7f3ec] transition hover:bg-[#332922] disabled:cursor-not-allowed disabled:bg-[#d7d7d7] disabled:text-white ${mobileBtnSize}`}
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

  const statusText = isTranscribing ? "正在识别语音..." : voiceLevel > 0.08 ? "已检测到声音" : "按住说话中"
  const helperText = isTranscribing ? "识别完成后可一键发送" : "松开后自动转成文字"
  const toneClass = isTranscribing ? "text-amber-800" : isRecording ? "text-rose-700" : "text-[#666]"
  const dotClass = isTranscribing ? "bg-amber-500" : voiceLevel > 0.08 || isRecording ? "bg-sky-500" : "bg-[#c9a87a]"
  const containerClass = isTranscribing
    ? "border-amber-200 bg-amber-50/70"
    : isRecording
      ? "border-rose-200 bg-rose-50/70"
      : "border-black/[0.06] bg-[#fbfdff]"
  const barClass = isTranscribing ? "bg-amber-500" : isRecording ? "bg-sky-500" : "bg-[#c9a87a]"

  return (
    <div className={`px-3 ${compact ? "pb-2 pt-1" : "pb-3 pt-2"}`} aria-live="polite">
      <div className={`rounded-2xl border px-3 py-2.5 ${containerClass}`}>
        <div className="flex items-center justify-between gap-3">
          <div className={`flex items-center gap-2 text-xs font-medium ${toneClass}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${dotClass} ${isRecording || isTranscribing ? "animate-pulse" : ""}`} />
            <span>{statusText}</span>
          </div>
          <span className={`text-[11px] ${isTranscribing ? "text-amber-800/80" : isRecording ? "text-sky-700/80" : "text-[#8c8276]"}`}>
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
      {centerActions.map(({ icon: Icon, title, description, prompt }) => (
        <button
          key={title}
          className={`flex w-full items-center text-left transition bg-white border border-black/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.05)] hover:bg-[#f5f9fe] hover:border-black/[0.08] active:scale-[0.99] active:shadow-[0_2px_10px_rgba(0,0,0,0.04)] ${fontClasses.qaPadding}`}
          onClick={() => onQuickPrompt(prompt)}
          type="button"
        >
          <span
            className={`flex shrink-0 items-center justify-center bg-[#f4eee5] text-[#1a1410] ${fontClasses.qaIconBox}`}
          >
            <Icon className={fontClasses.qaIcon} />
          </span>
          <div className="min-w-0 flex-1 ml-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className={`block font-semibold tracking-tight text-[#1a1410] ${fontClasses.qaTitle}`}>
                {title}
              </span>
              <span className="shrink-0 rounded-full bg-[#edf4fb] px-2.5 py-1 text-[11px] font-medium text-[#5f6c7f]">
                立即进入
              </span>
            </div>
            <span className={`mt-1 block font-normal text-[#6f7c8d] ${fontClasses.qaSubtitle}`}>
              {description}
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}
