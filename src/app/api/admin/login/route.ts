import { buildAdminCookieValue, buildLogoutCookieValue, getAdminPassword } from "@/lib/admin-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const password = getAdminPassword()
  if (!password) {
    return Response.json({ error: "请先配置后台管理密码" }, { status: 503 })
  }

  const payload = (await request.json().catch(() => ({}))) as { password?: string }
  if ((payload.password || "").trim() !== password) {
    return Response.json({ error: "密码不正确" }, { status: 401 })
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": buildAdminCookieValue(),
    },
  })
}

export async function DELETE() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": buildLogoutCookieValue(),
    },
  })
}
