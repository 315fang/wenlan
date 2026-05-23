"use client"

import type { ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { BookOpen, MessageSquare, X } from "lucide-react"

type AppSection = "chat" | "knowledge"

type FontSizeMode = "sm" | "md" | "lg"

type AppSidebarProps = {
  active: AppSection
  sections?: AppSection[]
  children?: ReactNode
  className?: string
  footer?: ReactNode
  onClose?: () => void
  fontSizeMode?: FontSizeMode
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

const sidebarSizeStyles = {
  sm: {
    header: "h-14 px-3.5 sm:px-4",
    logoBox: "h-9 w-9 rounded-lg",
    logoImg: 24,
    logoTitle: "text-[clamp(14px,3.8vw,16px)]",
    logoDesc: "text-[clamp(10px,2.8vw,11.5px)]",
    navItemLink: "rounded-xl px-3 py-2.5 gap-3.5",
    navItemIconBox: "h-8 w-8 rounded-lg",
    navItemIcon: "h-4 w-4",
    navItemLabel: "text-[clamp(13px,3.5vw,14.5px)]",
    navItemDesc: "text-[clamp(10.5px,2.8vw,11.5px)]",
    footerText: "px-4 py-2.5 text-[clamp(10.5px,2.8vw,11.5px)] text-center leading-normal",
    onCloseBtn: "h-8 w-8",
    onCloseIcon: "h-4 w-4",
  },
  md: {
    header: "h-16 px-4 sm:px-5",
    logoBox: "h-10 w-10 rounded-xl",
    logoImg: 28,
    logoTitle: "text-[clamp(15.5px,4.2vw,18px)]",
    logoDesc: "text-[clamp(11px,3vw,12.5px)]",
    navItemLink: "rounded-2xl px-4 py-3 gap-4",
    navItemIconBox: "h-9 w-9 rounded-xl",
    navItemIcon: "h-4.5 w-4.5",
    navItemLabel: "text-[clamp(14.5px,3.8vw,16px)]",
    navItemDesc: "text-[clamp(11.5px,3vw,13px)]",
    footerText: "px-4.5 py-3 text-[clamp(11.5px,3vw,13px)] text-center leading-normal",
    onCloseBtn: "h-9 w-9",
    onCloseIcon: "h-4.5 w-4.5",
  },
  lg: {
    header: "h-18 px-5 sm:px-6",
    logoBox: "h-12 w-12 rounded-2xl",
    logoImg: 34,
    logoTitle: "text-[clamp(17px,4.6vw,20.5px)]",
    logoDesc: "text-[clamp(12px,3.2vw,14px)]",
    navItemLink: "rounded-2xl px-5 py-3.5 gap-4.5",
    navItemIconBox: "h-11 w-11 rounded-2xl",
    navItemIcon: "h-5.5 w-5.5",
    navItemLabel: "text-[clamp(16px,4.2vw,18px)]",
    navItemDesc: "text-[clamp(12.5px,3.2vw,14.5px)]",
    footerText: "px-5 py-4 text-[clamp(12.5px,3.2vw,14.5px)] text-center leading-normal",
    onCloseBtn: "h-11 w-11",
    onCloseIcon: "h-5.5 w-5.5",
  },
}

export function AppSidebar({
  active,
  sections = ["chat", "knowledge"],
  children,
  className = "",
  footer,
  onClose,
  fontSizeMode = "md",
}: AppSidebarProps) {
  const sizes = sidebarSizeStyles[fontSizeMode]

  return (
    <div className={`flex h-full flex-col border-r border-black/[0.07] bg-[#f1f1ee] ${className}`}>
      <div className={`flex shrink-0 items-center justify-between ${sizes.header}`}>
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex shrink-0 items-center justify-center bg-[#111111] text-white ${sizes.logoBox}`}>
            <Image
              src="/wenlan-yizhantong.ico"
              alt=""
              width={sizes.logoImg}
              height={sizes.logoImg}
              unoptimized
              className="rounded-sm object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className={`truncate font-semibold tracking-normal text-[#111111] ${sizes.logoTitle}`}>问兰</div>
            <div className={`truncate text-[#777777] ${sizes.logoDesc}`}>大模型系统</div>
          </div>
        </div>

        {onClose ? (
          <button
            className={`inline-flex items-center justify-center rounded-full text-[#5f5f5f] transition hover:bg-white hover:text-[#111111] lg:hidden ${sizes.onCloseBtn}`}
            onClick={onClose}
            type="button"
            aria-label="关闭侧边菜单"
          >
            <X className={sizes.onCloseIcon} />
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
                className={`flex items-center transition ${sizes.navItemLink} ${
                  isActive
                    ? "bg-white text-[#111111] shadow-[0_1px_10px_rgba(0,0,0,0.04)]"
                    : "text-[#5f5f5f] hover:bg-white/70 hover:text-[#111111]"
                }`}
              >
                <span
                  className={`flex shrink-0 items-center justify-center ${sizes.navItemIconBox} ${
                    isActive ? "bg-[#111111] text-white" : "bg-white text-[#555555]"
                  }`}
                >
                  <Icon className={sizes.navItemIcon} />
                </span>
                <span className="min-w-0">
                  <span className={`block truncate font-medium ${sizes.navItemLabel}`}>{label}</span>
                  <span className={`block truncate text-[#888888] ${sizes.navItemDesc}`}>{description}</span>
                </span>
              </Link>
            )
          })}
      </nav>

      <div className="min-h-0 flex-1">{children}</div>

      <div className={`shrink-0 border-t border-black/[0.07] text-[#777777] ${sizes.footerText}`}>
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
  fontSizeMode = "md",
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
      <div className="relative h-full w-[85vw] max-w-[34rem]">
        <AppSidebar active={active} sections={sections} footer={footer} onClose={onClose} className="shadow-2xl" fontSizeMode={fontSizeMode}>
          {children}
        </AppSidebar>
      </div>
    </div>
  )
}
