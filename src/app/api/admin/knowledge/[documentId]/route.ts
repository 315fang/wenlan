import { isAdminConfigured, verifyAdminRequest } from "@/lib/admin-auth"
import { getKnowledgeTarget } from "@/lib/server"
import { joinUrl } from "@/lib/url"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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

export async function DELETE(_request: Request, { params }: { params: Promise<{ documentId: string }> }) {
  try {
    const { documentId } = await params
    if (!isAdminConfigured()) {
      return Response.json({ error: "请先配置后台管理密码" }, { status: 503 })
    }
    if (!verifyAdminRequest(_request)) {
      return Response.json({ error: "未授权访问" }, { status: 401 })
    }

    const target = getKnowledgeTarget()
    if (!target) {
      return Response.json({ error: "请先配置知识库资料集编号和接口密钥" }, { status: 503 })
    }

    const response = await fetch(joinUrl(target.baseUrl, `datasets/${target.datasetId}/documents/${documentId}`), {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${target.apiKey}`,
      },
    })

    if (!response.ok) {
      const detail = await parseJsonError(response)
      return Response.json({ error: detail || `删除知识资料失败 (${response.status})` }, { status: response.status })
    }

    return Response.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除知识资料失败"
    return Response.json({ error: message }, { status: 500 })
  }
}
