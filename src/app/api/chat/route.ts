import { defaultSystemPrompt } from "@/lib/prompts"
import { getChatTarget } from "@/lib/server"

export const runtime = "nodejs"

type ChatBody = {
  message?: string
  conversationId?: string
  conversation_id?: string
  userId?: string
  user_id?: string
  pagePath?: string
  page_path?: string
}

function buildSseFrame(payload: unknown, event = "message") {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
}

function buildSseResponse(payloads: Array<{ event?: string; data: unknown }>, status = 200) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      for (const payload of payloads) {
        controller.enqueue(encoder.encode(buildSseFrame(payload.data, payload.event)))
      }
      controller.close()
    },
  })

  return new Response(stream, {
    status,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  })
}

function extractText(data: unknown) {
  if (!data || typeof data !== "object") {
    return typeof data === "string" ? data : ""
  }

  const record = data as Record<string, unknown>
  const directCandidates = [
    record.answer,
    record.text,
    record.content,
    record.message,
    record.result,
  ]

  for (const candidate of directCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate
    }
  }

  const nested = record.data
  if (nested && typeof nested === "object") {
    const nestedRecord = nested as Record<string, unknown>
    const nestedCandidates = [nestedRecord.answer, nestedRecord.text, nestedRecord.content, nestedRecord.message]
    for (const candidate of nestedCandidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate
      }
    }
  }

  return ""
}

function extractConversationId(data: unknown) {
  if (!data || typeof data !== "object") return ""
  const record = data as Record<string, unknown>
  const candidates = [record.conversation_id, record.conversationId, record.difyConversationId]
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate
    }
  }
  const nested = record.data
  if (nested && typeof nested === "object") {
    const nestedRecord = nested as Record<string, unknown>
    const nestedCandidates = [nestedRecord.conversation_id, nestedRecord.conversationId]
    for (const candidate of nestedCandidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate
      }
    }
  }
  return ""
}

function extractAttachments(data: unknown) {
  if (!data || typeof data !== "object") return []
  const record = data as Record<string, unknown>
  const source: unknown[] = []
  for (const key of ["files", "attachments", "message_files", "images"] as const) {
    if (Array.isArray(record[key])) source.push(...record[key])
  }

  const nested = record.data
  if (nested && typeof nested === "object") {
    const nestedRecord = nested as Record<string, unknown>
    for (const key of ["files", "attachments", "message_files", "images"] as const) {
      if (Array.isArray(nestedRecord[key])) source.push(...nestedRecord[key])
    }
  }

  return source
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

function normalizeUpstreamError(status: number, detail: string) {
  if (detail) {
    return `${status}: ${detail}`
  }
  return `上游服务返回错误 ${status}`
}

function isEventStream(response: Response) {
  const contentType = response.headers.get("content-type") || ""
  return contentType.includes("text/event-stream")
}

function buildRoutedMessage(message: string) {
  return [
    "请严格按以下风格回答：",
    defaultSystemPrompt,
    "",
    `用户问题：${message}`,
  ].join("\n")
}

export async function POST(request: Request) {
  const target = getChatTarget()
  if (!target) {
    return Response.json(
      {
        error: "请先配置大模型接口地址和密钥，或者配置自定义后端地址。",
      },
      { status: 503 }
    )
  }

  const body = (await request.json().catch(() => ({}))) as ChatBody
  const message = (body.message || "").trim()
  if (!message) {
    return Response.json({ error: "消息不能为空" }, { status: 400 })
  }

  if (target.kind === "dify") {
    const response = await fetch(target.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${target.apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        inputs: {},
        query: buildRoutedMessage(message),
        response_mode: "streaming",
        conversation_id: body.conversationId || body.conversation_id || "",
        user: body.userId || body.user_id || "wenlan-user",
      }),
    })

    if (!response.ok) {
      const detail = await parseJsonError(response)
      return Response.json({ error: normalizeUpstreamError(response.status, detail) }, { status: response.status })
    }

    if (isEventStream(response) && response.body) {
      return new Response(response.body, {
        status: response.status,
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
        },
      })
    }

    const fallback = await response.json().catch(() => ({}))
    const answer = extractText(fallback)
    const conversationId = extractConversationId(fallback)
    return buildSseResponse([
      {
        event: "message",
        data: {
          answer,
          conversation_id: conversationId,
        },
      },
      {
        event: "message_end",
        data: {
          conversation_id: conversationId,
        },
      },
    ])
  }

  const upstreamHeaders: HeadersInit = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  }
  if (target.apiKey) {
    upstreamHeaders.Authorization = `Bearer ${target.apiKey}`
    upstreamHeaders["X-API-Key"] = target.apiKey
  }

  const response = await fetch(target.url, {
    method: "POST",
    headers: upstreamHeaders,
    body: JSON.stringify({
      message: buildRoutedMessage(message),
      conversationId: body.conversationId || body.conversation_id || "",
      conversation_id: body.conversationId || body.conversation_id || "",
      userId: body.userId || body.user_id || "wenlan-user",
      user_id: body.userId || body.user_id || "wenlan-user",
      pagePath: body.pagePath || body.page_path || "",
      page_path: body.pagePath || body.page_path || "",
      systemPrompt: defaultSystemPrompt,
    }),
  })

  if (!response.ok) {
    const detail = await parseJsonError(response)
    return Response.json({ error: normalizeUpstreamError(response.status, detail) }, { status: response.status })
  }

  if (isEventStream(response) && response.body) {
    return new Response(response.body, {
      status: response.status,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    })
  }

  const fallback = await response.json().catch(() => ({}))
  const answer = extractText(fallback)
  const conversationId = extractConversationId(fallback)
  const attachments = extractAttachments(fallback)
  return buildSseResponse([
    {
      event: "message",
      data: {
        ...(fallback && typeof fallback === "object" ? (fallback as Record<string, unknown>) : {}),
        answer,
        conversation_id: conversationId,
        files: attachments,
        attachments,
      },
    },
    {
      event: "message_end",
      data: {
        conversation_id: conversationId,
      },
    },
  ])
}
