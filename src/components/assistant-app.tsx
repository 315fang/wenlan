"use client"

import type { ReactNode } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CircleDashed,
  Menu,
  Phone,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"

import { AppSidebar, MobileAppSidebar } from "@/components/app-sidebar"
import { BrandMark } from "@/components/brand-mark"
import { Bubble } from "@/components/bubble"
import { Composer } from "@/components/composer"
import { assistantName } from "@/lib/prompts"
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
  route: string
}> = [
  {
    icon: Search,
    title: "素材中心",
    description: "官方图片、朋友圈文案、社群文案",
    route: "/materials",
  },
  {
    icon: Phone,
    title: "商务中心",
    description: "联系方式、合作咨询、对接流程",
    route: "/business",
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

function scrollElementIntoView(ref: React.RefObject<HTMLDivElement | null>) {
  requestAnimationFrame(() => {
    ref.current?.scrollIntoView({ block: "end", behavior: "smooth" })
  })
}

type FontSizeMode = "sm" | "md" | "lg"
type DisplayMode = "fashion" | "efficiency"

const displayModeOptions: Array<{ value: DisplayMode; label: string }> = [
  { value: "fashion", label: "时尚版" },
  { value: "efficiency", label: "效率版" },
]

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

export function AssistantApp({ initialConfig }: AssistantAppProps) {
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState("")
  const [isSending, setIsSending] = useState(false)
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
  const router = useRouter()
  const navigateTo = (path: string) => {
    router.push(path)
  }

  const desktopStreamAnchorRef = useRef<HTMLDivElement | null>(null)
  const mobileStreamAnchorRef = useRef<HTMLDivElement | null>(null)
  const userIdRef = useRef("browser")

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
      // cleanup handled by useRecorder in Composer
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

  function patchConversation(conversationId: string, updater: (conversation: ChatConversation) => ChatConversation) {
    setConversations((current) =>
      current.map((conversation) => (conversation.id === conversationId ? updater(conversation) : conversation))
    )
  }

  function startNewChat() {
    const conversation = emptyConversation()
    setConversations((current) => [conversation, ...current])
    setActiveConversationId(conversation.id)
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

  const composer = (
    <Composer
      onSend={sendPrompt}
      onOpenGuide={openGuideModal}
      disabled={isSending}
      canTranscribe={serverStatus.transcribeReady}
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
          {centerActions.map(({ icon: Icon, title, description, route }) => (
            <button
              key={title}
              className={`flex w-full items-center gap-3 rounded-2xl border border-[#e6dccb] bg-white text-left transition hover:border-[#d6c5ad] hover:bg-[#fbf8f3] ${uiClasses.sidebarItemBtn}`}
              onClick={() => {
                setMobileSidebarOpen(false)
                navigateTo(route)
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

      <GuideModal open={guideModalOpen} onClose={() => setGuideModalOpen(false)} steps={initialConfig.onboardingGuide} />

      <main className="flex min-w-0 flex-1 flex-col bg-[#f7f3ec]">
        <header className="shrink-0 border-b border-[#e6dccb] bg-white/[0.94]">
          <div className={`mx-auto flex w-full max-w-[430px] items-center justify-between px-5 lg:hidden ${mobileFontClasses.headerHeight}`}>
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
                onQuickPrompt={(p: string) => void sendPrompt(p)}
                promptClass={desktopFontClasses.prompt}
                fontSizeMode={desktopFontSize}
                uiClasses={desktopFontClasses}
                welcomeText={initialConfig.emptyStateCopy}
              />
            </section>

            <section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden lg:hidden">
              <div className="min-h-0 w-full flex-1 overflow-y-auto px-6 py-4">
                <div className="mx-auto flex min-h-full w-full max-w-[430px] flex-col items-stretch justify-start gap-5 pb-8 pt-5 sm:gap-8">
                  <WelcomePanel framed={false} fontSizeMode={fontSize} uiClasses={mobileFontClasses} welcomeText={initialConfig.emptyStateCopy} />
                  <MobileQuickActions fontSizeMode={fontSize} />
                </div>
              </div>

              <div className="w-full shrink-0 bg-[#f7f3ec]">
                <div className="border-t border-[#e6dccb] px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2">
                  <div className="mx-auto w-full max-w-[430px]">
                    {composer}
                  </div>
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
                    <Bubble
                      key={message.id}
                      message={message}
                      onCopy={copyMessage}
                      copiedMessageId={copiedMessageId}
                    />
                  ))}
                  <div ref={desktopStreamAnchorRef} />
                </div>
              </div>

              <div className="bg-[#f7f3ec] px-4 pb-4 pt-2">
                {composer}
              </div>
            </section>

            <section className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] lg:hidden">
              <div className="min-h-0 overflow-y-auto px-6">
                <div className={`mx-auto w-full max-w-[430px] ${mobileFontClasses.messageSpacing}`}>
                  {activeMessages.map((message) => (
                    <Bubble
                      key={message.id}
                      message={message}
                      onCopy={copyMessage}
                      copiedMessageId={copiedMessageId}
                    />
                  ))}
                  <div ref={mobileStreamAnchorRef} />
                </div>
              </div>

              <div className="bg-[#f7f3ec] px-5 pb-4 pt-2">
                <div className="mx-auto w-full max-w-[430px]">
                {composer}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

function WelcomePanel({
  framed = true,
  fontSizeMode = "md",
  uiClasses,
  welcomeText,
}: {
  framed?: boolean
  fontSizeMode?: FontSizeMode
  uiClasses?: (typeof fontSizeStyles)["md"]
  welcomeText: string
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
      <div className="flex flex-col items-center justify-center gap-3 lux-in">
        <BrandMark size={logoImgSize} animated />
        <div className={`font-serif font-semibold uppercase tracking-[0.18em] text-[#8c8276] flex items-center ${subtitleChipClass} lux-in-1`}>
          <Sparkles className="h-[1.1em] w-[1.1em] text-[#c9a87a] fill-[#c9a87a] shrink-0" />
          问兰智能体系统
        </div>
      </div>

      <h1 className={`${titleMargin} text-center font-serif font-bold tracking-tight text-[#1a1410] ${titleStyle} lux-in-2 lux-shimmer-text`}>{launchTitle}</h1>

      <p className={`mx-auto ${copyMargin} max-w-2xl text-center text-[#3a322a] ${copyStyle} leading-[1.65] lux-in-3`}>{welcomeText}</p>
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
  welcomeText,
}: {
  prompts: string[]
  composer: ReactNode
  onQuickPrompt: (prompt: string) => void
  promptClass: string
  fontSizeMode?: FontSizeMode
  uiClasses?: (typeof fontSizeStyles)["md"]
  welcomeText: string
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
      <WelcomePanel fontSizeMode={fontSizeMode} uiClasses={uiClasses} welcomeText={welcomeText} />

      <div className="mt-7 lux-in-4">{composer}</div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {prompts.slice(0, 4).map((prompt, i) => (
          <button
            key={prompt}
            className={`max-w-full rounded-full border border-[#e6dccb] bg-white text-[#1a1410] transition hover:bg-[#fbf8f3] lux-card lux-press ${promptBtnClass} ${promptClass}`}
            onClick={() => onQuickPrompt(prompt)}
            style={{ animationDelay: `${0.45 + i * 0.08}s` }}
          >
            <span className="block max-w-[24rem] truncate">{prompt}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function UsageGuide({ compact = false, steps }: { compact?: boolean; steps: Array<{ title: string; description: string }> }) {
  const content = (
    <div className={compact ? "grid gap-2" : "grid gap-3 sm:grid-cols-2"}>
      {steps.map((step, index) => (
        <div
          key={step.title}
          className={`lux-in rounded-xl border border-black/[0.08] bg-white px-4 py-3 shadow-[0_1px_12px_rgba(0,0,0,0.03)] sm:rounded-2xl ${
            compact ? "px-3 py-2.5 sm:px-3 sm:py-3" : ""
          }`}
          style={{ animationDelay: `${index * 0.08}s` }}
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

function GuideModal({ open, onClose, steps }: { open: boolean; onClose: () => void; steps: Array<{ title: string; description: string }> }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-3 py-3 sm:px-4 sm:py-6">
      <button className="absolute inset-0 bg-black/35" onClick={onClose} type="button" aria-label="关闭新手指导" />

      <section className="relative max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-[1.5rem] border border-[#e6dccb] bg-white p-4 text-[#1a1410] shadow-[0_18px_60px_rgba(26,20,16,0.16)] sm:rounded-[2rem] sm:p-6">
        <header className="flex items-start justify-between gap-4">
          <div className="lux-in">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[#8c8276]">
              <Sparkles className="h-4 w-4" />
              新手指导
            </div>
            <h2 className="mt-2 text-[22px] font-serif font-semibold leading-tight tracking-normal text-[#1a1410] sm:text-[24px] lux-in-1 lux-shimmer-text">第一次使用可以这样开始</h2>
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
          <UsageGuide compact steps={steps} />
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

function MobileQuickActions({
  fontSizeMode = "md",
}: {
  fontSizeMode?: FontSizeMode
}) {
  const fontClasses = fontSizeStyles[fontSizeMode]
  return (
    <div className={`w-full ${fontClasses.qaSpacing} lux-in-4`}>
        {centerActions.map(({ icon: Icon, title, description, route }, i) => (
          <button
            key={title}
            className={`lux-card lux-press flex w-full items-center text-left transition bg-white border border-black/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.05)] hover:bg-[#f5f9fe] hover:border-black/[0.08] active:scale-[0.99] active:shadow-[0_2px_10px_rgba(0,0,0,0.04)] ${fontClasses.qaPadding}`}
          onClick={() => {
            window.location.href = route
          }}
          style={{ animationDelay: `${i * 0.1}s` }}
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
