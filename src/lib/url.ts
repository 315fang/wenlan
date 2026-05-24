export function joinUrl(baseUrl: string, path: string) {
  const base = baseUrl.trim().replace(/\/+$/, "")
  const suffix = path.startsWith("/") ? path : `/${path}`
  return `${base}${suffix}`
}

export function normalizeDifyChatEndpoint(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "")
  if (!trimmed) return ""
  if (/\/v1\/chat-messages$/i.test(trimmed)) return trimmed
  if (/\/v1$/i.test(trimmed)) return joinUrl(trimmed, "chat-messages")
  return joinUrl(joinUrl(trimmed, "v1"), "chat-messages")
}

export function normalizeDifyApiBase(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "")
  if (!trimmed) return ""
  if (/\/v1\/chat-messages$/i.test(trimmed)) return trimmed.replace(/\/chat-messages$/i, "")
  if (/\/v1$/i.test(trimmed)) return trimmed
  return joinUrl(trimmed, "v1")
}

export function safeBaseLabel(baseUrl: string) {
  try {
    const url = new URL(baseUrl)
    return url.host
  } catch {
    return baseUrl
  }
}
