import { useCallback, useEffect, useRef, useState } from "react"
import { CameraAccumulator, isLookingAtCamera, type CameraMetrics } from "./camera-analysis"
import { createFaceTracker, type FaceTracker } from "./face-tracker"

/** 약 5fps로 분석한다 (자세·시선 비율을 재기에는 충분하고 노트북 부담이 적다) */
const SAMPLE_INTERVAL_MS = 200

export type CameraStatus = "off" | "loading" | "on" | "error"
/** 화면에 바로 보여 주는 상태 (답변 중에만 갱신) */
export type CameraHint = "ok" | "no-face" | "look-camera" | null

/**
 * 실시간 면접 카메라 자세·시선 분석.
 * enable()로 카메라와 얼굴 추적을 켜고, 답변마다 beginAnswer()/endAnswer()로 요약을 받는다.
 * 카메라나 추적을 못 켜도 면접은 음성만으로 계속할 수 있게 오류는 status로만 알린다.
 */
export function useCameraAnalysis() {
  const [status, setStatus] = useState<CameraStatus>("off")
  const [error, setError] = useState<string | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [hint, setHint] = useState<CameraHint>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const trackerRef = useRef<FaceTracker | null>(null)
  const timerRef = useRef<number | null>(null)
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
    trackerRef.current?.close()
    trackerRef.current = null
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStream(null)
    updateHint(null)
    setStatus("off")
  }, [])

  useEffect(() => disable, [disable])

  // 미리보기 영상 연결 (video 요소는 stream이 생긴 뒤에 그려진다)
  const attachVideo = useCallback((element: HTMLVideoElement | null) => {
    videoRef.current = element
    if (element && streamRef.current && element.srcObject !== streamRef.current) {
      element.srcObject = streamRef.current
      void element.play().catch(() => {})
    }
  }, [])

  const enable = useCallback(async (): Promise<boolean> => {
    if (streamRef.current) return true
    const generation = ++generationRef.current
    setStatus("loading")
    setError(null)
    let media: MediaStream
    try {
      media = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      })
    } catch {
      if (generation !== generationRef.current) return false
      setStatus("error")
      setError("카메라를 사용할 수 없어 자세·시선 분석 없이 진행합니다. (주소창의 카메라 권한을 확인하세요)")
      return false
    }
    if (generation !== generationRef.current) {
      media.getTracks().forEach(track => track.stop())
      return false
    }
    streamRef.current = media
    setStream(media)
    if (videoRef.current) {
      videoRef.current.srcObject = media
      void videoRef.current.play().catch(() => {})
    }
    media.getVideoTracks().forEach(track => {
      track.onended = () => {
        if (generation !== generationRef.current) return
        disable()
        setStatus("error")
        setError("카메라 연결이 끊겨 이후 답변은 자세·시선 분석 없이 진행합니다.")
      }
    })

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

  return { status, error, stream, hint, attachVideo, enable, disable, beginAnswer, endAnswer }
}
