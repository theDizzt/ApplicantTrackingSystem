import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react"
import { Download, Pause, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const BAR_COUNT = 72
const SPEEDS = [1, 1.25, 1.5, 2] as const

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, "0")}`
}

/** 오디오를 디코딩해 막대 높이(0~1)와 길이를 구한다. 실패하면 null. */
async function analyzeAudio(blob: Blob): Promise<{ peaks: number[]; duration: number } | null> {
  const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtx) return null
  const ctx = new AudioCtx()
  try {
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer())
    const data = buffer.getChannelData(0)
    const step = Math.max(1, Math.floor(data.length / BAR_COUNT))
    const peaks: number[] = []
    for (let i = 0; i < BAR_COUNT; i++) {
      let sum = 0
      const start = i * step
      const end = Math.min(data.length, start + step)
      for (let j = start; j < end; j++) sum += data[j] * data[j]
      peaks.push(Math.sqrt(sum / Math.max(1, end - start)))
    }
    const max = Math.max(...peaks, 0.0001)
    return { peaks: peaks.map((p) => p / max), duration: buffer.duration }
  } catch {
    return null
  } finally {
    void ctx.close()
  }
}

/**
 * 녹음본·업로드 파일용 플레이어.
 * 전체 파형 위에 재생 위치를 표시하고, 파형을 눌러(또는 방향키로) 원하는 곳으로 이동한다.
 */
export function AudioPlayer({
  src,
  blob,
  downloadName,
  className,
}: {
  src: string
  blob: Blob
  /** 다운로드 파일 이름 */
  downloadName: string
  className?: string
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speedIndex, setSpeedIndex] = useState(0)
  const [peaks, setPeaks] = useState<number[] | null>(null)

  // 파형·길이 계산 (MediaRecorder로 만든 webm은 <audio>가 길이를 Infinity로 알려 주는 경우가 있어 디코딩 값으로 보완)
  useEffect(() => {
    let cancelled = false
    setPeaks(null)
    void analyzeAudio(blob).then((result) => {
      if (cancelled || !result) return
      setPeaks(result.peaks)
      setDuration((d) => (Number.isFinite(d) && d > 0 ? d : result.duration))
    })
    return () => { cancelled = true }
  }, [blob])

  useEffect(() => {
    setPlaying(false)
    setCurrent(0)
    setDuration(0)
  }, [src])

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[speedIndex]
  }, [speedIndex])

  // 재생 중에는 시간 이벤트보다 촘촘하게 위치를 갱신해 진행 표시를 부드럽게 한다
  useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = () => {
      if (audioRef.current) setCurrent(audioRef.current.currentTime)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) void audio.play()
    else audio.pause()
  }

  const seekTo = (seconds: number) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    const t = Math.max(0, Math.min(duration, seconds))
    audio.currentTime = t
    setCurrent(t)
  }

  const seekFromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    seekTo(((e.clientX - rect.left) / rect.width) * duration)
  }

  const onSliderKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") { seekTo(current + 5); e.preventDefault() }
    else if (e.key === "ArrowLeft") { seekTo(current - 5); e.preventDefault() }
    else if (e.key === "Home") { seekTo(0); e.preventDefault() }
    else if (e.key === "End") { seekTo(duration); e.preventDefault() }
    else if (e.key === " " || e.key === "Enter") { toggle(); e.preventDefault() }
  }

  const progress = duration > 0 ? Math.min(1, current / duration) : 0
  // 디코딩 전에는 잔잔한 기본 파형을 보여 준다
  const bars = useMemo(
    () => peaks ?? Array.from({ length: BAR_COUNT }, (_, i) => 0.25 + 0.15 * Math.sin(i / 3)),
    [peaks],
  )

  return (
    <div
      className={cn("w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3", className)}
      data-testid="audio-preview"
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrent(0); if (audioRef.current) audioRef.current.currentTime = 0 }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration
          if (Number.isFinite(d) && d > 0) setDuration(d)
        }}
        className="hidden"
      />

      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="icon"
          onClick={toggle}
          className="h-11 w-11 shrink-0 rounded-full shadow-sm"
          aria-label={playing ? "일시정지" : "재생"}
          data-testid="button-audio-toggle"
        >
          {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
        </Button>

        <div className="flex-1 min-w-0">
          <div
            role="slider"
            tabIndex={0}
            aria-label="재생 위치"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(current)}
            aria-valuetext={`${formatClock(current)} / ${formatClock(duration)}`}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); seekFromPointer(e) }}
            onPointerMove={(e) => { if (e.buttons === 1) seekFromPointer(e) }}
            onKeyDown={onSliderKey}
            className="group flex h-12 cursor-pointer items-center gap-[2px] rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {bars.map((h, i) => {
              const played = (i + 0.5) / bars.length <= progress
              return (
                <span
                  key={i}
                  className={cn(
                    "flex-1 rounded-full transition-colors",
                    played ? "bg-primary" : "bg-slate-300 group-hover:bg-slate-400/80",
                  )}
                  style={{ height: `${Math.max(8, h * 100)}%` }}
                />
              )
            })}
          </div>
          <div className="mt-1 flex justify-between text-[11px] font-medium tabular-nums text-slate-500">
            <span>{formatClock(current)}</span>
            <span>{formatClock(duration)}</span>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setSpeedIndex((i) => (i + 1) % SPEEDS.length)}
          className="h-8 w-12 shrink-0 px-0 text-xs font-semibold tabular-nums text-slate-600"
          aria-label={`재생 속도 ${SPEEDS[speedIndex]}배, 눌러서 바꾸기`}
          data-testid="button-audio-speed"
        >
          {SPEEDS[speedIndex]}x
        </Button>

        <Button
          asChild
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label="녹음 파일 다운로드"
        >
          <a href={src} download={downloadName} data-testid="button-audio-download">
            <Download className="h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  )
}
