"use client"

/* eslint-disable @next/next/no-img-element */

import React, { ComponentProps, ReactNode } from "react"
import { useState, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ShoppingBag, ExternalLink } from "lucide-react"

type MarkdownRendererProps = {
  content: string
}

interface Product {
  name: string
  price: string
  image: string
  link: string
  desc: string
}

// 辅助解析：从文本行块中提取商品字段
function parseProductBlockText(text: string): Product | null {
  const urlMatch = text.match(/https?:\/\/[^\s\)]+?\/[a-zA-Z0-9_-]*urllink[^\s\)]*?(?:id|product_id)=\d+[^\s\)]*/i)
  if (!urlMatch) return null
  const link = urlMatch[0]

  const lines = text.split("\n")
  let name = ""
  let price = ""
  let image = ""
  let desc = ""

  for (const line of lines) {
    const cleanLine = line.replace(/^[-*•\s+]+/g, "").trim()
    if (!cleanLine) continue

    const nameMatch = cleanLine.match(/^(?:名称|商品|品名|Title|Name|name)\s*[:：]\s*(.*)$/i)
    const priceMatch = cleanLine.match(/^(?:价格|售价|Price|price)\s*[:：]\s*(.*)$/i)
    const imageMatch = cleanLine.match(/^(?:图片|图样|Image|image|pic|img)\s*[:：]\s*(.*)$/i)
    const descMatch = cleanLine.match(/^(?:描述|详情|介绍|文案|Desc|desc|description)\s*[:：]\s*(.*)$/i)

    if (nameMatch) {
      name = nameMatch[1].trim()
    } else if (priceMatch) {
      price = priceMatch[1].trim()
    } else if (imageMatch) {
      const imgVal = imageMatch[1].trim()
      if (imgVal.startsWith("http") || imgVal.startsWith("/")) {
        image = imgVal
      }
    } else if (descMatch) {
      desc = descMatch[1].trim()
    } else {
      // 兜底：如果不是属性关键字，但是加粗文本，可能是商品名
      const boldMatch = cleanLine.match(/^\*\*([^*]+)\*\*$/)
      if (boldMatch) {
        name = boldMatch[1].trim()
      } else if (!cleanLine.startsWith("http") && !name && cleanLine.length < 50 && !cleanLine.includes("：") && !cleanLine.includes(":")) {
        name = cleanLine
      }
    }
  }

  // 去除可能的引号
  name = name.replace(/^[“"‘']|[”"’']$/g, "")
  desc = desc.replace(/^[“"‘']|[”"’']$/g, "")

  return { name, price, image, link, desc }
}

// 预处理函数：将 markdown 中包含 urllink 的普通列表/文本段落转化为 ```product 代码块
function preprocessMarkdown(content: string): string {
  if (!content) return content

  const urlRegex = /https?:\/\/[^\s\)]+?\/[a-zA-Z0-9_-]*urllink[^\s\)]*?(?:id|product_id)=\d+[^\s\)]*/gi
  const matches = Array.from(content.matchAll(urlRegex))
  if (matches.length === 0) return content

  const lines = content.split("\n")
  const lineProductIds = new Array(lines.length).fill(-1)

  matches.forEach((match, matchIdx) => {
    const matchStr = match[0]
    const lineIdx = lines.findIndex(l => l.includes(matchStr))
    if (lineIdx === -1) return

    // 向上扫描确定商品块的起始行
    let startIdx = lineIdx
    while (startIdx > 0) {
      const prevLine = lines[startIdx - 1].trim()
      if (prevLine === "") break
      if (prevLine.startsWith("#")) break
      if (prevLine.match(/[a-zA-Z0-9_-]*urllink/i)) break
      startIdx--
    }

    // 向下扫描确定商品块的结束行
    let endIdx = lineIdx
    while (endIdx < lines.length - 1) {
      const nextLine = lines[endIdx + 1].trim()
      if (nextLine === "") break
      if (nextLine.startsWith("#")) break
      if (nextLine.match(/[a-zA-Z0-9_-]*urllink/i)) break
      if (nextLine.match(/^[-*•]\s+\*\*[^*]+\*\*$/)) break
      endIdx++
    }

    for (let i = startIdx; i <= endIdx; i++) {
      if (lineProductIds[i] === -1) {
        lineProductIds[i] = matchIdx
      }
    }
  })

  const newLines: string[] = []
  let currentProductId = -1
  let currentProductLines: string[] = []

  const flushProduct = () => {
    if (currentProductLines.length > 0) {
      const text = currentProductLines.join("\n")
      const parsed = parseProductBlockText(text)
      if (parsed && parsed.link) {
        newLines.push("\n```product")
        newLines.push(`名称: ${parsed.name}`)
        newLines.push(`价格: ${parsed.price}`)
        newLines.push(`图片: ${parsed.image}`)
        newLines.push(`链接: ${parsed.link}`)
        newLines.push(`描述: ${parsed.desc}`)
        newLines.push("```\n")
      } else {
        newLines.push(...currentProductLines)
      }
      currentProductLines = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const pId = lineProductIds[i]
    if (pId !== currentProductId) {
      flushProduct()
      currentProductId = pId
    }

    if (pId !== -1) {
      currentProductLines.push(lines[i])
    } else {
      newLines.push(lines[i])
    }
  }
  flushProduct()

  return newLines.join("\n")
}

function parseProducts(text: string): Product[] {
  const blocks = text.split(/(?:\n|^)---\s*(?:\n|$)/)
  const products: Product[] = []

  for (const block of blocks) {
    if (!block.trim()) continue
    const lines = block.split("\n")
    const item: Partial<Product> = {}

    for (const line of lines) {
      const nameMatch = line.match(/^\s*(?:名称|商品|品名|Title|Name|name)\s*[:：]\s*(.*)$/i)
      if (nameMatch) {
        item.name = nameMatch[1].trim()
        continue
      }
      const priceMatch = line.match(/^\s*(?:价格|售价|Price|price)\s*[:：]\s*(.*)$/i)
      if (priceMatch) {
        item.price = priceMatch[1].trim()
        continue
      }
      const imageMatch = line.match(/^\s*(?:图片|图样|Image|image|pic|img)\s*[:：]\s*(.*)$/i)
      if (imageMatch) {
        item.image = imageMatch[1].trim()
        continue
      }
      const linkMatch = line.match(/^\s*(?:链接|购买|网址|Link|link|url|href)\s*[:：]\s*(.*)$/i)
      if (linkMatch) {
        item.link = linkMatch[1].trim()
        continue
      }
      const descMatch = line.match(/^\s*(?:描述|详情|介绍|Desc|desc|description)\s*[:：]\s*(.*)$/i)
      if (descMatch) {
        item.desc = descMatch[1].trim()
        continue
      }
    }

    if (item.name || item.link) {
      products.push({
        name: item.name || "",
        price: item.price || "",
        image: item.image || "",
        link: item.link || "",
        desc: item.desc || "",
      })
    }
  }

  return products
}

function ProductCard({ product: initialProduct }: { product: Product }) {
  const [product, setProduct] = useState<Product>(initialProduct)
  const [imgError, setImgError] = useState(false)
  const [loading, setLoading] = useState(false)

  // 使用 render-phase state synchronization 避免 effect 中的同步 setState 报错
  const [prevProductImage, setPrevProductImage] = useState(product.image)
  if (product.image !== prevProductImage) {
    setPrevProductImage(product.image)
    setImgError(false)
  }

  useEffect(() => {
    const isUrllink = initialProduct.link && (initialProduct.link.includes("/urllink") || initialProduct.link.includes("urllink"))
    if (!isUrllink) return

    let active = true
    const detailUrl = initialProduct.link.replace(/\/urllink(\?|$)/i, "/detail$1")

    // 使用异步微任务包裹，避免在 effect 主体中同步触发 setState
    const fetchDetails = async () => {
      await Promise.resolve()
      if (!active) return
      setLoading(true)
      try {
        const res = await fetch(detailUrl)
        const json = await res.json()
        if (active && json.code === 0 && json.data) {
          setProduct(prev => ({
            ...prev,
            name: json.data.name || prev.name || "未命名商品",
            price: json.data.price || prev.price,
            image: json.data.image || prev.image,
            desc: json.data.desc || prev.desc,
            link: json.data.link || prev.link
          }))
        }
      } catch (err) {
        console.error("Failed to load product details:", err)
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchDetails()

    return () => {
      active = false
    }
  }, [initialProduct])

  if (loading && !product.name) {
    return (
      <div className="flex gap-4 p-4 rounded-2xl border border-[#cad8d1]/60 bg-white/90 shadow-[0_2px_12px_-3px_rgba(26,20,16,0.04)] animate-pulse">
        <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl bg-[#e4ece6]/40"></div>
        <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
          <div>
            <div className="h-4 bg-[#e4ece6]/60 rounded w-2/3 mb-2"></div>
            <div className="h-3 bg-[#e4ece6]/40 rounded w-full mb-1"></div>
            <div className="h-3 bg-[#e4ece6]/40 rounded w-4/5"></div>
          </div>
          <div className="flex justify-end mt-2">
            <div className="w-16 h-7 bg-[#6b8e7f]/20 rounded-full"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-4 p-4 rounded-2xl border border-[#cad8d1]/60 bg-white/90 shadow-[0_2px_12px_-3px_rgba(26,20,16,0.04)] transition-all duration-300 hover:shadow-[0_6px_20px_-4px_rgba(26,20,16,0.08)] hover:-translate-y-0.5 select-text">
      {product.image && !imgError ? (
        <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl overflow-hidden bg-[#e4ece6]/30 border border-[#cad8d1]/30 flex items-center justify-center relative">
          {loading && <div className="absolute inset-0 bg-[#e4ece6]/30 animate-pulse" />}
          <img
            src={product.image}
            alt={product.name}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl bg-[#e4ece6]/30 border border-[#cad8d1]/30 flex items-center justify-center text-mute relative">
          {loading ? (
            <div className="absolute inset-0 bg-[#e4ece6]/40 animate-pulse rounded-xl" />
          ) : (
            <ShoppingBag size={24} className="opacity-40" />
          )}
        </div>
      )}
      
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <div className="flex items-start justify-between gap-3 min-w-0">
            <h4 className="font-semibold text-ink text-[15.5px] font-serif leading-snug break-words flex-1">{product.name || "加载中..."}</h4>
            {product.price && (
              <span className="text-[14.5px] font-bold text-[#6b8e7f] shrink-0 font-sans">{product.price}</span>
            )}
          </div>
          {product.desc && (
            <p className="text-xs text-[#525252] mt-1.5 line-clamp-2 leading-[1.6]">{product.desc}</p>
          )}
        </div>
        
        {product.link && (
          <div className="mt-2.5 flex justify-end">
            <a
              href={product.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#6b8e7f] hover:bg-[#5d7c6f] text-white text-xs font-semibold tracking-wide transition-all duration-200 shadow-sm hover:shadow active:scale-[0.97]"
            >
              <span>立即选购</span>
              <ExternalLink size={10} className="opacity-80" />
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

function ProductListBlock({ text }: { text: string }) {
  const products = parseProducts(text)
  if (products.length === 0) {
    return <pre className="my-2 max-w-full overflow-x-auto rounded-xl border border-black/10 bg-[#f7f7f7] p-3 text-xs font-mono">{text}</pre>
  }

  return (
    <div className="my-4 space-y-3 w-full">
      {products.map((product, i) => (
        <ProductCard key={i} product={product} />
      ))}
    </div>
  )
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const processedContent = preprocessMarkdown(content)

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3.5 min-w-0 break-words leading-relaxed text-ink last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-4 min-w-0 list-disc space-y-2 pl-5 break-words text-ink">{children}</ul>,
          ol: ({ children }) => <ol className="mb-4 min-w-0 list-decimal space-y-2 pl-5 break-words text-ink">{children}</ol>,
          li: ({ children }) => <li className="min-w-0 break-words leading-relaxed">{children}</li>,
          h1: ({ children }) => <h1 className="mb-3.5 min-w-0 break-words text-[1.4em] font-bold leading-[1.3] tracking-tight text-ink">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-3 min-w-0 break-words text-[1.25em] font-semibold leading-[1.35] tracking-tight text-ink">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-2.5 min-w-0 break-words text-[1.15em] font-semibold leading-[1.4] tracking-tight text-ink">{children}</h3>,
          a: ({ children, href }) => (
            <a
              className="break-words text-[#0b57d0] underline decoration-[#0b57d0]/40 underline-offset-4"
              href={href}
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </a>
          ),
          img: ({ src, alt }) => (
            <img
              src={typeof src === "string" ? src : undefined}
              alt={alt || ""}
              loading="lazy"
              className="my-3 block h-auto max-w-full rounded-2xl border border-black/10 bg-[#f7f7f7] object-contain"
            />
          ),
          blockquote: ({ children }) => (
            <blockquote className="mb-4 min-w-0 break-words border-l-2 border-black/10 pl-4 text-[#525252]">{children}</blockquote>
          ),
          table: ({ children }) => (
            <div className="mb-4 max-w-full overflow-x-auto rounded-2xl border border-black/10">
              <table className="w-full border-collapse text-left text-sm text-ink">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border-b border-black/10 bg-black/[0.03] px-3 py-2 font-medium">{children}</th>,
          td: ({ children }) => <td className="border-b border-black/[0.06] px-3 py-2 align-top">{children}</td>,
          hr: () => <hr className="my-5 border-black/10" />,
          pre: ({ children, node }) => {
            const firstChild = node?.children?.[0]
            const isProduct = firstChild && 
              firstChild.type === "element" && 
              "tagName" in firstChild && 
              firstChild.tagName === "code" && 
              (() => {
                const className = ("properties" in firstChild && (firstChild as { properties?: { className?: string[] } }).properties?.className) || []
                const classList = Array.isArray(className) ? className : [className]
                return classList.some(cls => 
                  cls === "language-product" || cls === "language-products" || cls === "language-goods" || cls === "language-commodity"
                )
              })()

            if (isProduct) {
              return <>{children}</>
            }

            return (
              <pre className="mb-4 max-w-full overflow-x-auto rounded-2xl border border-black/10 bg-[#f7f7f7] p-4 text-sm text-ink">
                {children}
              </pre>
            )
          },
          code: (props) => {
            const { inline, className, children } = props as ComponentProps<"code"> & { inline?: boolean; className?: string; children?: ReactNode }
            const match = /language-(\w+)/.exec(className || "")
            const lang = match ? match[1] : ""

            if (lang === "product" || lang === "products" || lang === "goods" || lang === "commodity") {
              const textContent = String(children).trim()
              return <ProductListBlock text={textContent} />
            }

            return inline ? (
              <code className="break-words rounded-md bg-black/[0.05] px-1.5 py-0.5 font-mono text-[0.92em] text-ink">
                {children}
              </code>
            ) : (
              <code className="font-mono text-ink">{children}</code>
            )
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}
