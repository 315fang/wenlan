import { buildKnowledgeDocumentName, extractArticleSnapshot, normalizeKnowledgeKey, parseKnowledgeDocumentName } from "@/lib/knowledge"
import { isAdminConfigured, verifyAdminRequest } from "@/lib/admin-auth"
import { getKnowledgeTarget } from "@/lib/server"
import { joinUrl } from "@/lib/url"
import type { KnowledgeItem, KnowledgeKind } from "@/types/knowledge"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type DifyDocumentRecord = Record<string, unknown>

const allowedKinds: KnowledgeKind[] = ["article", "table", "image"]

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeTimestamp(value: unknown) {
  if (typeof value === "number") {
    const ms = value < 10000000000 ? value * 1000 : value
    return new Date(ms).toISOString()
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return normalizeTimestamp(parsed)
    }
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString()
    }
  }
  return new Date().toISOString()
}

function mapDifyDocument(record: DifyDocumentRecord): KnowledgeItem {
  const name = String(record.name || record.document_name || record.title || "未命名资料")
  const parsed = parseKnowledgeDocumentName(name)
  const archived = Boolean(record.archived)
  const enabled = record.enabled !== false
  const indexingStatus = String(record.indexing_status || record.display_status || record.status || "")
  const status = archived ? "archived" : enabled && indexingStatus !== "indexing" ? "active" : "indexing"
  const createdAt = normalizeTimestamp(record.created_at || record.createdAt)
  const updatedAt = normalizeTimestamp(record.updated_at || record.updatedAt || record.created_at || record.createdAt)

  return {
    id: String(record.id || name),
    documentId: String(record.id || ""),
    kind: parsed.kind,
    knowledgeKey: parsed.knowledgeKey,
    title: parsed.title,
    version: parsed.version,
    status,
    createdAt,
    updatedAt,
    summary: typeof record.data_source_info === "string" ? record.data_source_info : "",
  }
}

async function parseJsonError(response: Response) {
  const text = await response.text()
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    const message = parsed.error || parsed.message || parsed.detail
    if (typeof message === "string" && message.trim()) {
      return message
    }
  } catch {
    // ignore
  }
  return text.trim()
}

function knowledgeHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
  }
}

async function listDifyDocuments(limit = 100) {
  const target = getKnowledgeTarget()
  if (!target) {
    return { configured: false, items: [] as KnowledgeItem[], raw: null }
  }

  const url = new URL(joinUrl(target.baseUrl, `datasets/${target.datasetId}/documents`))
  url.searchParams.set("page", "1")
  url.searchParams.set("limit", String(limit))

  const response = await fetch(url, {
    headers: knowledgeHeaders(target.apiKey),
    cache: "no-store",
  })

  if (!response.ok) {
    const detail = await parseJsonError(response)
    throw new Error(detail || `读取知识库失败 (${response.status})`)
  }

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
  const records = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.documents)
      ? payload.documents
      : []

  return {
    configured: true,
    items: records.map((item) => mapDifyDocument(item as DifyDocumentRecord)),
    raw: payload,
  }
}

async function createDifyTextDocument(params: {
  name: string
  text: string
}) {
  const target = getKnowledgeTarget()
  if (!target) {
    throw new Error("请先配置知识库资料集编号和接口密钥")
  }

  const response = await fetch(joinUrl(target.baseUrl, `datasets/${target.datasetId}/document/create-by-text`), {
    method: "POST",
    headers: {
      ...knowledgeHeaders(target.apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: params.name,
      text: params.text,
      indexing_technique: "high_quality",
      process_rule: {
        mode: "automatic",
      },
    }),
  })

  if (!response.ok) {
    const detail = await parseJsonError(response)
    throw new Error(detail || `写入知识库失败 (${response.status})`)
  }

  return (await response.json().catch(() => ({}))) as Record<string, unknown>
}

