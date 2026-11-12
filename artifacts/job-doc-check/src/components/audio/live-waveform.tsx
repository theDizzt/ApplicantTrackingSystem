import { useEffect, useRef, useState } from "react"
import { MicOff } from "lucide-react"
import { cn } from "@/lib/utils"

/** 테마 색 토큰(예: --primary = "221 83% 53%")을 캔버스에서 쓸 수 있는 색으로 바꾼다. */
export function themeColor(token: string, fallback: string): string {
  if (typeof window === "undefined") return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  return raw ? `hsl(${raw})` : fallback
}

const BAR_WIDTH = 3
const BAR_GAP = 2
/** 이 크기보다 작은 소리가 계속되면 "소리가 안 들린다"고 안내한다 */
const SILENCE_LEVEL = 0.02
const SILENCE_HINT_MS = 3000

/**
 * 녹음 중인 마이크 소리를 실시간 막대 파형으로 보여 준다.
 * 오른쪽에서 새 막대가 생기고 왼쪽으로 흘러가며, 소리가 크면 막대가 높아진다.
 */
export function LiveWaveform({
  stream,
  className,
  height = 72,
}: {
  stream: MediaStream | null
  className?: string
  height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [silent, setSilent] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!stream || !canvas) return

    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return

    const audioCtx = new AudioCtx()
    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.6
    source.connect(analyser)
    const samples = new Float32Array(analyser.fftSize)

    const ctx = canvas.getContext("2d")
    const color = themeColor("--primary", "#2563eb")
    const levels: number[] = []
    let quietSince = performance.now()
    let raf = 0
    let lastPush = 0

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      if (!ctx) return

      // 화면 크기에 맞춰 캔버스 해상도 조정 (선명하게)
      const dpr = window.devicePixelRatio || 1
      const width = canvas.clientWidth
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr)
        canvas.height = Math.round(height * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // 현재 소리 크기(RMS)
      analyser.getFloatTimeDomainData(samples)
      let sum = 0
      for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
      const rms = Math.sqrt(sum / samples.length)
      // 말소리는 RMS가 작으므로 키워서 보여 준다 (0~1)
      const level = Math.min(1, rms * 4.5)

      if (now - lastPush > 50) {
        lastPush = now
        levels.push(level)
        const maxBars = Math.ceil(width / (BAR_WIDTH + BAR_GAP))
        while (levels.length > maxBars) levels.shift()
      }

      if (rms > SILENCE_LEVEL) quietSince = now
      const isSilent = now - quietSince > SILENCE_HINT_MS
      setSilent((prev) => (prev === isSilent ? prev : isSilent))

      ctx.clearRect(0, 0, width, height)
      const mid = height / 2
      for (let i = 0; i < levels.length; i++) {
        const x = width - (levels.length - i) * (BAR_WIDTH + BAR_GAP)
        const barHeight = Math.max(3, levels[i] * (height - 6))
        // 오래된 막대일수록 흐리게
        ctx.globalAlpha = 0.35 + 0.65 * (i / Math.max(1, levels.length - 1))
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.roundRect(x, mid - barHeight / 2, BAR_WIDTH, barHeight, BAR_WIDTH / 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      source.disconnect()
      void audioCtx.close()
      setSilent(false)
    }
  }, [stream, height])

  return (
    <div className={cn("w-full", className)}>
      <canvas
        ref={canvasRef}
        className="w-full block"
        style={{ height }}
        role="img"
        aria-label="녹음 중인 소리의 실시간 파형"
        data-testid="live-waveform"
      />
      <p
        className={cn(
          "mt-2 flex items-center justify-center gap-1.5 text-xs text-amber-700 transition-opacity",
          silent ? "opacity-100" : "opacity-0",
        )}
        aria-live="polite"
      >
        <MicOff className="w-3.5 h-3.5" />
        {silent ? "마이크 소리가 잡히지 않아요. 마이크가 켜져 있는지 확인해주세요." : ""}
      </p>
    </div>
  )
}
