export type ChatRole = "user" | "assistant"

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  status?: "pending" | "done" | "error"
  createdAt: string
}

export interface ChatConversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
  difyConversationId?: string
}

export interface PortalConfig {
  appName: string
  assistantName: string
  subtitle: string
  headline: string
  starterPrompts: string[]
}

export interface ServerStatus {
  chatReady: boolean
  transcribeReady: boolean
  provider: string
  baseUrl: string
  assistantName: string
  assistantLabel: string
}
