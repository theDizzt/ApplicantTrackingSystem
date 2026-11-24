// 실시간 면접 카메라 자세·시선 분석 — 프레임 하나를 판정하고 답변 하나 동안의 결과를 요약한다.
// 얼굴 추적(MediaPipe)은 face-tracker.ts가 맡고, 여기는 카메라 없이 테스트할 수 있는 계산만 둔다.
// 영상은 서버로 보내지 않는다. 서버에는 endAnswer()가 만든 숫자 요약만 보낸다.

/** 서버로 보내는 답변 하나의 요약 (서버 camera-posture.ts의 CameraMetrics와 같은 모양) */
export interface CameraMetrics {
  samples: number
  faceRatio: number
  gazeRatio: number
  lookAwayRatio: number
  headDownRatio: number
  tiltRatio: number
  movement: number
}

/** 프레임 하나를 분석한 결과. 얼굴이 없으면 faceCount 0 */
export interface FrameSample {
  faceCount: number
  /** 고개 좌우 회전(도) */
  yaw: number
  /** 고개 상하(도) */
  pitch: number
  /** 고개 기울기(도) */
  roll: number
  /** 눈동자가 크게 옆·위·아래를 보고 있는지 */
  eyesOff: boolean
  /** 코끝 위치 (두 눈 사이 거리 단위). 흔들림 계산용 */
  noseX: number
  noseY: number
}

export const GAZE_YAW_MAX = 15
export const GAZE_PITCH_MAX = 15
export const LOOK_AWAY_YAW = 20
export const HEAD_DOWN_PITCH = 20
export const TILT_ROLL = 12
export const EYES_OFF_THRESHOLD = 0.5
/** 서버가 받는 최소 프레임 수와 같다 */
export const MIN_SAMPLES = 5

const toDegrees = (radians: number) => (radians * 180) / Math.PI

/**
 * MediaPipe facialTransformationMatrixes(4×4, 열 우선)에서 고개 각도를 구한다.
 * 부호는 카메라 방향에 따라 다를 수 있어 판정에는 절댓값만 쓴다.
 */
export function poseFromMatrix(data: ArrayLike<number>): { yaw: number; pitch: number; roll: number } {
  const r = (row: number, col: number) => data[col * 4 + row]
  const pitch = Math.atan2(r(2, 1), r(2, 2))
  const yaw = Math.asin(Math.max(-1, Math.min(1, -r(2, 0))))
  const roll = Math.atan2(r(1, 0), r(0, 0))
  return { yaw: toDegrees(yaw), pitch: toDegrees(pitch), roll: toDegrees(roll) }
}

/** MediaPipe 표정 계수(eyeLook*)로 눈동자가 크게 다른 곳을 보는지 판정한다. */
export function eyesLookingAway(scores: Record<string, number>): boolean {
  const s = (name: string) => scores[name] ?? 0
  const horizontal = (s("eyeLookOutLeft") + s("eyeLookInRight") - s("eyeLookInLeft") - s("eyeLookOutRight")) / 2
  const vertical = (s("eyeLookUpLeft") + s("eyeLookUpRight") - s("eyeLookDownLeft") - s("eyeLookDownRight")) / 2
  return Math.abs(horizontal) > EYES_OFF_THRESHOLD || Math.abs(vertical) > EYES_OFF_THRESHOLD
}

export function isLookingAtCamera(sample: FrameSample): boolean {
  return Math.abs(sample.yaw) <= GAZE_YAW_MAX && Math.abs(sample.pitch) <= GAZE_PITCH_MAX && !sample.eyesOff
}

const round3 = (value: number) => Math.round(value * 1000) / 1000

/** 답변 하나 동안의 프레임을 모아 요약한다. */
export class CameraAccumulator {
  private total = 0
  private face = 0
  private gaze = 0
  private lookAway = 0
  private headDown = 0
  private tilt = 0
  private noseX: number[] = []
  private noseY: number[] = []

  reset(): void {
    this.total = 0
    this.face = 0
    this.gaze = 0
    this.lookAway = 0
    this.headDown = 0
    this.tilt = 0
    this.noseX = []
    this.noseY = []
  }

  /** 분석한 프레임 하나를 더한다 (얼굴을 못 찾았으면 null) */
  add(sample: FrameSample | null): void {
    this.total += 1
    // 얼굴이 없거나 여러 명이 잡히면 "얼굴이 또렷하게 보이지 않음"으로 센다
    if (!sample || sample.faceCount !== 1) return
    this.face += 1
    if (isLookingAtCamera(sample)) this.gaze += 1
    if (Math.abs(sample.yaw) > LOOK_AWAY_YAW) this.lookAway += 1
    if (Math.abs(sample.pitch) > HEAD_DOWN_PITCH) this.headDown += 1
    if (Math.abs(sample.roll) > TILT_ROLL) this.tilt += 1
    this.noseX.push(sample.noseX)
    this.noseY.push(sample.noseY)
  }

  get sampleCount(): number {
    return this.total
  }

  /** 프레임이 너무 적으면 null (짧은 답변이거나 카메라가 늦게 켜진 경우) */
  result(): CameraMetrics | null {
    if (this.total < MIN_SAMPLES) return null
    const ofFace = (count: number) => (this.face > 0 ? count / this.face : 0)
    return {
      samples: this.total,
      faceRatio: round3(this.face / this.total),
      gazeRatio: round3(ofFace(this.gaze)),
      lookAwayRatio: round3(ofFace(this.lookAway)),
      headDownRatio: round3(ofFace(this.headDown)),
      tiltRatio: round3(ofFace(this.tilt)),
      movement: round3(Math.sqrt(variance(this.noseX) + variance(this.noseY))),
    }
  }
}

function variance(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
}
