import type { ReactNode } from "react"
import type { Metadata, Viewport } from "next"

import "./globals.css"

export const metadata: Metadata = {
  title: "问兰智能体系统",
  description: "面向咨询、素材检索和培训的问兰智能体系统",
  icons: {
    icon: "/wenlan-yizhantong.ico",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="bg-background text-foreground antialiased">{children}</body>
    </html>
  )
}