async function createDifyFileDocument(params: {
  name: string
  file: File
}) {
  const target = getKnowledgeTarget()
  if (!target) {
    throw new Error("请先配置知识库资料集编号和接口密钥")
  }

  const renamedFile = new File([await params.file.arrayBuffer()], params.name, {
    type: params.file.type || "application/octet-stream",
  })
  const formData = new FormData()
  formData.append("file", renamedFile, params.name)
  formData.append(
    "data",
    JSON.stringify({
      indexing_technique: "high_quality",
      process_rule: {
        mode: "automatic",
      },
    })
  )

  const response = await fetch(joinUrl(target.baseUrl, `datasets/${target.datasetId}/document/create-by-file`), {
    method: "POST",
    headers: knowledgeHeaders(target.apiKey),
    body: formData,
  })

  if (!response.ok) {
    const detail = await parseJsonError(response)
    throw new Error(detail || `上传知识文件失败 (${response.status})`)
  }

  return (await response.json().catch(() => ({}))) as Record<string, unknown>
}

async function uploadImageFile(file: File) {
  const target = getKnowledgeTarget()
  if (!target) return null

  const formData = new FormData()
  formData.append("file", file, file.name)
  formData.append("user", "wenlan-admin")

  const response = await fetch(joinUrl(target.baseUrl, "files/upload"), {
    method: "POST",
    headers: knowledgeHeaders(target.apiKey),
    body: formData,
  })

  if (!response.ok) return null
  return (await response.json().catch(() => null)) as Record<string, unknown> | null
}

async function deleteDifyDocument(documentId: string) {
  const target = getKnowledgeTarget()
  if (!target) return

  await fetch(joinUrl(target.baseUrl, `datasets/${target.datasetId}/documents/${documentId}`), {
    method: "DELETE",
    headers: knowledgeHeaders(target.apiKey),
  }).catch(() => {})
}

function pickCreatedDocumentId(payload: Record<string, unknown>) {
  const candidates = [
    payload.document,
    payload.data,
    payload,
  ]
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") {
      const record = candidate as Record<string, unknown>
      const id = record.id || record.document_id
      if (typeof id === "string" && id.trim()) {
        return id
      }
    }
  }
  return ""
}

function matchesKnowledgeKey(left: string, right: string) {
  return normalizeKnowledgeKey(left) === normalizeKnowledgeKey(right)
}

function stripFileExtension(name: string) {
  return name.replace(/\.[^.]+$/, "").trim() || name.trim()
}

function getNextVersion(items: KnowledgeItem[], kind: KnowledgeKind, knowledgeKey: string) {
  const versions = items
    .filter((item) => item.kind === kind && matchesKnowledgeKey(item.knowledgeKey, knowledgeKey))
    .map((item) => item.version)
  return versions.length > 0 ? Math.max(...versions) + 1 : 1
}

async function removePreviousVersionsFromItems(
  items: KnowledgeItem[],
  kind: KnowledgeKind,
  knowledgeKey: string,
  newDocumentId: string
) {
  const previous = items.filter(
    (item) =>
      item.kind === kind &&
      matchesKnowledgeKey(item.knowledgeKey, knowledgeKey) &&
      item.documentId &&
      item.documentId !== newDocumentId
  )

  await Promise.all(previous.map((item) => deleteDifyDocument(item.documentId)))

  return {
    removedCount: previous.length,
    remaining: items.filter((item) => !previous.some((oldItem) => oldItem.documentId === item.documentId)),
  }
}

function appendUploadedItem(params: {
  documentId: string
  kind: KnowledgeKind
  knowledgeKey: string
  title: string
  version: number
}) {
  const now = new Date().toISOString()
  return {
    id: params.documentId || `${params.kind}-${params.knowledgeKey}-${params.version}`,
    documentId: params.documentId,
    kind: params.kind,
    knowledgeKey: params.knowledgeKey,
    title: params.title,
    version: params.version,
    status: "indexing" as const,
    createdAt: now,
    updatedAt: now,
    summary: "",
  } satisfies KnowledgeItem
}

