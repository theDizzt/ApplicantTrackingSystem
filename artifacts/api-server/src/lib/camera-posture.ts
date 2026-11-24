// 실시간(음성) 면접 카메라 자세·시선 분석. AI 호출 없이 규칙으로 계산한다.
// 영상은 서버로 보내지 않는다. 브라우저가 답변마다 얼굴 추적 결과를 숫자로 요약해 보내고,
// 서버는 그 숫자를 검사해 저장한 뒤 조회할 때마다 면접 전체 리포트로 묶는다.

/** 브라우저가 답변 하나에 대해 보내는 요약 (비율은 0~1) */
export interface CameraMetrics {
  /** 분석한 프레임 수 */
  samples: number;
  /** 얼굴이 하나만 또렷하게 보인 프레임 비율 */
  faceRatio: number;
  /** 얼굴이 보인 프레임 중 카메라(화면)를 바라본 비율 */
  gazeRatio: number;
  /** 얼굴이 보인 프레임 중 고개를 옆으로 돌린 비율 */
  lookAwayRatio: number;
  /** 얼굴이 보인 프레임 중 고개를 숙이거나 든 비율 */
  headDownRatio: number;
  /** 얼굴이 보인 프레임 중 고개를 옆으로 기울인 비율 */
  tiltRatio: number;
  /** 코 위치의 흔들림 (두 눈 사이 거리 기준 표준편차). 클수록 많이 움직였다 */
  movement: number;
}

export type MovementLevel = "steady" | "normal" | "restless" | "unknown";
export type GazeLevel = "good" | "fair" | "poor" | "unknown";

export interface CameraPostureReport {
  analyzedCount: number;
  /** 이하 비율은 0~100 정수(%) */
  faceVisiblePercent: number;
  gazeOnPercent: number | null;
  lookAwayPercent: number | null;
  headDownPercent: number | null;
  tiltPercent: number | null;
  gazeLevel: GazeLevel;
  movementLevel: MovementLevel;
  tips: string[];
}

/** 답변 하나를 분석에 쓰려면 이 정도 프레임은 있어야 한다 (약 5fps 기준 1초) */
export const MIN_CAMERA_SAMPLES = 5;
export const GAZE_GOOD_FROM = 70;
export const GAZE_FAIR_FROM = 50;
export const FACE_VISIBLE_MIN = 80;
export const LOOK_AWAY_MAX = 20;
export const HEAD_DOWN_MAX = 20;
export const TILT_MAX = 30;
export const MOVEMENT_STEADY_BELOW = 0.15;
export const MOVEMENT_RESTLESS_FROM = 0.35;

const RATIO_KEYS = ["faceRatio", "gazeRatio", "lookAwayRatio", "headDownRatio", "tiltRatio"] as const;

/** 브라우저가 보낸 JSON 문자열을 검사한다. 형식이 틀리거나 프레임이 너무 적으면 null (답변 처리는 계속한다) */
export function parseCameraMetrics(raw: unknown): CameraMetrics | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2_000) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const samples = obj.samples;
  if (typeof samples !== "number" || !Number.isInteger(samples) || samples < MIN_CAMERA_SAMPLES || samples > 100_000) return null;
  const out: Partial<CameraMetrics> = { samples };
  for (const key of RATIO_KEYS) {
    const v = obj[key];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) return null;
    out[key] = Math.round(v * 1000) / 1000;
  }
  const movement = obj.movement;
  if (typeof movement !== "number" || !Number.isFinite(movement) || movement < 0 || movement > 10) return null;
  out.movement = Math.round(movement * 1000) / 1000;
  return out as CameraMetrics;
}

/** DB에 저장된 값(JSON 문자열)을 다시 읽는다. 저장할 때 검사했으므로 같은 검사를 다시 쓴다. */
export function readStoredCameraMetrics(stored: string | null | undefined): CameraMetrics | null {
  return stored ? parseCameraMetrics(stored) : null;
}

const percent = (value: number) => Math.round(value * 100);

function weightedAverage(items: { value: number; weight: number }[]): number | null {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) return null;
  return items.reduce((sum, item) => sum + item.value * item.weight, 0) / total;
}

export function gazeLevel(gazeOnPercent: number | null): GazeLevel {
  if (gazeOnPercent == null) return "unknown";
  if (gazeOnPercent >= GAZE_GOOD_FROM) return "good";
  if (gazeOnPercent >= GAZE_FAIR_FROM) return "fair";
  return "poor";
}

export function movementLevel(movement: number | null): MovementLevel {
  if (movement == null) return "unknown";
  if (movement < MOVEMENT_STEADY_BELOW) return "steady";
  if (movement >= MOVEMENT_RESTLESS_FROM) return "restless";
  return "normal";
}

