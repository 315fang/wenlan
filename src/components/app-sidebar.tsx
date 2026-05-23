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
    header: "h-19 px-4",
    logoBox: "h-12 w-12 rounded-xl",
    logoImg: 26,
    logoTitle: "text-[20.5px]",
    logoDesc: "text-[14px]",
    navItemLink: "rounded-2xl px-4 py-3 gap-4",
    navItemIconBox: "h-11 w-11 rounded-xl",
    navItemIcon: "h-5 w-5",
    navItemLabel: "text-[16.5px]",
    navItemDesc: "text-[14px]",
    footerText: "px-5 py-3.5 text-[14px] leading-5",
    onCloseBtn: "h-11 w-11",
    onCloseIcon: "h-6 w-6",
  },
  md: {
    header: "h-24 px-5",
    logoBox: "h-14.5 w-14.5 rounded-[1.4rem]",
    logoImg: 31,
    logoTitle: "text-[24px]",
    logoDesc: "text-[16px]",
    navItemLink: "rounded-[1.4rem] px-5 py-4 gap-5",
    navItemIconBox: "h-13 w-13 rounded-[1.4rem]",
    navItemIcon: "h-6 w-6",
    navItemLabel: "text-[19.5px]",
    navItemDesc: "text-[16px]",
    footerText: "px-6 py-5 text-[17.5px] leading-6",
    onCloseBtn: "h-13 w-13",
    onCloseIcon: "h-7 w-7",
  },
  lg: {
    header: "h-28 px-6",
    logoBox: "h-17 w-17 rounded-[1.7rem]",
    logoImg: 38,
    logoTitle: "text-[29px]",
    logoDesc: "text-[20px]",
    navItemLink: "rounded-[1.7rem] px-6 py-5 gap-6",
    navItemIconBox: "h-16 w-16 rounded-[1.7rem]",
    navItemIcon: "h-7.5 w-7.5",
    navItemLabel: "text-[25px]",
    navItemDesc: "text-[20px]",
    footerText: "px-7.5 py-6 text-[21px] leading-7",
    onCloseBtn: "h-16 w-16",
    onCloseIcon: "h-8.5 w-8.5",
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
      <div className="relative h-full w-[84vw] max-w-80">
        <AppSidebar active={active} sections={sections} footer={footer} onClose={onClose} className="shadow-2xl" fontSizeMode={fontSizeMode}>
          {children}
        </AppSidebar>
      </div>
    </div>
  )
}
