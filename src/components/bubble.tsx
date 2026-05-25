"use client"

import { Check, Copy, BrainCircuit, ChevronDown, ChevronUp } from "lucide-react"
import { useState, useEffect } from "react"

import { BrandMark } from "@/components/brand-mark"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import type { ChatAttachment, ChatMessage } from "@/types/chat"

interface BubbleProps {
  message: ChatMessage
  copiedMessageId: string
  onCopy: (content: string, messageId: string) => void
}

function ThinkingBlock({
  thought,
  isThinking,
}: {
  thought: string
  isThinking: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(isThinking)

  const [prevIsThinkingInBlock, setPrevIsThinkingInBlock] = useState(isThinking)
  if (isThinking !== prevIsThinkingInBlock) {
    setPrevIsThinkingInBlock(isThinking)
    setIsExpanded(isThinking)
  }

  if (!isThinking && !thought) return null

  return (
    <div className="mb-4 rounded-xl border border-line bg-cream/15 p-3 text-sm">
      <div
        className="flex cursor-pointer items-center justify-between select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 text-mute font-medium">
          <BrainCircuit className={`h-4.5 w-4.5 ${isThinking ? "animate-pulse text-[#6b8e7f]" : "text-mute"}`} />
          <span style={{ fontSize: 13.5 }}>
            {isThinking
              ? "问小兰正在深度思考中..."
              : "已思考完成"}
          </span>
        </div>
        <button className="text-mute hover:text-ink transition-colors">
          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {isThinking && (
        <div className="relative mt-2.5 h-0.5 w-full overflow-hidden rounded-full bg-cream">
          <div className="absolute top-0 h-full w-2/5 rounded-full bg-[#6b8e7f] animate-progress-slide"></div>
        </div>
      )}

      {isExpanded && (
        <div className="mt-2.5 overflow-x-auto border-t border-line/40 pt-2.5 font-mono text-[13px] leading-relaxed text-ink-soft whitespace-pre-wrap">
          {thought ? (
            thought
          ) : (
            <span className="italic text-mute">正在整理思路...</span>
          )}
        </div>
      )}
    </div>
  )
}

export function Bubble({ message, copiedMessageId, onCopy }: BubbleProps) {
  const [imgError, setImgError] = useState<Set<string>>(new Set())
  const [wasThinking, setWasThinking] = useState(false)
  const [realized, setRealized] = useState(false)

  const isUser = message.role === "user"
  const isPending = message.status === "pending" && !message.content
  const isError = message.status === "error"
  const attachments = message.attachments ?? []
  const hasAttachments = attachments.length > 0
  const hasContent = Boolean(message.content.trim())

  const isThinking = message.isThinking ?? (message.role === "assistant" && message.status === "pending" && !message.content)

  const [prevIsThinking, setPrevIsThinking] = useState(isThinking)
  if (isThinking !== prevIsThinking) {
    setPrevIsThinking(isThinking)
    if (isThinking) {
      setWasThinking(true)
    } else if (wasThinking) {
      setWasThinking(false)
      setRealized(true)
    }
  }

  useEffect(() => {
    if (realized) {
      const timer = setTimeout(() => {
        setRealized(false)
      }, 1200)
      return () => clearTimeout(timer)
    }
  }, [realized])

  if (isUser) {
    return (
      <div className="flex justify-end px-1 md:px-0">
        <div
          className="max-w-[78%] rounded-[20px] rounded-tr-[6px] px-5 py-3"
          style={{
            background: "linear-gradient(135deg, var(--color-rose-soft) 0%, var(--color-champagne-soft) 100%)",
            color: "var(--color-ink)",
            fontSize: 15,
            lineHeight: 1.7,
            letterSpacing: "0.01em",
            boxShadow: "0 1px 0 color-mix(in srgb, var(--color-champagne), transparent 82%)",
          }}
        >
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 px-1 md:px-0">
      <div className="shrink-0 mt-1">
        <BrandMark size={32} />
      </div>
      <div className="flex-1 min-w-0 group">
        <div
          className="font-serif mb-1.5 flex items-center gap-2"
          style={{ color: "var(--color-mute)", fontSize: 13, letterSpacing: "0.12em" }}
        >
          <span>问小兰 · 智能客服</span>
          {isThinking && (
            <span className="inline-flex items-center gap-1 rounded bg-[#6b8e7f]/10 px-1.5 py-0.5 text-[10px] font-sans font-medium tracking-normal text-[#6b8e7f] animate-pulse">
              思考中...
            </span>
          )}
          {message.thought && !isThinking && (
            <span className="inline-flex items-center gap-1 rounded bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-sans font-medium tracking-normal text-mute">
              已思考
            </span>
          )}
        </div>
        <div
          className={`rounded-2xl border bg-white/80 backdrop-blur-md px-5 py-4 shadow-[0_4px_20px_-4px_rgba(26,20,16,0.05)] transition-all duration-500 hover:bg-white hover:shadow-[0_8px_30px_-6px_rgba(26,20,16,0.08)] ${
            realized ? "border-[#6b8e7f] shadow-[0_0_15px_rgba(107,142,127,0.15)] scale-[1.005]" : "border-line"
          }`}
        >
          <ThinkingBlock thought={message.thought || ""} isThinking={isThinking} />
          <div
            className={`transition-all duration-500 ${
              isThinking && !hasContent ? "hidden" : "block opacity-100"
            }`}
            style={{
              color: isError ? "#d1242f" : "var(--color-ink)",
              fontSize: 15.5,
              lineHeight: 1.85,
              letterSpacing: "0.01em",
            }}
          >
            {hasAttachments ? (
              <div className="space-y-3 mb-3.5">
                {attachments.map((attachment) => (
                  <AttachmentPreview
                    key={`${attachment.kind}:${attachment.url}`}
                    attachment={attachment}
                    imgError={imgError}
                    onImgError={(url) => setImgError((s) => new Set(s).add(url))}
                  />
                ))}
              </div>
            ) : null}
            {hasContent ? (
              <div className="break-words">
                <MarkdownRenderer content={message.content} />
              </div>
            ) : !isThinking && !hasAttachments ? (
              <span style={{ color: "var(--color-mute)", fontSize: 14 }}>暂未生成内容。</span>
            ) : null}
          </div>
        </div>
        {!isPending && hasContent ? (
          <button
            onClick={() => onCopy(message.content, message.id)}
            className="mt-2 inline-flex items-center gap-1.5 transition-colors rounded-lg px-2 py-1 hover:bg-cream"
            style={{
              color: copiedMessageId === message.id ? "var(--color-ink)" : "var(--color-mute)",
              fontSize: 12,
              letterSpacing: "0.06em",
              opacity: 1,
            }}
          >
            {copiedMessageId === message.id ? (
              <Check size={13} />
            ) : (
              <Copy size={13} />
            )}
            {copiedMessageId === message.id ? "已复制" : "复制"}
          </button>
        ) : null}
      </div>
    </div>
  )
}

function AttachmentPreview({
  attachment,
  imgError,
  onImgError,
}: {
  attachment: ChatAttachment
  imgError: Set<string>
  onImgError: (url: string) => void
}) {
  if (attachment.kind === "image" && !imgError.has(attachment.url)) {
    return (
      <figure className="overflow-hidden rounded-2xl border border-line bg-white">
        <img
          src={attachment.url}
          alt={attachment.alt || attachment.name || "图片"}
          loading="lazy"
          onError={() => onImgError(attachment.url)}
          className="block h-auto w-full max-w-full bg-ivory object-contain"
        />
      </figure>
    )
  }
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink transition hover:bg-ivory"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-xs font-medium text-mute">
        文件
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium">{attachment.name || "附件"}</span>
        <span className="block truncate text-xs text-mute">
          {attachment.mimeType || attachment.url}
        </span>
      </span>
    </a>
  )
}
