import { describe, expect, it } from "vitest";
import {
  analyzeCameraPosture,
  cameraPostureSummary,
  gazeLevel,
  movementLevel,
  parseCameraMetrics,
  type CameraMetrics,
} from "./camera-posture";

const good: CameraMetrics = {
  samples: 100, faceRatio: 1, gazeRatio: 0.9, lookAwayRatio: 0.05, headDownRatio: 0.05, tiltRatio: 0.1, movement: 0.1,
};

describe("parseCameraMetrics", () => {
  it("accepts a valid summary", () => {
    expect(parseCameraMetrics(JSON.stringify(good))).toEqual(good);
  });

  it("rejects missing, malformed, out-of-range or too-short data", () => {
    expect(parseCameraMetrics(undefined)).toBeNull();
    expect(parseCameraMetrics("not json")).toBeNull();
    expect(parseCameraMetrics(JSON.stringify({ ...good, gazeRatio: 1.5 }))).toBeNull();
    expect(parseCameraMetrics(JSON.stringify({ ...good, faceRatio: "1" }))).toBeNull();
    expect(parseCameraMetrics(JSON.stringify({ ...good, samples: 2 }))).toBeNull();
    expect(parseCameraMetrics(JSON.stringify({ ...good, movement: -1 }))).toBeNull();
  });
});

describe("analyzeCameraPosture", () => {
  it("returns null when no answer was analyzed", () => {
    expect(analyzeCameraPosture([])).toBeNull();
    expect(analyzeCameraPosture([null, null])).toBeNull();
  });

  it("praises a steady, camera-facing interview", () => {
    const report = analyzeCameraPosture([good, null])!;
    expect(report.analyzedCount).toBe(1);
    expect(report.faceVisiblePercent).toBe(100);
    expect(report.gazeOnPercent).toBe(90);
    expect(report.gazeLevel).toBe("good");
    expect(report.movementLevel).toBe("steady");
    expect(report.tips).toHaveLength(1);
    expect(report.tips[0]).toContain("안정적");
  });

  it("weights answers by frame count and flags each problem", () => {
    const poor: CameraMetrics = {
      samples: 300, faceRatio: 0.6, gazeRatio: 0.3, lookAwayRatio: 0.4, headDownRatio: 0.3, tiltRatio: 0.5, movement: 0.5,
    };
    const report = analyzeCameraPosture([good, poor])!;
    // 얼굴 비율: (100*1 + 300*0.6) / 400 = 0.7
    expect(report.faceVisiblePercent).toBe(70);
    // 시선: 얼굴이 보인 프레임(100, 180) 기준 → (90 + 54) / 280 ≈ 0.514
    expect(report.gazeOnPercent).toBe(51);
    expect(report.gazeLevel).toBe("fair");
    const tips = report.tips.join("\n");
    expect(tips).toContain("얼굴이 화면에 잘 보이지 않았습니다");
    expect(tips).toContain("카메라 렌즈");
    expect(tips).toContain("옆으로 돌린");
    expect(tips).toContain("숙이거나 든");
    expect(tips).toContain("기울인");
    expect(tips).toContain("많이 움직였습니다");
  });

  it("handles answers where the face was never visible", () => {
    const report = analyzeCameraPosture([{ ...good, faceRatio: 0 }])!;
    expect(report.faceVisiblePercent).toBe(0);
    expect(report.gazeOnPercent).toBeNull();
    expect(report.gazeLevel).toBe("unknown");
    expect(report.movementLevel).toBe("unknown");
  });
});

describe("levels and summary", () => {
  it("maps thresholds", () => {
    expect(gazeLevel(70)).toBe("good");
    expect(gazeLevel(69)).toBe("fair");
    expect(gazeLevel(49)).toBe("poor");
    expect(movementLevel(0.14)).toBe("steady");
    expect(movementLevel(0.2)).toBe("normal");
    expect(movementLevel(0.35)).toBe("restless");
  });

  it("builds a one-line prompt summary", () => {
    expect(cameraPostureSummary(null)).toBe("");
    const line = cameraPostureSummary(analyzeCameraPosture([good]));
    expect(line).toContain("카메라를 바라본 시간 90%");
    expect(line).toContain("참고용");
  });
});
