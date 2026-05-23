"use client"

import type { FormEvent } from "react"
import { useState } from "react"
import { Lock, Loader2 } from "lucide-react"

type AdminLoginProps = {
  configured: boolean
}

export function AdminLoginPanel({ configured }: AdminLoginProps) {
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || "登录失败")
      }
      window.location.reload()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "登录失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f6f6f4] px-4 text-[#111111]">
      <form className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.05)]" onSubmit={handleSubmit}>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#111111] text-white">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight">问兰后台登录</h1>
            <p className="text-sm text-[#666]">只有管理员可进入知识库管理。</p>
          </div>
        </div>

        {!configured ? (
          <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
            当前还没有配置后台管理密码，请先设置 <code>ADMIN_PASSWORD</code> 或 <code>KNOWLEDGE_ADMIN_PASSWORD</code>。
          </div>
        ) : null}

        <label className="mt-5 block text-sm">
          <span className="mb-2 block text-[#444]">管理密码</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-[15px] outline-none focus:border-black/30"
            placeholder="请输入管理员密码"
          />
        </label>

        {error ? <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading || !configured}
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#111111] px-4 text-sm font-medium text-white transition hover:bg-[#2f2f2f] disabled:cursor-not-allowed disabled:bg-[#888]"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          登录
        </button>
      </form>
    </div>
  )
}
