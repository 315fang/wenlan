"use client"

import {
  AlertCircle,
  ArrowUp,
  Keyboard,
  Mic,
  Plus,
  Sparkles,
  X,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { useRecorder } from "@/lib/use-recorder"

async function convertBlobToWav(blob: Blob): Promise<Blob> {
  if (blob.type === "audio/wav") return blob
  const AudioContextClass =
    window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return blob
  const audioContext = new AudioContextClass()
  try {
    const buffer = await audioContext.decodeAudioData(await blob.arrayBuffer())
    const numChannels = buffer.numberOfChannels
    const sampleRate = buffer.sampleRate
    const bytesPerSample = 2
    const blockAlign = numChannels * bytesPerSample
    const byteRate = sampleRate * blockAlign
    const dataSize = buffer.length * blockAlign
    const wavBuffer = new ArrayBuffer(44 + dataSize)
    const view = new DataView(wavBuffer)
    let offset = 0
    const writeString = (value: string) => {
      for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i))
      offset += value.length
    }
    writeString("RIFF")
    view.setUint32(offset, 36 + dataSize, true)
    offset += 4
    writeString("WAVE")
    writeString("fmt ")
    view.setUint32(offset, 16, true)
    offset += 4
    view.setUint16(offset, 1, true)
    offset += 2
    view.setUint16(offset, numChannels, true)
    offset += 2
    view.setUint32(offset, sampleRate, true)
    offset += 4
    view.setUint32(offset, byteRate, true)
    offset += 4
    view.setUint16(offset, blockAlign, true)
    offset += 2
    view.setUint16(offset, bytesPerSample * 8, true)
    offset += 2
    writeString("data")
    view.setUint32(offset, dataSize, true)
    offset += 4
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel)
      for (let i = 0; i < channelData.length; i++) {
        const sample = Math.max(-1, Math.min(1, channelData[i]))
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
        offset += 2
      }
    }
    return new Blob([wavBuffer], { type: "audio/wav" })
  } finally {
    await audioContext.close().catch(() => {})
  }
}

interface ComposerProps {
  onSend: (text: string) => void
  onOpenGuide?: () => void
  disabled?: boolean
  canTranscribe?: boolean
}

type InputMode = "voice" | "text"

function fmt(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const ss = (s % 60).toString().padStart(2, "0")
  return `${m.toString().padStart(2, "0")}:${ss}`
}

const MIN_PRESS_MS = 600
const CANCEL_THRESHOLD_PX = 60

