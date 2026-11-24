// 브라우저 얼굴 추적 (MediaPipe Face Landmarker). 영상은 이 기기에서만 처리하고 밖으로 보내지 않는다.
// 패키지를 번들에 넣지 않고, 카메라 분석을 켰을 때만 고정 버전을 CDN에서 불러온다
// (라이브러리 + wasm 약 10MB, 얼굴 모델 약 4MB — 브라우저 캐시에 남아 다음부터는 빠르다).

import { eyesLookingAway, poseFromMatrix, type FrameSample } from "./camera-analysis"

const TASKS_VISION_VERSION = "0.10.14"
const TASKS_VISION_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}`
const FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"

// 사용하는 부분만 타입으로 적는다
interface Landmark { x: number; y: number; z: number }
interface FaceLandmarkerResult {
  faceLandmarks: Landmark[][]
  faceBlendshapes?: { categories: { categoryName: string; score: number }[] }[]
  facialTransformationMatrixes?: { data: ArrayLike<number> }[]
}
interface FaceLandmarker {
  detectForVideo(video: HTMLVideoElement, timestamp: number): FaceLandmarkerResult
  close(): void
}
interface TasksVision {
  FilesetResolver: { forVisionTasks(wasmPath: string): Promise<unknown> }
  FaceLandmarker: { createFromOptions(fileset: unknown, options: object): Promise<FaceLandmarker> }
}

export interface FaceTracker {
  /** 지금 영상 프레임을 분석한다. 얼굴이 없으면 null */
  detect(video: HTMLVideoElement, timestamp: number): FrameSample | null
  close(): void
}

// 코끝, 양 눈 바깥쪽 꼬리 (MediaPipe 얼굴 그물 번호)
const NOSE_TIP = 1
const EYE_OUTER_A = 33
const EYE_OUTER_B = 263

export function sampleFromResult(result: FaceLandmarkerResult): FrameSample | null {
  const faceCount = result.faceLandmarks.length
  if (faceCount === 0) return null
  const landmarks = result.faceLandmarks[0]
  const matrix = result.facialTransformationMatrixes?.[0]?.data
  const nose = landmarks[NOSE_TIP]
  const a = landmarks[EYE_OUTER_A]
  const b = landmarks[EYE_OUTER_B]
  if (!matrix || !nose || !a || !b) return null
  const eyeDistance = Math.hypot(a.x - b.x, a.y - b.y) || 1
  const scores: Record<string, number> = {}
  for (const c of result.faceBlendshapes?.[0]?.categories ?? []) scores[c.categoryName] = c.score
  return {
    faceCount,
    ...poseFromMatrix(matrix),
    eyesOff: eyesLookingAway(scores),
    noseX: nose.x / eyeDistance,
    noseY: nose.y / eyeDistance,
  }
}

export async function createFaceTracker(): Promise<FaceTracker> {
  const vision = (await import(/* @vite-ignore */ `${TASKS_VISION_BASE}/vision_bundle.mjs`)) as TasksVision
  const fileset = await vision.FilesetResolver.forVisionTasks(`${TASKS_VISION_BASE}/wasm`)
  const options = (delegate: "GPU" | "CPU") => ({
    baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate },
    runningMode: "VIDEO",
    numFaces: 2,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  })
  let landmarker: FaceLandmarker
  try {
    landmarker = await vision.FaceLandmarker.createFromOptions(fileset, options("GPU"))
  } catch {
    // GPU를 못 쓰는 기기는 CPU로
    landmarker = await vision.FaceLandmarker.createFromOptions(fileset, options("CPU"))
  }
  let lastTimestamp = 0
  return {
    detect(video, timestamp) {
      // detectForVideo는 시간이 계속 늘어나야 한다
      const ts = Math.max(timestamp, lastTimestamp + 1)
      lastTimestamp = ts
      return sampleFromResult(landmarker.detectForVideo(video, ts))
    },
    close() {
      landmarker.close()
    },
  }
}
