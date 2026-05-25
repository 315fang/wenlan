import type { ReactNode } from "react"
import type { Metadata, Viewport } from "next"

import "./globals.css"

export const metadata: Metadata = {
  title: "问兰 · WENLAN",
  description: "问兰智能体系统 - 面向客户咨询和商务联系的智能体平台",
  manifest: "/manifest.json",
  icons: {
    icon: "/wenlan-yizhantong.ico",
    apple: "/wenlan-yizhantong.ico",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1a1410",
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="bg-background text-foreground antialiased">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if("serviceWorker" in navigator){window.addEventListener("load",()=>{navigator.serviceWorker.register("/sw.js").catch(()=>{})})}`,
          }}
        />
      </body>
    </html>
  )
}
