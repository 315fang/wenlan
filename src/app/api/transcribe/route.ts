import { getTranscribeTarget } from "@/lib/server"

export const runtime = "nodejs"

function extractText(data: unknown) {
  if (!data || typeof data !== "object") {
    return typeof data === "string" ? data : ""
  }

  const record = data as Record<string, unknown>
  const candidates = [
    record.text,
    record.transcript,
    record.transcription,
    record.result,
    record.message,
    record.content,
    record.reasoning_content,
    record.output_text,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate
    }
  }

  const choices = record.choices
  if (Array.isArray(choices) && choices.length > 0) {
    const firstChoice = choices[0] as Record<string, unknown>
    const message = firstChoice.message
    if (message && typeof message === "object") {
      const messageRecord = message as Record<string, unknown>
      const messageCandidates = [
        messageRecord.text,
        messageRecord.content,
        messageRecord.transcript,
        messageRecord.transcription,
        messageRecord.reasoning_content,
      ]
      for (const candidate of messageCandidates) {
        if (typeof candidate === "string" && candidate.trim()) {
          return candidate
        }
      }
    }

    const choiceCandidates = [firstChoice.text, firstChoice.content]
    for (const candidate of choiceCandidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate
      }
    }
  }

  const nested = record.data
  if (nested && typeof nested === "object") {
    const nestedRecord = nested as Record<string, unknown>
    const nestedCandidates = [
      nestedRecord.text,
      nestedRecord.transcript,
      nestedRecord.transcription,
      nestedRecord.result,
      nestedRecord.content,
      nestedRecord.reasoning_content,
    ]
    for (const candidate of nestedCandidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate
      }
    }
  }

  return ""
}

function isHtmlLike(text: string) {
  const trimmed = text.trim().toLowerCase()
  return trimmed.startsWith("<!doctype html") || trimmed.startsWith("<html") || trimmed.includes("openresty")
}

function normalizeErrorMessage(detail: string, status: number) {
  const trimmed = detail.trim()
  if (!trimmed) {
    return `语音转文字失败 (${status})`
  }
  if (isHtmlLike(trimmed)) {
    return `语音转写接口暂不可用 (${status})`
  }
  return trimmed.length > 220 ? `${trimmed.slice(0, 220)}…` : trimmed
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

async function fileToDataUrl(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const base64 = Buffer.from(bytes).toString("base64")
  const mimeType = file.type || "audio/wav"
  return `data:${mimeType};base64,${base64}`
}

export async function POST(request: Request) {
  const target = getTranscribeTarget()
  if (!target) {
    return Response.json({ error: "请先配置语音接口密钥" }, { status: 503 })
  }

  const formData = await request.formData()
  const file = formData.get("file")
  if (!(file instanceof File)) {
    return Response.json({ error: "缺少音频文件" }, { status: 400 })
  }

  if (target.transport === "multipart") {
    const upstream = new FormData()
    upstream.append("file", file, file.name || "voice.webm")
    upstream.append("model", target.model)

    const response = await fetch(target.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${target.apiKey}`,
      },
      body: upstream,
    })

    if (!response.ok) {
      const detail = await parseJsonError(response)
      return Response.json({ error: normalizeErrorMessage(detail, response.status) }, { status: response.status })
    }

    const payload = await response.json().catch(() => ({}))
    const text = extractText(payload)
    if (!text.trim()) {
      return Response.json({ error: "转写服务未返回文本" }, { status: 502 })
    }
    return Response.json({ text })
  }

  const audioDataUrl = await fileToDataUrl(file)
  const response = await fetch(target.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": target.apiKey,
    },
    body: JSON.stringify({
      model: target.model,
      max_completion_tokens: 1024,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: "你是一个语音转文字助手。请只输出转写结果，不要解释，不要补充无关内容。",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "请将这段音频逐字转写，只输出文本，不要解释。",
            },
            {
              type: "input_audio",
              input_audio: {
                data: audioDataUrl,
              },
            },
          ],
        },
      ],
    }),
  })

  const responseText = await response.text()
  let payload: unknown = {}
  try {
    payload = JSON.parse(responseText)
  } catch {
    payload = responseText
  }

  if (!response.ok) {
    const detail = typeof payload === "string" ? payload : extractText(payload) || responseText
    return Response.json({ error: normalizeErrorMessage(detail, response.status) }, { status: response.status })
  }

  const text = extractText(payload)
  if (!text.trim()) {
    return Response.json({ error: "语音转写服务没有返回可用文本" }, { status: 502 })
  }

  return Response.json({ text })
}
