"use client"

import type { ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { BookOpen, MessageSquare, X } from "lucide-react"

type AppSection = "chat" | "knowledge"

type AppSidebarProps = {
  active: AppSection
  sections?: AppSection[]
  children?: ReactNode
  className?: string
  footer?: ReactNode
  onClose?: () => void
}

const navItems: Array<{
  id: AppSection
  href: string
  label: string
  description: string
  icon: typeof MessageSquare
}> = [
  {
    id: "chat",
    href: "/",
    label: "智能问答",
    description: "前台对话窗口",
    icon: MessageSquare,
  },
  {
    id: "knowledge",
    href: "/admin/knowledge",
    label: "知识库管理",
    description: "资料上传与删除",
    icon: BookOpen,
  },
]

export function AppSidebar({ active, sections = ["chat", "knowledge"], children, className = "", footer, onClose }: AppSidebarProps) {
  return (
    <div className={`flex h-full flex-col border-r border-black/[0.07] bg-[#f1f1ee] ${className}`}>
      <div className="flex h-16 shrink-0 items-center justify-between px-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#111111] text-white">
            <Image
              src="/wenlan-yizhantong.ico"
              alt=""
              width={22}
              height={22}
              unoptimized
              className="h-6 w-6 rounded-sm"
            />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[17px] font-semibold tracking-normal text-[#111111]">问兰</div>
            <div className="truncate text-xs text-[#777777]">大模型系统</div>
          </div>
        </div>

        {onClose ? (
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#5f5f5f] transition hover:bg-white hover:text-[#111111] lg:hidden"
            onClick={onClose}
            type="button"
            aria-label="关闭侧边菜单"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <nav className="shrink-0 space-y-1 px-3 pb-3">
        {navItems
          .filter((item) => sections.includes(item.id))
          .map(({ id, href, label, description, icon: Icon }) => {
            const isActive = active === id
            return (
              <Link
                key={id}
                href={href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition ${
                  isActive
                    ? "bg-white text-[#111111] shadow-[0_1px_10px_rgba(0,0,0,0.04)]"
                    : "text-[#5f5f5f] hover:bg-white/70 hover:text-[#111111]"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    isActive ? "bg-[#111111] text-white" : "bg-white text-[#555555]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{label}</span>
                  <span className="block truncate text-xs text-[#888888]">{description}</span>
                </span>
              </Link>
            )
          })}
      </nav>

      <div className="min-h-0 flex-1">{children}</div>

      <div className="shrink-0 border-t border-black/[0.07] px-4 py-3 text-xs leading-5 text-[#777777]">
        {footer || "内容以最新资料为准。"}
      </div>
    </div>
  )
}

export function MobileAppSidebar({
  active,
  sections = ["chat", "knowledge"],
  children,
  footer,
  onClose,
  open,
}: Omit<AppSidebarProps, "className"> & { open: boolean; onClose: () => void }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        type="button"
        aria-label="关闭侧边菜单遮罩"
      />
      <div className="relative h-full w-[84vw] max-w-80">
        <AppSidebar active={active} sections={sections} footer={footer} onClose={onClose} className="shadow-2xl">
          {children}
        </AppSidebar>
      </div>
    </div>
  )
}