export function Composer({ onSend, onOpenGuide, disabled, canTranscribe }: ComposerProps) {
  const [mode, setMode] = useState<InputMode>(canTranscribe ? "voice" : "text")
  const [text, setText] = useState("")
  const [transcribing, setTranscribing] = useState(false)
  const [showPlus, setShowPlus] = useState(false)
  const [pressing, setPressing] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [cancelArmed, setCancelArmed] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const startYRef = useRef<number | null>(null)
  const cancelArmedRef = useRef(false)
  const startedAtRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const rec = useRecorder()

  useEffect(() => {
    if (mode !== "text") return
    const ta = taRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = Math.max(24, Math.min(ta.scrollHeight, 160)) + "px"
  }, [text, mode])

  const submitText = () => {
    const v = text.trim()
    if (!v || disabled) return
    onSend(v)
    setText("")
  }

  const onTextKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submitText()
    }
  }

  const flashHint = (msg: string) => {
    setHint(msg)
    window.setTimeout(() => setHint((h) => (h === msg ? null : h)), 1600)
  }

  const stopTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const beginPress = useCallback(
    async (clientY: number) => {
      if (disabled || pressing || transcribing) return
      startYRef.current = clientY
      cancelArmedRef.current = false
      setCancelArmed(false)
      setElapsed(0)
      setPressing(true)
      startedAtRef.current = Date.now()
      const ok = await rec.start()
      if (!ok) {
        setPressing(false)
        startYRef.current = null
        return
      }
      stopTimer()
      timerRef.current = window.setInterval(() => {
        setElapsed(Date.now() - startedAtRef.current)
      }, 100)
    },
    [disabled, pressing, transcribing, rec]
  )

  const updatePress = useCallback((clientY: number) => {
    if (startYRef.current === null) return
    const dy = clientY - startYRef.current
    const armed = dy < -CANCEL_THRESHOLD_PX
    if (armed !== cancelArmedRef.current) {
      cancelArmedRef.current = armed
      setCancelArmed(armed)
    }
  }, [])

  const endPress = useCallback(async () => {
    if (!pressing) return
    const wasCancel = cancelArmedRef.current
    const duration = Date.now() - startedAtRef.current
    stopTimer()
    setPressing(false)
    setCancelArmed(false)
    startYRef.current = null
    cancelArmedRef.current = false

    if (wasCancel) {
      rec.cancel()
      flashHint("已取消")
      return
    }
    if (duration < MIN_PRESS_MS) {
      rec.cancel()
      flashHint("按住时间太短，请说完再松开")
      return
    }
    const blob = await rec.stop()
    if (!blob) return
    try {
      setTranscribing(true)
      const wavBlob = await convertBlobToWav(blob)
      const formData = new FormData()
      formData.append("file", wavBlob, "voice.wav")
      const response = await fetch("/api/transcribe", { method: "POST", body: formData })
      if (!response.ok) throw new Error("语音识别失败")
      const payload = (await response.json()) as { text?: string }
      const recognized = (payload.text || "").trim()
      if (recognized) {
        onSend(recognized)
      } else {
        flashHint("未识别到语音内容")
      }
    } catch {
      flashHint("语音识别失败，请重试")
    } finally {
      setTranscribing(false)
    }
  }, [pressing, rec, onSend])

  useEffect(() => {
    if (!pressing) return
    const onMove = (e: PointerEvent) => updatePress(e.clientY)
    const onUp = () => endPress()
    const onCancel = () => endPress()
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onCancel)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onCancel)
    }
  }, [pressing, updatePress, endPress])

  useEffect(() => () => stopTimer(), [])

  const errorText: string | null = (() => {
    switch (rec.error) {
      case "denied":
        return "麦克风权限被拒绝。请在浏览器地址栏左侧的站点权限里允许，再试一次。"
      case "unsupported":
        return "当前浏览器不支持录音，建议使用最新版 Chrome / Safari。"
      case "unavailable":
        return "无法启动麦克风，请检查设备是否被其他应用占用。"
      default:
        return null
    }
  })()

  return (
    <div className="w-full select-none">
      {errorText && (
        <div
          className="mb-2 flex items-start gap-2 rounded-2xl px-3 py-2.5"
          style={{
            background: "#fff6ef",
            border: "1px solid var(--color-champagne-soft)",
            color: "var(--color-ink-soft)",
            fontSize: 12.5,
            lineHeight: 1.55,
          }}
        >
          <AlertCircle size={15} style={{ color: "var(--color-champagne)", marginTop: 1, flexShrink: 0 }} />
          <div className="flex-1">{errorText}</div>
          <button
            onClick={rec.clearError}
            className="rounded-full p-0.5"
            style={{ color: "var(--color-mute)" }}
            aria-label="关闭"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {hint && (
        <div
          className="mb-2 text-center mx-auto px-3 py-1.5"
          style={{
            display: "inline-block",
            width: "fit-content",
            background: "var(--color-ink)",
            color: "var(--color-ivory)",
            fontSize: 12,
            letterSpacing: "0.06em",
            borderRadius: 999,
          }}
        >
          {hint}
        </div>
      )}

      {showPlus && (
        <div
          className="mb-2 flex flex-wrap gap-2 rounded-2xl px-3 py-3"
          style={{ background: "var(--color-pearl)", border: "1px solid var(--color-line)" }}
        >
          {onOpenGuide ? (
            <ActionChip icon={<Sparkles size={14} />} label="新手指导" onClick={onOpenGuide} />
          ) : null}
        </div>
      )}

      <div
        className="relative flex items-end gap-2 rounded-[26px] px-3 py-2.5 transition-all"
        style={{
          background: "var(--color-pearl)",
          border: "1px solid var(--color-line)",
          boxShadow: "0 8px 24px -16px color-mix(in srgb, var(--color-ink), transparent 82%)",
        }}
      >
        {canTranscribe ? (
          <button
            onClick={() => {
              if (pressing) return
              setMode(mode === "voice" ? "text" : "voice")
              setShowPlus(false)
              requestAnimationFrame(() => {
                if (mode === "voice") taRef.current?.focus()
              })
            }}
            className="shrink-0 grid place-items-center rounded-full transition-colors hover:bg-ivory"
            style={{ width: 38, height: 38, color: "var(--color-ink)" }}
            aria-label={mode === "voice" ? "切换到键盘" : "切换到语音"}
          >
            {mode === "voice" ? <Keyboard size={18} /> : <Mic size={18} />}
          </button>
        ) : null}

        {mode === "voice" && canTranscribe ? (
          <HoldButton
            pressing={pressing}
            transcribing={transcribing}
            elapsed={elapsed}
            cancelArmed={cancelArmed}
            onPointerDown={(e) => {
              e.preventDefault()
              ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
              beginPress(e.clientY)
            }}
          />
        ) : (
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onTextKeyDown}
            rows={1}
            placeholder={transcribing ? "语音识别中…" : "输入消息，回车发送"}
            disabled={disabled || transcribing}
            className="flex-1 resize-none bg-transparent outline-none px-1 py-2 block"
            style={{
              color: "var(--color-ink)",
              fontSize: 15,
              lineHeight: 1.6,
              minHeight: 24,
              maxHeight: 160,
              fontFamily: "var(--font-sans)",
            }}
          />
        )}

        <button
          onClick={() => setShowPlus((s) => !s)}
          className="shrink-0 grid place-items-center rounded-full transition-colors hover:bg-ivory"
          style={{ width: 38, height: 38, color: "var(--color-ink)" }}
          aria-label="更多"
          disabled={pressing}
        >
          {showPlus ? <X size={18} /> : <Plus size={18} />}
        </button>

        {mode === "text" || !canTranscribe ? (
          <button
            onClick={submitText}
            disabled={!text.trim() || disabled}
            className="shrink-0 grid place-items-center rounded-full transition-all"
            style={{
              width: 40,
              height: 40,
              background: text.trim() ? "var(--color-ink)" : "var(--color-bone)",
              color: text.trim() ? "var(--color-ivory)" : "var(--color-mute)",
            }}
            aria-label="发送"
          >
            <ArrowUp size={18} />
          </button>
        ) : null}
      </div>

      <div
        className="mt-2 text-center font-serif"
        style={{ color: "var(--color-mute)", fontSize: 11.5, letterSpacing: "0.14em" }}
      >
        回答由 AI 生成 · 内容以问兰官方最新资料为准
      </div>

      {pressing && <PressOverlay elapsed={elapsed} cancelArmed={cancelArmed} />}
    </div>
  )
}

