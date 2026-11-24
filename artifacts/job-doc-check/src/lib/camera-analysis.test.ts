import { describe, expect, it } from "vitest"
import { CameraAccumulator, eyesLookingAway, isLookingAtCamera, poseFromMatrix, type FrameSample } from "./camera-analysis"

/** 3×3 회전 행렬(행 우선)을 MediaPipe 형식(4×4 열 우선)으로 */
function toColumnMajor(rows: number[][]): number[] {
  const out = new Array(16).fill(0)
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out[c * 4 + r] = rows[r][c]
  out[15] = 1
  return out
}

const rad = (deg: number) => (deg * Math.PI) / 180

describe("poseFromMatrix", () => {
  it("reads yaw, pitch and roll from single-axis rotations", () => {
    const y = rad(30)
    expect(poseFromMatrix(toColumnMajor([[Math.cos(y), 0, Math.sin(y)], [0, 1, 0], [-Math.sin(y), 0, Math.cos(y)]])).yaw).toBeCloseTo(30)
    const x = rad(25)
    expect(poseFromMatrix(toColumnMajor([[1, 0, 0], [0, Math.cos(x), -Math.sin(x)], [0, Math.sin(x), Math.cos(x)]])).pitch).toBeCloseTo(25)
    const z = rad(-15)
    expect(poseFromMatrix(toColumnMajor([[Math.cos(z), -Math.sin(z), 0], [Math.sin(z), Math.cos(z), 0], [0, 0, 1]])).roll).toBeCloseTo(-15)
  })

  it("returns zero angles for a face looking straight ahead", () => {
    const pose = poseFromMatrix(toColumnMajor([[1, 0, 0], [0, 1, 0], [0, 0, 1]]))
    expect(Math.abs(pose.yaw) + Math.abs(pose.pitch) + Math.abs(pose.roll)).toBeCloseTo(0)
  })
})

describe("eyesLookingAway", () => {
  it("flags strong sideways or downward eye movement only", () => {
    expect(eyesLookingAway({})).toBe(false)
    expect(eyesLookingAway({ eyeLookOutLeft: 0.8, eyeLookInRight: 0.8 })).toBe(true)
    expect(eyesLookingAway({ eyeLookDownLeft: 0.7, eyeLookDownRight: 0.7 })).toBe(true)
    expect(eyesLookingAway({ eyeLookOutLeft: 0.3, eyeLookInRight: 0.3 })).toBe(false)
  })
})

const front: FrameSample = { faceCount: 1, yaw: 3, pitch: -4, roll: 2, eyesOff: false, noseX: 1, noseY: 1 }

describe("CameraAccumulator", () => {
  it("needs a minimum number of frames", () => {
    const acc = new CameraAccumulator()
    for (let i = 0; i < 4; i++) acc.add(front)
    expect(acc.result()).toBeNull()
    acc.add(front)
    expect(acc.result()).toEqual(expect.objectContaining({ samples: 5, faceRatio: 1, gazeRatio: 1, movement: 0 }))
  })

  it("counts missing faces against visibility and posture against visible frames", () => {
    const acc = new CameraAccumulator()
    acc.add(front)
    acc.add({ ...front, yaw: 35 }) // 고개를 돌림
    acc.add({ ...front, pitch: 28 }) // 고개를 숙임
    acc.add({ ...front, roll: 20 }) // 기울임
    acc.add(null) // 얼굴 없음
    acc.add({ ...front, faceCount: 2 }) // 여러 명
    const result = acc.result()!
    expect(result.samples).toBe(6)
    expect(result.faceRatio).toBeCloseTo(4 / 6, 3)
    expect(result.gazeRatio).toBe(0.5) // front, roll 20 (기울기는 시선과 무관)
    expect(result.lookAwayRatio).toBe(0.25)
    expect(result.headDownRatio).toBe(0.25)
    expect(result.tiltRatio).toBe(0.25)
    expect(isLookingAtCamera({ ...front, eyesOff: true })).toBe(false)
  })

  it("measures head movement and resets between answers", () => {
    const acc = new CameraAccumulator()
    for (let i = 0; i < 10; i++) acc.add({ ...front, noseX: i % 2 === 0 ? 0.6 : 1.4 })
    expect(acc.result()!.movement).toBeCloseTo(0.4, 3)
    acc.reset()
    expect(acc.sampleCount).toBe(0)
    expect(acc.result()).toBeNull()
  })
})
