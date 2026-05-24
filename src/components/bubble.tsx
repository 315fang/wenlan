"use client"

import { Check, Copy } from "lucide-react"
import { useState } from "react"

import { BrandMark } from "@/components/brand-mark"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import type { ChatAttachment, ChatMessage } from "@/types/chat"

interface BubbleProps {
  message: ChatMessage
  copiedMessageId: string
  onCopy: (content: string, messageId: string) => void
}

export function Bubble({ message, copiedMessageId, onCopy }: BubbleProps) {
  const [imgError, setImgError] = useState<Set<string>>(new Set())
  const isUser = message.role === "user"
  const isPending = message.status === "pending" && !message.content
  const isError = message.status === "error"
  const attachments = message.attachments ?? []
  const hasAttachments = attachments.length > 0
  const hasContent = Boolean(message.content.trim())

  if (isUser) {
    return (
      <div className="flex justify-end px-5 md:px-0">
        <div
          className="max-w-[78%] rounded-[20px] rounded-tr-[6px] px-5 py-3"
          style={{
            background: "linear-gradient(135deg, #f1dcd1 0%, #e5d4b6 100%)",
            color: "#1a1410",
            fontSize: 15,
            lineHeight: 1.7,
            letterSpacing: "0.01em",
            boxShadow: "0 1px 0 rgba(201,168,122,0.18)",
          }}
        >
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 px-5 md:px-0">
      <div className="shrink-0 mt-1">
        <BrandMark size={32} />
      </div>
      <div className="flex-1 min-w-0 group">
        <div
          className="font-serif mb-1"
          style={{ color: "#8c8276", fontSize: 13, letterSpacing: "0.12em" }}
        >
          问小兰 · 智能客服
        </div>
        <div
          className="whitespace-pre-wrap"
          style={{
            color: isError ? "#d1242f" : "#1a1410",
            fontSize: 15.5,
            lineHeight: 1.85,
            letterSpacing: "0.01em",
          }}
        >
          {isPending ? (
            <span className="inline-flex gap-1 ml-1 align-middle">
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#c9a87a" }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#c9a87a", animationDelay: "0.15s" }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#c9a87a", animationDelay: "0.3s" }} />
            </span>
          ) : (
            <>
              {hasAttachments ? (
                <div className="space-y-3 mb-3">
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
                <MarkdownRenderer content={message.content} />
              ) : !hasAttachments ? (
                <span style={{ color: "#8c8276", fontSize: 14 }}>暂未生成内容。</span>
              ) : null}
            </>
          )}
        </div>
        {!isPending && hasContent ? (
          <button
            onClick={() => onCopy(message.content, message.id)}
            className="mt-2 inline-flex items-center gap-1.5 transition-colors rounded-lg px-2 py-1 hover:bg-[#f4eee5]"
            style={{
              color: copiedMessageId === message.id ? "#1a1410" : "#8c8276",
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
      <figure className="overflow-hidden rounded-2xl border border-[#e6dccb] bg-white">
        <img
          src={attachment.url}
          alt={attachment.alt || attachment.name || "图片"}
          loading="lazy"
          onError={() => onImgError(attachment.url)}
          className="block h-auto w-full max-w-full bg-[#fbf8f3] object-contain"
        />
      </figure>
    )
  }
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-2xl border border-[#e6dccb] bg-white px-4 py-3 text-sm text-[#1a1410] transition hover:bg-[#fbf8f3]"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-xs font-medium text-[#444]">
        文件
      </span>
      <span className="min-w-0">
        <span className="block truncate font-medium">{attachment.name || "附件"}</span>
        <span className="block truncate text-xs text-[#8c8276]">
          {attachment.mimeType || attachment.url}
        </span>
      </span>
    </a>
  )
}
