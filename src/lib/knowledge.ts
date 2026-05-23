import type { KnowledgeKind } from "@/types/knowledge"

export function normalizeKnowledgeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function buildKnowledgeDocumentName(params: {
  kind: KnowledgeKind
  knowledgeKey: string
  version: number
  title: string
}) {
  const key = normalizeKnowledgeKey(params.knowledgeKey)
  const cleanTitle = params.title.trim().replace(/\s+/g, " ")
  return `[${params.kind}][${key}][v${params.version}] ${cleanTitle}`
}

export function parseKnowledgeDocumentName(name: string) {
  const pattern = /^\[(article|table|image)\]\[([^\]]+)\]\[v(\d+)\]\s*(.+)$/i
  const match = name.trim().match(pattern)
  if (!match) {
    return {
      kind: "article" as KnowledgeKind,
      knowledgeKey: "",
      version: 1,
      title: name.trim(),
    }
  }

  return {
    kind: match[1].toLowerCase() as KnowledgeKind,
    knowledgeKey: match[2].trim(),
    version: Number(match[3]) || 1,
    title: match[4].trim(),
  }
}

export function stripHtmlTags(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
}

export async function extractArticleSnapshot(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
    },
  })

  if (!response.ok) {
    throw new Error(`抓取文章失败 (${response.status})`)
  }

  const html = await response.text()
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || url
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  const body = bodyMatch ? bodyMatch[1] : html
  const text = stripHtmlTags(body)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")

  return {
    title,
    text: text.slice(0, 120000),
  }
}

export function extractKnowledgeSummary(text: string, limit = 140) {
  const compact = text.replace(/\s+/g, " ").trim()
  return compact.length > limit ? `${compact.slice(0, limit)}…` : compact
}
