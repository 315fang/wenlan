import { readSettings } from "@/lib/config-store"
import { getRuntimeStatus } from "@/lib/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const status = getRuntimeStatus()
  const settings = readSettings()
  return Response.json({
    ...status,
    businessContacts: settings.businessContacts,
    businessPriceTiers: settings.businessPriceTiers,
    businessQr: settings.businessQr,
    materialItems: settings.materialItems,
  })
}
