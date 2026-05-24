import { getDifyApiTarget } from "@/lib/server"
import { joinUrl } from "@/lib/url"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{
    fileId: string
  }>
}

export async function GET(_request: Request, context: RouteContext) {
  const target = getDifyApiTarget()
  if (!target) {
    return Response.json({ error: "当前未配置 Dify 文件预览能力" }, { status: 503 })
  }

  const { fileId } = await Promise.resolve(context.params)
  if (!fileId) {
    return Response.json({ error: "缺少文件编号" }, { status: 400 })
  }

  const response = await fetch(joinUrl(target.baseUrl, `files/${encodeURIComponent(fileId)}/preview`), {
    headers: {
      Authorization: `Bearer ${target.apiKey}`,
    },
    cache: "no-store",
  })

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "")
    return Response.json(
      { error: detail || `文件预览失败 (${response.status})` },
      { status: response.status || 500 }
    )
  }

  const headers = new Headers()
  headers.set("content-type", response.headers.get("content-type") || "application/octet-stream")
  headers.set("cache-control", response.headers.get("cache-control") || "private, max-age=300")
  const contentDisposition = response.headers.get("content-disposition")
  if (contentDisposition) {
    headers.set("content-disposition", contentDisposition)
  }

  return new Response(response.body, {
    status: response.status,
    headers,
  })
}
