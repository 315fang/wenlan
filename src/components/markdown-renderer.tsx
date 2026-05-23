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
        p: ({ children }) => <p className="mb-3 leading-7 text-slate-100/95 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-4 list-disc space-y-1 pl-5 text-slate-100/95">{children}</ul>,
        ol: ({ children }) => <ol className="mb-4 list-decimal space-y-1 pl-5 text-slate-100/95">{children}</ol>,
        li: ({ children }) => <li className="leading-7">{children}</li>,
        h1: ({ children }) => <h1 className="mb-3 text-2xl font-semibold tracking-tight text-white">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-3 text-xl font-semibold tracking-tight text-white">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-2 text-lg font-semibold tracking-tight text-white">{children}</h3>,
        a: ({ children, href }) => (
          <a className="text-cyan-300 underline decoration-cyan-400/60 underline-offset-4" href={href} target="_blank" rel="noreferrer">
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-4 border-l-2 border-cyan-400/60 pl-4 text-slate-200/90">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="mb-4 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full border-collapse text-left text-sm text-slate-100">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="border-b border-white/10 bg-white/5 px-3 py-2 font-medium text-slate-200">{children}</th>,
        td: ({ children }) => <td className="border-b border-white/5 px-3 py-2 align-top text-slate-100/90">{children}</td>,
        hr: () => <hr className="my-5 border-white/10" />,
        pre: ({ children }) => (
          <pre className="mb-4 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/95 p-4 text-sm text-slate-100">
            {children}
          </pre>
        ),
        code: (props) => {
          const { inline, children } = props as ComponentProps<"code"> & { inline?: boolean; children?: ReactNode }
          return inline ? (
            <code className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[0.92em] text-cyan-200">{children}</code>
          ) : (
            <code className="font-mono text-slate-100">{children}</code>
          )
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
