import { useCallback, useEffect, useRef, useState } from "react"
import { CameraAccumulator, isLookingAtCamera, type CameraMetrics } from "./camera-analysis"
import { DarkFrameDetector, meanLuminance, pickPreferredCamera, type CameraDevice } from "./camera-devices"
import { createFaceTracker, type FaceTracker } from "./face-tracker"

/** 약 5fps로 분석한다 (자세·시선 비율을 재기에는 충분하고 노트북 부담이 적다) */
const SAMPLE_INTERVAL_MS = 200
/** 검은 화면 확인 간격 */
const DARK_CHECK_INTERVAL_MS = 500
/** 사용자가 고른 카메라를 기억하는 키 (이 브라우저에만 저장) */
const SAVED_DEVICE_KEY = "ats.cameraDeviceId"

export type CameraStatus = "off" | "loading" | "on" | "error"
/** 화면에 바로 보여 주는 상태 (답변 중에만 갱신) */
export type CameraHint = "ok" | "no-face" | "look-camera" | null

function readSavedDevice(): string | null {
  try { return window.localStorage.getItem(SAVED_DEVICE_KEY) } catch { return null }
}
function saveDevice(id: string) {
  try { window.localStorage.setItem(SAVED_DEVICE_KEY, id) } catch { /* 저장 못 해도 동작에는 지장 없음 */ }
}

function openCamera(deviceId?: string): Promise<MediaStream> {
  const size = { width: { ideal: 640 }, height: { ideal: 480 } }
  return navigator.mediaDevices.getUserMedia({
    video: deviceId ? { ...size, deviceId: { exact: deviceId } } : { ...size, facingMode: "user" },
    audio: false,
  })
}

async function listCameras(): Promise<CameraDevice[]> {
  try {
    const all = await navigator.mediaDevices.enumerateDevices()
    return all.filter(d => d.kind === "videoinput" && d.deviceId).map(d => ({ deviceId: d.deviceId, label: d.label }))
  } catch {
    return []
  }
}

/**
 * 실시간 면접 카메라 자세·시선 분석.
 * enable()로 카메라와 얼굴 추적을 켜고, 답변마다 beginAnswer()/endAnswer()로 요약을 받는다.
 * 카메라나 추적을 못 켜도 면접은 음성만으로 계속할 수 있게 오류는 status로만 알린다.
 *
 * 캡처 보드·가상 카메라가 기본으로 잡혀 검은 화면만 들어오는 PC가 있어서,
 * 실제 웹캠을 우선 고르고(selectDevice로 바꿀 수 있음) 화면이 계속 검으면 dark로 알린다.
 */
