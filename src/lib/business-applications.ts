import fs from "fs"
import path from "path"

import type { CooperationApplication } from "@/types/settings"

const DATA_DIR = path.join(process.cwd(), "data")
const APPLICATIONS_FILE = path.join(DATA_DIR, "business-applications.json")

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function safeString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function readCooperationApplications(): CooperationApplication[] {
  try {
    if (!fs.existsSync(APPLICATIONS_FILE)) return []
    const parsed = JSON.parse(fs.readFileSync(APPLICATIONS_FILE, "utf-8")) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => item as Partial<CooperationApplication>)
      .filter((item) => item.id && item.name && item.contact)
      .map((item) => ({
        id: String(item.id),
        name: String(item.name),
        city: safeString(item.city),
        contact: String(item.contact),
        note: safeString(item.note),
        createdAt: safeString(item.createdAt) || new Date().toISOString(),
        status: item.status === "contacted" || item.status === "closed" ? item.status : "new",
      }))
  } catch {
    return []
  }
}

export function createCooperationApplication(input: {
  name: string
  city?: string
  contact: string
  note?: string
}) {
  const now = new Date().toISOString()
  const application: CooperationApplication = {
    id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name.trim(),
    city: input.city?.trim() || "",
    contact: input.contact.trim(),
    note: input.note?.trim() || "",
    createdAt: now,
    status: "new",
  }

  const applications = [application, ...readCooperationApplications()].slice(0, 500)
  ensureDataDir()
  fs.writeFileSync(APPLICATIONS_FILE, JSON.stringify(applications, null, 2), "utf-8")
  return application
}
