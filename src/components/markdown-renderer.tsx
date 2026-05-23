"use client"

import type { ComponentProps, ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

type MarkdownRendererProps = {
  content: string
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-3 leading-relaxed text-[#0d0d0d] last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-4 list-disc space-y-1 pl-5 text-[#0d0d0d]">{children}</ul>,
        ol: ({ children }) => <ol className="mb-4 list-decimal space-y-1 pl-5 text-[#0d0d0d]">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        h1: ({ children }) => <h1 className="mb-3 text-2xl font-semibold tracking-tight text-[#0d0d0d]">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-3 text-xl font-semibold tracking-tight text-[#0d0d0d]">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-2 text-lg font-semibold tracking-tight text-[#0d0d0d]">{children}</h3>,
        a: ({ children, href }) => (
          <a
            className="text-[#0b57d0] underline decoration-[#0b57d0]/40 underline-offset-4"
            href={href}
            target="_blank"
            rel="noreferrer"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-4 border-l-2 border-black/10 pl-4 text-[#525252]">{children}</blockquote>
        ),
        table: ({ children }) => (
          <div className="mb-4 overflow-x-auto rounded-2xl border border-black/10">
            <table className="w-full border-collapse text-left text-sm text-[#0d0d0d]">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="border-b border-black/10 bg-black/[0.03] px-3 py-2 font-medium">{children}</th>,
        td: ({ children }) => <td className="border-b border-black/[0.06] px-3 py-2 align-top">{children}</td>,
        hr: () => <hr className="my-5 border-black/10" />,
        pre: ({ children }) => (
          <pre className="mb-4 overflow-x-auto rounded-2xl border border-black/10 bg-[#f7f7f7] p-4 text-sm text-[#0d0d0d]">
            {children}
          </pre>
        ),
        code: (props) => {
          const { inline, children } = props as ComponentProps<"code"> & { inline?: boolean; children?: ReactNode }
          return inline ? (
            <code className="rounded-md bg-black/[0.05] px-1.5 py-0.5 font-mono text-[0.92em] text-[#0d0d0d]">
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
  )
}