async function uploadKnowledgeEntry(params: {
  items: KnowledgeItem[]
  kind: KnowledgeKind
  title: string
  knowledgeKey?: string
  version?: number
  sourceUrl?: string
  description?: string
  content?: string
  file?: File
}) {
  const kind = params.kind
  const inputTitle = params.title.trim()
  const initialKnowledgeKey = normalizeKnowledgeKey(params.knowledgeKey || inputTitle)
  let title = inputTitle
  let knowledgeKey = initialKnowledgeKey
  let version = params.version || 1
  let documentName = ""
  let payload: Record<string, unknown>

  if (kind === "article") {
    const snapshot = params.content
      ? { title: title || params.sourceUrl || "未命名资料", text: params.content }
      : params.sourceUrl
        ? await extractArticleSnapshot(params.sourceUrl)
        : { title: title || params.sourceUrl || "未命名资料", text: "" }

    if (!snapshot.text.trim()) {
      throw new Error("文章上传需要正文内容或可抓取的来源链接")
    }

    title = title || snapshot.title || params.sourceUrl || "未命名资料"
    knowledgeKey = normalizeKnowledgeKey(params.knowledgeKey || title)
    if (!knowledgeKey) {
      throw new Error("请填写资料标题和关键词")
    }
    version = params.version || getNextVersion(params.items, kind, knowledgeKey)
    documentName = buildKnowledgeDocumentName({
      kind,
      knowledgeKey,
      version,
      title,
    })
    payload = await createDifyTextDocument({
      name: documentName,
      text: buildKnowledgeText({
        kind,
        title,
        knowledgeKey,
        version,
        sourceUrl: params.sourceUrl,
        description: params.description,
        body: snapshot.text,
      }),
    })
  } else if (kind === "table") {
    if (!(params.file instanceof File)) {
      throw new Error("请上传表格文件")
    }
    if (!title || !knowledgeKey) {
      throw new Error("请填写资料标题和关键词")
    }
    version = params.version || getNextVersion(params.items, kind, knowledgeKey)
    documentName = buildKnowledgeDocumentName({ kind, knowledgeKey, version, title })
    payload = await createDifyFileDocument({
      name: documentName,
      file: params.file,
    })
  } else {
    if (!title || !knowledgeKey) {
      throw new Error("请填写资料标题和关键词")
    }
    if (!(params.file instanceof File)) {
      throw new Error("请上传图片文件")
    }
    version = params.version || getNextVersion(params.items, kind, knowledgeKey)
    documentName = buildKnowledgeDocumentName({ kind, knowledgeKey, version, title })
    const uploaded = await uploadImageFile(params.file)
    const fileId = uploaded && typeof uploaded.id === "string" ? uploaded.id : ""
    payload = await createDifyTextDocument({
      name: documentName,
      text: buildKnowledgeText({
        kind,
        title,
        knowledgeKey,
        version,
        sourceUrl: params.sourceUrl,
        description: params.description,
        fileName: params.file.name,
        fileId,
        body:
          params.description ||
          "图片素材已上传。建议补充图片用途、画面内容、适用场景或图片识别文字，方便问兰智能体系统准确引用。",
      }),
    })
  }

  const documentId = pickCreatedDocumentId(payload)
  const { removedCount, remaining } = documentId
    ? await removePreviousVersionsFromItems(params.items, kind, knowledgeKey, documentId)
    : { removedCount: 0, remaining: params.items }

  const nextItems = documentId
    ? [appendUploadedItem({ documentId, kind, knowledgeKey, title, version }), ...remaining]
    : remaining

  return {
    documentId,
    removedPrevious: removedCount,
    items: nextItems,
    title,
    knowledgeKey,
    version,
  }
}

function buildKnowledgeText(params: {
  kind: KnowledgeKind
  title: string
  knowledgeKey: string
  version: number
  sourceUrl?: string
  description?: string
  fileName?: string
  fileId?: string
  body: string
}) {
  return [
    `资料类型：${params.kind}`,
    `关键词：${params.knowledgeKey}`,
    `资料标题：${params.title}`,
    `版本：v${params.version}`,
    params.sourceUrl ? `来源链接：${params.sourceUrl}` : "",
    params.fileName ? `文件名：${params.fileName}` : "",
    params.fileId ? `文件编号：${params.fileId}` : "",
    params.description ? `说明：${params.description}` : "",
    "",
    "正文：",
    params.body,
  ]
    .filter((line) => line !== "")
    .join("\n")
}

