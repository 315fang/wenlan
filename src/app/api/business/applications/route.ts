import { createCooperationApplication } from "@/lib/business-applications"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const name = asString(body.name)
    const contact = asString(body.contact)
    const city = asString(body.city)
    const note = asString(body.note)

    if (!name || !contact) {
      return Response.json({ error: "请填写姓名和微信 / 电话" }, { status: 400 })
    }

    const application = createCooperationApplication({ name, contact, city, note })
    return Response.json({ ok: true, application })
  } catch {
    return Response.json({ error: "提交合作申请失败" }, { status: 500 })
  }
}