function HoldButton({
  pressing,
  transcribing,
  elapsed,
  cancelArmed,
  onPointerDown,
}: {
  pressing: boolean
  transcribing: boolean
  elapsed: number
  cancelArmed: boolean
  onPointerDown: (e: React.PointerEvent) => void
}) {
  const label = transcribing
    ? "语音识别中…"
    : pressing
      ? cancelArmed
        ? `松开取消 · ${fmt(elapsed)}`
        : `松开发送 · ${fmt(elapsed)}`
      : "按住 说话"

  const bg = transcribing
    ? "var(--color-bone)"
    : pressing
      ? cancelArmed
        ? "#d9b3a4"
        : "var(--color-ink)"
      : "var(--color-ivory)"
  const fg = pressing && !cancelArmed ? "var(--color-ivory)" : "var(--color-ink)"

  return (
    <button
      onPointerDown={transcribing ? undefined : onPointerDown}
      onContextMenu={(e) => e.preventDefault()}
      className="flex-1 inline-flex items-center justify-center gap-2 rounded-full transition-colors"
      style={{
        height: 44,
        background: bg,
        color: fg,
        border: pressing ? "none" : "1px solid var(--color-line)",
        fontSize: 14,
        letterSpacing: "0.08em",
        touchAction: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
        cursor: transcribing ? "wait" : "pointer",
      }}
    >
      <Mic size={16} />
      {label}
    </button>
  )
}

function PressOverlay({ elapsed, cancelArmed }: { elapsed: number; cancelArmed: boolean }) {
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[90] flex flex-col items-center"
      style={{
        bottom: "calc(50% - 40px)",
        pointerEvents: "none",
      }}
    >
      <div
        className="grid place-items-center rounded-3xl"
        style={{
          width: 160,
          height: 160,
          background: cancelArmed ? "#d9b3a4" : "color-mix(in srgb, var(--color-ink), transparent 8%)",
          color: "var(--color-ivory)",
          boxShadow: "0 30px 60px -20px color-mix(in srgb, var(--color-ink), transparent 55%)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="flex flex-col items-center gap-3">
          {cancelArmed ? (
            <>
              <X size={36} />
              <div className="font-serif" style={{ fontSize: 13, letterSpacing: "0.14em" }}>
                松 开 取 消
              </div>
            </>
          ) : (
            <>
              <Waveform />
              <div className="font-serif" style={{ fontSize: 13, letterSpacing: "0.14em" }}>
                {fmt(elapsed)}
              </div>
            </>
          )}
        </div>
      </div>
      <div
        className="mt-3 rounded-full px-3 py-1.5"
        style={{
          background: "color-mix(in srgb, var(--color-ink), transparent 22%)",
          color: "var(--color-cream)",
          fontSize: 12,
          letterSpacing: "0.06em",
        }}
      >
        {cancelArmed ? "松开手指即可取消" : "上滑取消，松开发送"}
      </div>
    </div>
  )
}

function Waveform() {
  return (
    <div className="flex items-end gap-1" style={{ height: 36 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="rounded-full"
          style={{
            width: 4,
            background: "var(--color-champagne)",
            animation: `lux-bar 0.9s ${i * 0.12}s ease-in-out infinite`,
            height: 10,
          }}
        />
      ))}
      <style>{`@keyframes lux-bar { 0%,100% { height: 8px; opacity: .55 } 50% { height: 32px; opacity: 1 } }`}</style>
    </div>
  )
}

function ActionChip({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-ivory"
      style={{ border: "1px solid var(--color-line)", color: "var(--color-ink)", fontSize: 13 }}
    >
      {icon}
      {label}
    </button>
  )
}
