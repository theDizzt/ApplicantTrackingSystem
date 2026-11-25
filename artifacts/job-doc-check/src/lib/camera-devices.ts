// 카메라 장치 고르기와 검은 화면 판정.
// PC에 캡처 보드(USB3.0 capture)나 가상 카메라(Animaze, OBS 등)가 있으면 브라우저가 그것을
// 기본 카메라로 골라 검은 화면만 들어올 수 있다. 실제 웹캠을 우선 고르고, 검은 화면이면 알려 준다.

export interface CameraDevice {
  deviceId: string
  label: string
}

/** 웹캠이 아닐 가능성이 높은 장치 이름 (캡처 보드·가상 카메라) */
const NOT_WEBCAM = /virtual|가상|animaze|obs|capture|캡처|broadcast|snap ?camera|manycam|xsplit|splitcam|vtube|nvidia|elgato|cam ?link|screen|ndi/i
/** 웹캠일 가능성이 높은 장치 이름 */
const LIKELY_WEBCAM = /webcam|web cam|camera|facetime|integrated|built-?in|hd ?cam|c9\d\d|brio|웹캠|카메라/i

/** 높을수록 실제 웹캠에 가깝다 */
export function cameraScore(label: string): number {
  if (NOT_WEBCAM.test(label)) return 0
  if (LIKELY_WEBCAM.test(label)) return 2
  return 1
}

/**
 * 쓸 카메라를 고른다.
 * 1) 사용자가 전에 고른 장치가 아직 있으면 그것
 * 2) 아니면 웹캠다운 이름 순, 같으면 원래 순서
 */
export function pickPreferredCamera(devices: CameraDevice[], savedId?: string | null): string | null {
  if (devices.length === 0) return null
  if (savedId && devices.some(d => d.deviceId === savedId)) return savedId
  let best = devices[0]
  for (const d of devices) if (cameraScore(d.label) > cameraScore(best.label)) best = d
  return best.deviceId
}

/** 화면에 보여 줄 이름 (권한 전에는 이름이 비어 있다) */
export function cameraLabel(device: CameraDevice, index: number): string {
  return device.label.trim() || `카메라 ${index + 1}`
}

/** RGBA 픽셀의 평균 밝기(0~255) */
export function meanLuminance(pixels: ArrayLike<number>): number {
  let sum = 0
  let count = 0
  for (let i = 0; i + 2 < pixels.length; i += 4) {
    sum += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]
    count += 1
  }
  return count === 0 ? 0 : sum / count
}

/** 이 밝기 미만이면 검은 화면으로 본다 (아주 어두운 방도 보통 20 이상) */
export const DARK_LUMINANCE = 10
/** 연속으로 이만큼 검으면 알린다 (0.5초 간격 → 2초) */
export const DARK_STREAK = 4

/** 잠깐 어두워지는 것(카메라 켜지는 순간 등)은 무시하고, 계속 검을 때만 true */
export class DarkFrameDetector {
  private streak = 0

  /** 프레임 하나의 평균 밝기를 넣고, 지금 검은 화면 상태인지 돌려준다 */
  add(luminance: number): boolean {
    this.streak = luminance < DARK_LUMINANCE ? this.streak + 1 : 0
    return this.streak >= DARK_STREAK
  }

  reset() {
    this.streak = 0
  }
}
