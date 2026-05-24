"use client"

/* eslint-disable @next/next/no-img-element */

import type { ComponentProps, ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

type MarkdownRendererProps = {
  content: string
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="min-w-0 max-w-full overflow-x-hidden">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3.5 min-w-0 break-words leading-relaxed text-[#0d0d0d] last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-4 min-w-0 list-disc space-y-2 pl-5 break-words text-[#0d0d0d]">{children}</ul>,
          ol: ({ children }) => <ol className="mb-4 min-w-0 list-decimal space-y-2 pl-5 break-words text-[#0d0d0d]">{children}</ol>,
          li: ({ children }) => <li className="min-w-0 break-words leading-relaxed">{children}</li>,
          h1: ({ children }) => <h1 className="mb-3.5 min-w-0 break-words text-[1.4em] font-bold leading-[1.3] tracking-tight text-[#0d0d0d]">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-3 min-w-0 break-words text-[1.25em] font-semibold leading-[1.35] tracking-tight text-[#0d0d0d]">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-2.5 min-w-0 break-words text-[1.15em] font-semibold leading-[1.4] tracking-tight text-[#0d0d0d]">{children}</h3>,
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
              <table className="w-full border-collapse text-left text-sm text-[#0d0d0d]">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border-b border-black/10 bg-black/[0.03] px-3 py-2 font-medium">{children}</th>,
          td: ({ children }) => <td className="border-b border-black/[0.06] px-3 py-2 align-top">{children}</td>,
          hr: () => <hr className="my-5 border-black/10" />,
          pre: ({ children }) => (
            <pre className="mb-4 max-w-full overflow-x-auto rounded-2xl border border-black/10 bg-[#f7f7f7] p-4 text-sm text-[#0d0d0d]">
              {children}
            </pre>
          ),
          code: (props) => {
            const { inline, children } = props as ComponentProps<"code"> & { inline?: boolean; children?: ReactNode }
            return inline ? (
              <code className="break-words rounded-md bg-black/[0.05] px-1.5 py-0.5 font-mono text-[0.92em] text-[#0d0d0d]">
                {children}
              </code>
            ) : (
              <code className="font-mono text-[#0d0d0d]">{children}</code>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
