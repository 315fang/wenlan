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
    header: "h-30 px-6",
    logoBox: "h-19 w-19 rounded-xl",
    logoImg: 40,
    logoTitle: "text-[32px]",
    logoDesc: "text-[22px]",
    navItemLink: "rounded-[1.4rem] px-6 py-4.5 gap-6",
    navItemIconBox: "h-17.5 w-17.5 rounded-xl",
    navItemIcon: "h-8 w-8",
    navItemLabel: "text-[26px]",
    navItemDesc: "text-[22px]",
    footerText: "px-5 py-3.5 text-[16px] text-center leading-normal",
    onCloseBtn: "h-17.5 w-17.5",
    onCloseIcon: "h-9 w-9",
  },
  md: {
    header: "h-35 px-7.5",
    logoBox: "h-22.5 w-22.5 rounded-[2.2rem]",
    logoImg: 49,
    logoTitle: "text-[37.5px]",
    logoDesc: "text-[25px]",
    navItemLink: "rounded-[2.2rem] px-7.5 py-6 gap-7.5",
    navItemIconBox: "h-20 w-20 rounded-[2.2rem]",
    navItemIcon: "h-9.5 w-9.5",
    navItemLabel: "text-[31px]",
    navItemDesc: "text-[25px]",
    footerText: "px-6 py-4.5 text-[19px] text-center leading-normal",
    onCloseBtn: "h-20 w-20",
    onCloseIcon: "h-11 w-11",
  },
  lg: {
    header: "h-42.5 px-8.5",
    logoBox: "h-26 w-26 rounded-[2.6rem]",
    logoImg: 60,
    logoTitle: "text-[45px]",
    logoDesc: "text-[31px]",
    navItemLink: "rounded-[2.6rem] px-9 py-7.5 gap-9",
    navItemIconBox: "h-25 w-25 rounded-[2.6rem]",
    navItemIcon: "h-12 w-12",
    navItemLabel: "text-[39px]",
    navItemDesc: "text-[31px]",
    footerText: "px-8 py-6 text-[24px] text-center leading-normal",
    onCloseBtn: "h-25 w-25",
    onCloseIcon: "h-14 w-14",
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
