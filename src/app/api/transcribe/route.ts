import { getTranscribeTarget } from "@/lib/server"

export const runtime = "nodejs"

function extractText(data: unknown) {
  if (!data || typeof data !== "object") {
    return typeof data === "string" ? data : ""
  }

  const record = data as Record<string, unknown>
  const candidates = [record.text, record.transcript, record.transcription, record.result, record.message]
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate
    }
  }

  const nested = record.data
  if (nested && typeof nested === "object") {
    const nestedRecord = nested as Record<string, unknown>
    const nestedCandidates = [nestedRecord.text, nestedRecord.transcript, nestedRecord.transcription, nestedRecord.result]
    for (const candidate of nestedCandidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate
      }
    }
  }

  return ""
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

export async function POST(request: Request) {
  const target = getTranscribeTarget()
  if (!target) {
    return Response.json({ error: "请先配置 MIMO_API_KEY" }, { status: 503 })
  }

  const formData = await request.formData()
  const file = formData.get("file")
  if (!(file instanceof File)) {
    return Response.json({ error: "缺少音频文件" }, { status: 400 })
  }

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
    return Response.json({ error: detail || `语音转文字失败 (${response.status})` }, { status: response.status })
  }

  const payload = await response.json().catch(() => ({}))
  const text = extractText(payload)
  return Response.json({ text })
}

