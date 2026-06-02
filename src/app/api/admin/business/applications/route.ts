import { verifyAdminRequest } from "@/lib/admin-auth"
import { readCooperationApplications } from "@/lib/business-applications"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!verifyAdminRequest(request)) {
    return Response.json({ error: "未授权" }, { status: 401 })
  }

  return Response.json({
    applications: readCooperationApplications(),
  })
}