export function useCameraAnalysis() {
  const [status, setStatus] = useState<CameraStatus>("off")
  const [error, setError] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [hint, setHint] = useState<CameraHint>(null)
  const [devices, setDevices] = useState<CameraDevice[]>([])
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [dark, setDark] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const trackerRef = useRef<FaceTracker | null>(null)
  const timerRef = useRef<number | null>(null)
  const darkTimerRef = useRef<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const darkRef = useRef(new DarkFrameDetector())
  const collectingRef = useRef(false)
  const accRef = useRef(new CameraAccumulator())
  const hintRef = useRef<CameraHint>(null)
  const generationRef = useRef(0)

  const updateHint = (next: CameraHint) => {
    if (hintRef.current === next) return
    hintRef.current = next
    setHint(next)
  }

  const disable = useCallback(() => {
    generationRef.current += 1
    collectingRef.current = false
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = null
    if (darkTimerRef.current) window.clearInterval(darkTimerRef.current)
    darkTimerRef.current = null
    trackerRef.current?.close()
    trackerRef.current = null
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStream(null)
    setDark(false)
    darkRef.current.reset()
    updateHint(null)
    setStatus("off")
  }, [])

  useEffect(() => disable, [disable])

  const playInto = (element: HTMLVideoElement, media: MediaStream) => {
    if (element.srcObject !== media) element.srcObject = media
    void element.play().catch(() => {})
  }

  // 미리보기 영상 연결 (video 요소는 stream이 생긴 뒤에 그려진다)
  const attachVideo = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element
    if (element && streamRef.current) playInto(element, streamRef.current)
  }, [])

  /** 새 스트림을 지금 스트림 자리에 넣는다 (얼굴 추적은 그대로 둔다) */
  const adoptStream = (media: MediaStream, generation: number) => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = media
    setStream(media)
    setDeviceId(media.getVideoTracks()[0]?.getSettings().deviceId ?? null)
    darkRef.current.reset()
    setDark(false)
    if (videoRef.current) playInto(videoRef.current, media)
    media.getVideoTracks().forEach(track => {
      // stop()으로 끈 경우에는 ended가 오지 않는다 — 케이블이 빠지는 등 브라우저가 끊은 경우만
      track.onended = () => {
        if (generation !== generationRef.current || streamRef.current !== media) return
        disable()
        setStatus("error")
        setError("카메라 연결이 끊겨 이후 답변은 자세·시선 분석 없이 진행합니다.")
      }
    })
  }

  const enable = useCallback(async (): Promise<boolean> => {
    if (streamRef.current) return true
    const generation = ++generationRef.current
    setStatus("loading")
    setError(null)

    // 전에 고른 카메라가 있으면 그것부터, 없거나 빠졌으면 기본 카메라로 권한을 받는다
    const saved = readSavedDevice()
    let media: MediaStream | null = null
    if (saved) media = await openCamera(saved).catch(() => null)
    if (!media) {
      try {
        media = await openCamera()
      } catch {
        if (generation !== generationRef.current) return false
        setStatus("error")
        setError("카메라를 사용할 수 없어 자세·시선 분석 없이 진행합니다. (주소창의 카메라 권한을 확인하세요)")
        return false
      }
    }
    if (generation !== generationRef.current) {
      media.getTracks().forEach(track => track.stop())
      return false
    }

    // 권한을 받은 뒤에야 장치 이름을 알 수 있다. 기본으로 잡힌 게 캡처 보드·가상 카메라면 웹캠으로 바꾼다
    const cameras = await listCameras()
    if (generation !== generationRef.current) {
      media.getTracks().forEach(track => track.stop())
      return false
    }
    setDevices(cameras)
    const current = media.getVideoTracks()[0]?.getSettings().deviceId
    const preferred = pickPreferredCamera(cameras, saved)
    if (preferred && current && preferred !== current) {
      const better = await openCamera(preferred).catch(() => null)
      if (generation !== generationRef.current) {
        better?.getTracks().forEach(track => track.stop())
        media.getTracks().forEach(track => track.stop())
        return false
      }
      if (better) {
        media.getTracks().forEach(track => track.stop())
        media = better
      }
    }
    adoptStream(media, generation)

    // 검은 화면 감지 (답변 중이 아니어도 확인해 바로 안내한다)
    darkTimerRef.current = window.setInterval(() => {
      const video = videoRef.current
      if (!video || video.readyState < 2) return
      const canvas = canvasRef.current ?? (canvasRef.current = document.createElement("canvas"))
      canvas.width = 32
      canvas.height = 24
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      if (!ctx) return
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        setDark(darkRef.current.add(meanLuminance(ctx.getImageData(0, 0, canvas.width, canvas.height).data)))
      } catch {
        // 프레임을 못 읽으면 건너뛴다
      }
    }, DARK_CHECK_INTERVAL_MS)

    try {
      const tracker = await createFaceTracker()
      if (generation !== generationRef.current) {
        tracker.close()
        return false
      }
      trackerRef.current = tracker
    } catch {
      if (generation !== generationRef.current) return false
      disable()
      setStatus("error")
      setError("얼굴 분석 기능을 불러오지 못해 자세·시선 분석 없이 진행합니다. (인터넷 연결을 확인하세요)")
      return false
    }

    timerRef.current = window.setInterval(() => {
      const video = videoRef.current
      const tracker = trackerRef.current
      if (!collectingRef.current || !video || !tracker || video.readyState < 2) return
      try {
        const sample = tracker.detect(video, performance.now())
        accRef.current.add(sample)
        updateHint(!sample || sample.faceCount !== 1 ? "no-face" : isLookingAtCamera(sample) ? "ok" : "look-camera")
      } catch {
        // 프레임 하나 분석 실패는 건너뛴다
      }
    }, SAMPLE_INTERVAL_MS)
    setStatus("on")
    return true
  }, [disable])

  /** 다른 카메라로 바꾼다. 고른 카메라는 다음 면접에서도 먼저 쓴다 */
  const selectDevice = useCallback(async (id: string): Promise<boolean> => {
    if (!streamRef.current || id === deviceId) return true
    const generation = generationRef.current
    const media = await openCamera(id).catch(() => null)
    if (generation !== generationRef.current) {
      media?.getTracks().forEach(track => track.stop())
      return false
    }
    if (!media) {
      setError("고른 카메라를 켜지 못했습니다. 다른 앱이 카메라를 쓰고 있는지 확인하세요.")
      return false
    }
    setError(null)
    saveDevice(id)
    adoptStream(media, generation)
    return true
  }, [deviceId])

  const beginAnswer = useCallback(() => {
    accRef.current.reset()
    collectingRef.current = trackerRef.current != null
  }, [])

  /** 답변이 끝났을 때 요약 (카메라가 꺼졌거나 프레임이 부족하면 null) */
  const endAnswer = useCallback((): CameraMetrics | null => {
    const wasCollecting = collectingRef.current
    collectingRef.current = false
    updateHint(null)
    return wasCollecting ? accRef.current.result() : null
  }, [])

  return { status, error, stream, hint, dark, devices, deviceId, attachVideo, enable, disable, selectDevice, beginAnswer, endAnswer }
}
