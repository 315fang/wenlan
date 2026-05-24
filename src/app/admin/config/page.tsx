import type { Metadata } from "next"

import { AdminLoginPanel } from "@/components/admin-login"
import { AdminConfigPanel } from "@/components/admin-config"
import { isAdminConfigured, verifyAdminSessionCookie } from "@/lib/admin-auth"

export const metadata: Metadata = {
  title: "系统配置",
  description: "管理问兰智能体系统的前台文案、提示词和后端默认地址",
}

export default async function ConfigPage() {
  const configured = isAdminConfigured()
  const authed = configured ? await verifyAdminSessionCookie() : false

  if (!authed) {
    return <AdminLoginPanel configured={configured} />
  }

  return <AdminConfigPanel />
}
