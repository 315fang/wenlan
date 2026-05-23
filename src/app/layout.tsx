import type { ReactNode } from "react"
import type { Metadata } from "next"

import "./globals.css"

export const metadata: Metadata = {
  title: "问兰 AI Portal",
  description: "面向后台操作、培训和答疑的内部 AI 工作台",
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="bg-background text-foreground antialiased">{children}</body>
    </html>
  )
}
