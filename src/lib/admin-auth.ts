import { createHash, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

export const ADMIN_SESSION_COOKIE = "wenlan-admin-session"
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

function readEnv(name: string) {
  return process.env[name]?.trim() || ""
}

export function getAdminPassword() {
  return readEnv("ADMIN_PASSWORD") || readEnv("KNOWLEDGE_ADMIN_PASSWORD") || "wenlanhufu"
}

export function isAdminConfigured() {
  return Boolean(getAdminPassword())
}

function signPayload(payload: string) {
  const password = getAdminPassword()
  return createHash("sha256").update(`${payload}.${password}`).digest("hex")
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}

export function createAdminSessionValue() {
  const issuedAt = String(Date.now())
  return `${issuedAt}.${signPayload(issuedAt)}`
}

export function verifyAdminSessionValue(token: string) {
  const password = getAdminPassword()
  if (!password) return false

  const [issuedAt, signature] = token.split(".")
  if (!issuedAt || !signature) return false
  if (!/^\d+$/.test(issuedAt)) return false
  const issuedAtNumber = Number(issuedAt)
  if (!Number.isFinite(issuedAtNumber)) return false
  if (Date.now() - issuedAtNumber > SESSION_TTL_MS) return false

  const expected = signPayload(issuedAt)
  return safeCompare(signature, expected)
}

function readCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return ""
  const parts = cookieHeader.split(";")
  for (const part of parts) {
    const [key, ...valueParts] = part.trim().split("=")
    if (key === name) {
      return decodeURIComponent(valueParts.join("="))
    }
  }
  return ""
}

export function verifyAdminRequest(request: Request) {
  return verifyAdminSessionValue(readCookieValue(request.headers.get("cookie"), ADMIN_SESSION_COOKIE))
}

export async function verifyAdminSessionCookie() {
  const store = await cookies()
  return verifyAdminSessionValue(store.get(ADMIN_SESSION_COOKIE)?.value || "")
}

export function buildAdminCookieValue() {
  return `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(createAdminSessionValue())}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
}

export function buildLogoutCookieValue() {
  return `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
}