/** 답변별 요약을 면접 전체 리포트로 묶는다. 카메라로 분석한 답변이 없으면 null */
export function analyzeCameraPosture(items: (CameraMetrics | null)[]): CameraPostureReport | null {
  const metrics = items.filter((item): item is CameraMetrics => item != null);
  if (metrics.length === 0) return null;

  // 얼굴이 보인 비율은 전체 프레임 기준, 나머지는 얼굴이 보인 프레임 기준으로 가중 평균한다
  const faceVisible = weightedAverage(metrics.map((m) => ({ value: m.faceRatio, weight: m.samples }))) ?? 0;
  const faceWeighted = (key: (typeof RATIO_KEYS)[number] | "movement") =>
    weightedAverage(metrics.map((m) => ({ value: m[key], weight: m.samples * m.faceRatio })));

  const gaze = faceWeighted("gazeRatio");
  const lookAway = faceWeighted("lookAwayRatio");
  const headDown = faceWeighted("headDownRatio");
  const tilt = faceWeighted("tiltRatio");
  const movement = faceWeighted("movement");

  const report: CameraPostureReport = {
    analyzedCount: metrics.length,
    faceVisiblePercent: percent(faceVisible),
    gazeOnPercent: gaze == null ? null : percent(gaze),
    lookAwayPercent: lookAway == null ? null : percent(lookAway),
    headDownPercent: headDown == null ? null : percent(headDown),
    tiltPercent: tilt == null ? null : percent(tilt),
    gazeLevel: gazeLevel(gaze == null ? null : percent(gaze)),
    movementLevel: movementLevel(movement),
    tips: [],
  };
  report.tips = cameraTips(report);
  return report;
}

export function cameraTips(report: CameraPostureReport): string[] {
  const tips: string[] = [];
  if (report.faceVisiblePercent < FACE_VISIBLE_MIN) {
    tips.push(`답변 시간의 ${100 - report.faceVisiblePercent}% 동안 얼굴이 화면에 잘 보이지 않았습니다. 카메라를 눈높이에 두고 얼굴이 화면 가운데 오게 앉아 보세요.`);
  }
  if (report.gazeLevel === "poor" || report.gazeLevel === "fair") {
    tips.push(`카메라를 바라본 시간이 ${report.gazeOnPercent}%입니다. 화상 면접에서는 화면 속 면접관이 아니라 카메라 렌즈를 보는 것이 눈을 맞추는 것입니다.`);
  }
  if (report.lookAwayPercent != null && report.lookAwayPercent > LOOK_AWAY_MAX) {
    tips.push(`고개를 옆으로 돌린 시간이 ${report.lookAwayPercent}%입니다. 생각할 때 시선이 옆으로 가는 습관이 있다면, 잠깐 멈추더라도 정면을 보고 생각해 보세요.`);
  }
  if (report.headDownPercent != null && report.headDownPercent > HEAD_DOWN_MAX) {
    tips.push(`고개를 숙이거나 든 시간이 ${report.headDownPercent}%입니다. 메모를 읽는 것처럼 보일 수 있으니, 메모는 카메라 바로 아래에 두거나 핵심 단어만 적어 두세요.`);
  }
  if (report.tiltPercent != null && report.tiltPercent > TILT_MAX) {
    tips.push(`고개를 옆으로 기울인 시간이 ${report.tiltPercent}%입니다. 어깨와 고개를 바르게 세우면 더 자신 있어 보입니다.`);
  }
  if (report.movementLevel === "restless") {
    tips.push("답변하는 동안 몸이나 고개가 많이 움직였습니다. 의자에 등을 붙이고 앉으면 자세가 안정됩니다.");
  }
  if (tips.length === 0) {
    tips.push("자세와 시선이 안정적이었습니다. 지금처럼 카메라를 바라보며 답하세요.");
  }
  return tips;
}

/** 종합 평가 AI에 붙일 한 줄 요약 (분석이 없으면 빈 문자열) */
export function cameraPostureSummary(report: CameraPostureReport | null): string {
  if (!report) return "";
  const parts = [
    `얼굴이 보인 시간 ${report.faceVisiblePercent}%`,
    report.gazeOnPercent != null ? `카메라를 바라본 시간 ${report.gazeOnPercent}%` : null,
    report.lookAwayPercent != null ? `고개를 돌린 시간 ${report.lookAwayPercent}%` : null,
    report.headDownPercent != null ? `고개를 숙이거나 든 시간 ${report.headDownPercent}%` : null,
    report.movementLevel === "restless" ? "움직임이 많음" : null,
  ].filter(Boolean);
  return `\n\n카메라 자세·시선 분석(자동 측정, 참고용): ${parts.join(", ")}. 종합 피드백에 필요하면 한 문장으로만 짧게 언급하세요.`;
}
