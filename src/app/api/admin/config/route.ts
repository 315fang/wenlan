import type { AppSettings } from "@/types/settings"
import { readSettings, writeSettings } from "@/lib/config-store"
import { verifyAdminRequest } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!verifyAdminRequest(request)) {
    return Response.json({ error: "未授权" }, { status: 401 })
  }

  const settings = readSettings()
  return Response.json(settings)
}

export async function PUT(request: Request) {
  if (!verifyAdminRequest(request)) {
    return Response.json({ error: "未授权" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as Record<string, unknown>
    const updated = writeSettings(body as Partial<AppSettings>)
    return Response.json({ ok: true, settings: updated })
  } catch {
    return Response.json({ error: "保存配置失败" }, { status: 500 })
  }
}
