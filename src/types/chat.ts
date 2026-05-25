export type ChatRole = "user" | "assistant"

export interface ChatAttachment {
  id?: string
  name?: string
  url: string
  kind: "image" | "file"
  mimeType?: string
  alt?: string
}

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  status?: "pending" | "done" | "error"
  attachments?: ChatAttachment[]
  createdAt: string
  thought?: string
  isThinking?: boolean
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
  emptyStateCopy: string
  onboardingGuide: Array<{ title: string; description: string }>
}

export interface ServerStatus {
  chatReady: boolean
  transcribeReady: boolean
  provider: string
  baseUrl: string
  assistantName: string
  assistantLabel: string
}
