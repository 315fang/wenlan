import type { ChatConversation } from "@/types/chat"

export const STORAGE_KEYS = {
  conversations: "wenlan-ai-portal:conversations",
  activeConversationId: "wenlan-ai-portal:active-conversation-id",
  userId: "wenlan-ai-portal:user-id",
  fontSize: "wenlan-ai-portal:font-size",
} as const

function browserAvailable() {
  return typeof window !== "undefined"
}

export function readStoredJson<T>(key: string, fallback: T): T {
  if (!browserAvailable()) return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeStoredJson<T>(key: string, value: T) {
  if (!browserAvailable()) return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

export function createId(prefix = "id") {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return `${prefix}-${random}`
}

export function ensureUserId() {
  if (!browserAvailable()) return "browser"
  const existing = window.localStorage.getItem(STORAGE_KEYS.userId)
  if (existing) return existing
  const next = createId("user")
  window.localStorage.setItem(STORAGE_KEYS.userId, next)
  return next
}

export function formatClock(isoString?: string) {
  const date = isoString ? new Date(isoString) : new Date()
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function sortConversations(conversations: ChatConversation[]) {
  return [...conversations].sort((a, b) => {
    const left = new Date(b.updatedAt).getTime()
    const right = new Date(a.updatedAt).getTime()
    return left - right
  })
}

export function trimText(text: string, max = 28) {
  const normalized = text.trim().replace(/\s+/g, " ")
  if (!normalized) return "新对话"
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized
}
