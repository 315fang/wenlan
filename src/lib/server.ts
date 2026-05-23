import { assistantHeadline, assistantName, assistantSubtitle, appName, starterPrompts } from "@/lib/prompts"
import { joinUrl, normalizeDifyChatEndpoint, safeBaseLabel } from "@/lib/url"
import type { PortalConfig, ServerStatus } from "@/types/chat"

function readEnv(name: string) {
  return process.env[name]?.trim() || ""
}

export function getPortalConfig(): PortalConfig {
  return {
    appName: readEnv("PORTAL_APP_NAME") || appName,
    assistantName: readEnv("PORTAL_ASSISTANT_NAME") || assistantName,
    subtitle: readEnv("PORTAL_ASSISTANT_SUBTITLE") || assistantSubtitle,
    headline: readEnv("PORTAL_HEADLINE") || assistantHeadline,
    starterPrompts,
  }
}

export function getRuntimeStatus(): ServerStatus {
  const customChatUrl = readEnv("ASSISTANT_BACKEND_URL")
  const difyChatEndpoint = readEnv("DIFY_CHAT_ENDPOINT")
  const difyBaseUrl = readEnv("DIFY_BASE_URL")
  const difyApiKey = readEnv("DIFY_API_KEY")
  const transcribeApiKey = readEnv("MIMO_API_KEY")

  const chatBaseUrl = customChatUrl || difyChatEndpoint || difyBaseUrl
  const provider = customChatUrl ? "custom" : chatBaseUrl ? "dify" : "unconfigured"

  return {
    chatReady: customChatUrl ? true : Boolean(difyBaseUrl && difyApiKey),
    transcribeReady: Boolean(transcribeApiKey),
    provider,
    baseUrl: chatBaseUrl ? safeBaseLabel(chatBaseUrl) : "",
    assistantName: getPortalConfig().assistantName,
    assistantLabel: customChatUrl ? "自定义后端" : "Dify",
  }
}

export type ChatTarget =
  | {
      kind: "custom"
      url: string
      apiKey: string
    }
  | {
      kind: "dify"
      url: string
      apiKey: string
    }
  | null

export function getChatTarget(): ChatTarget {
  const customChatUrl = readEnv("ASSISTANT_BACKEND_URL")
  if (customChatUrl) {
    return {
      kind: "custom",
      url: customChatUrl,
      apiKey: readEnv("ASSISTANT_BACKEND_API_KEY") || readEnv("ASSISTANT_BACKEND_TOKEN"),
    }
  }

  const difyChatEndpoint = readEnv("DIFY_CHAT_ENDPOINT")
  if (difyChatEndpoint) {
    return {
      kind: "dify",
      url: difyChatEndpoint,
      apiKey: readEnv("DIFY_API_KEY"),
    }
  }

  const difyBaseUrl = readEnv("DIFY_BASE_URL")
  if (difyBaseUrl) {
    return {
      kind: "dify",
      url: normalizeDifyChatEndpoint(difyBaseUrl),
      apiKey: readEnv("DIFY_API_KEY"),
    }
  }

  return null
}

export type TranscribeTarget = {
  url: string
  apiKey: string
  model: string
  transport: "multipart" | "mimo-audio"
} | null

export type KnowledgeTarget = {
  baseUrl: string
  apiKey: string
  datasetId: string
} | null

function normalizeMimoAudioModel(value: string) {
  const normalized = value.trim().toLowerCase()
  if (normalized === "mimo-v2.5" || normalized === "mimo-v2-omni") {
    return normalized
  }
  return "mimo-v2.5"
}

export function getTranscribeTarget(): TranscribeTarget {
  const apiKey = readEnv("MIMO_API_KEY")
  if (!apiKey) return null

  const directUrl = readEnv("MIMO_TRANSCRIBE_URL")
  const baseUrl = readEnv("MIMO_BASE_URL") || "https://api.xiaomimimo.com/v1"

  if (directUrl) {
    return {
      url: directUrl,
      apiKey,
      model: readEnv("MIMO_ASR_MODEL") || "MiMo-V2.5-ASR",
      transport: "multipart",
    }
  }

  return {
    url: joinUrl(baseUrl, "chat/completions"),
    apiKey,
    model: normalizeMimoAudioModel(readEnv("MIMO_AUDIO_MODEL") || readEnv("MIMO_ASR_MODEL")),
    transport: "mimo-audio",
  }
}

export function getKnowledgeTarget(): KnowledgeTarget {
  const datasetId = readEnv("DIFY_KB_DATASET_ID") || readEnv("DIFY_DATASET_ID")
  const apiKey = readEnv("DIFY_KB_API_KEY") || readEnv("DIFY_API_KEY")
  if (!datasetId || !apiKey) return null

  const baseUrl = readEnv("DIFY_KB_BASE_URL") || readEnv("DIFY_PLATFORM_BASE_URL") || "https://api.dify.ai/v1"
  return {
    baseUrl,
    apiKey,
    datasetId,
  }
}
