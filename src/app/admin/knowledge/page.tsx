import type { Metadata } from "next"

import { AdminLoginPanel } from "@/components/admin-login"
import { KnowledgeAdminPanel } from "@/components/knowledge-admin"
import { isAdminConfigured, verifyAdminSessionCookie } from "@/lib/admin-auth"

export const metadata: Metadata = {
  title: "问兰知识库管理",
  description: "上传、删除和维护问兰知识库资料",
}

export default async function KnowledgePage() {
  const configured = isAdminConfigured()
  const authed = configured ? await verifyAdminSessionCookie() : false

  if (!authed) {
    return <AdminLoginPanel configured={configured} />
  }

  return <KnowledgeAdminPanel />
}