export async function GET(request: Request) {
  try {
    if (!isAdminConfigured()) {
      return Response.json({ error: "请先配置后台管理密码" }, { status: 503 })
    }
    if (!verifyAdminRequest(request)) {
      return Response.json({ error: "未授权访问" }, { status: 401 })
    }

    const url = new URL(request.url)
    const kind = url.searchParams.get("kind") as KnowledgeKind | null
    const query = (url.searchParams.get("query") || "").trim().toLowerCase()
    const result = await listDifyDocuments(100)
    const items = result.items.filter((item) => {
      if (kind && allowedKinds.includes(kind) && item.kind !== kind) return false
      if (!query) return true
      return `${item.title} ${item.knowledgeKey}`.toLowerCase().includes(query)
    })

    return Response.json({
      configured: result.configured,
      items,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取知识库失败"
    return Response.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    if (!isAdminConfigured()) {
      return Response.json({ error: "请先配置后台管理密码" }, { status: 503 })
    }
    if (!verifyAdminRequest(request)) {
      return Response.json({ error: "未授权访问" }, { status: 401 })
    }

    const target = getKnowledgeTarget()
    if (!target) {
      return Response.json({ error: "请先配置知识库资料集编号和接口密钥" }, { status: 503 })
    }

    const formData = await request.formData()
    const kind = asString(formData.get("kind")) as KnowledgeKind
    const mode = asString(formData.get("mode")) as "single" | "batch"
    if (!allowedKinds.includes(kind)) {
      return Response.json({ error: "资料类型只能是文章、表格或图片" }, { status: 400 })
    }
    if (mode !== "single" && mode !== "batch") {
      return Response.json({ error: "上传模式只能是单条或批量" }, { status: 400 })
    }

    const sourceUrl = asString(formData.get("sourceUrl"))
    const description = asString(formData.get("description"))
    const file = formData.get("file")
    const content = asString(formData.get("content"))
    const version = Number(asString(formData.get("version")) || "1") || 1
    let title = asString(formData.get("title"))
    const knowledgeKey = asString(formData.get("knowledgeKey")) || title

    if (mode === "single") {
      if (!title && file instanceof File) {
        title = file.name
      }
      const result = await uploadKnowledgeEntry({
        items: (await listDifyDocuments(100)).items,
        kind,
        title,
        knowledgeKey,
        version,
        sourceUrl,
        description,
        content,
        file: file instanceof File ? file : undefined,
      })

      return Response.json({
        ok: true,
        documentId: result.documentId,
        removedPrevious: result.removedPrevious,
      })
    }

    const initialItems = (await listDifyDocuments(100)).items
    let workingItems = initialItems
    let createdCount = 0
    let failedCount = 0
    let removedPrevious = 0
    const failures: Array<{ title: string; error: string }> = []

    if (kind === "article") {
      const urls = asString(formData.get("batchUrls"))
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)

      if (urls.length === 0) {
        return Response.json({ error: "请至少填写一个文章链接" }, { status: 400 })
      }

      for (const url of urls) {
        try {
          const snapshot = await extractArticleSnapshot(url)
          const resolvedTitle = snapshot.title?.trim() || url
          const result = await uploadKnowledgeEntry({
            items: workingItems,
            kind,
            title: resolvedTitle,
            knowledgeKey: snapshot.title || resolvedTitle,
            sourceUrl: url,
            description,
            content: snapshot.text,
          })
          workingItems = result.items
          createdCount += 1
          removedPrevious += result.removedPrevious
        } catch (error) {
          failedCount += 1
          failures.push({
            title: url,
            error: error instanceof Error ? error.message : "上传失败",
          })
        }
      }
    } else {
      const files = formData
        .getAll("files")
        .filter((entry): entry is File => entry instanceof File && entry.size > 0)

      if (files.length === 0) {
        return Response.json({ error: "请至少选择一个文件" }, { status: 400 })
      }

      for (const itemFile of files) {
        try {
          const baseTitle = stripFileExtension(itemFile.name)
          const result = await uploadKnowledgeEntry({
            items: workingItems,
            kind,
            title: baseTitle,
            knowledgeKey: baseTitle,
            description,
            file: itemFile,
          })
          workingItems = result.items
          createdCount += 1
          removedPrevious += result.removedPrevious
        } catch (error) {
          failedCount += 1
          failures.push({
            title: itemFile.name,
            error: error instanceof Error ? error.message : "上传失败",
          })
        }
      }
    }

    if (createdCount === 0) {
      return Response.json(
        {
          error: failures[0]?.error || "批量上传失败",
          createdCount,
          failedCount,
          failures,
        },
        { status: 400 }
      )
    }

    return Response.json({
      ok: true,
      createdCount,
      failedCount,
      removedPrevious,
      failures,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "上传知识资料失败"
    return Response.json({ error: message }, { status: 500 })
  }
}
