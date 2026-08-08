import { checkAIHealth, type AIHealthCode } from "./openai";
import { logger } from "./logger";

// ── AI 서버 주기적 헬스체크 (5분마다) ────────────────────────────────────────
// 마지막 점검 결과를 메모리에 기록해 관리자 대시보드 배너로 노출한다.
// 장애가 시작된 시각(downSince)을 함께 추적해 "언제부터" 장애였는지 보여준다.

export interface AIHealthStatus {
  ok: boolean;
  code: AIHealthCode;
  error?: string;
  checkedAt: string;      // 마지막 점검 시각 (ISO)
  downSince: string | null; // 장애 시작 시각 (ISO) — 정상이면 null
}

let lastStatus: AIHealthStatus | null = null;
let downSince: Date | null = null;
let running = false;

export function getAIHealthStatus(): AIHealthStatus | null {
  return lastStatus;
}

export async function runAIHealthCheck(): Promise<AIHealthStatus> {
  if (running && lastStatus) return lastStatus; // 중복 실행 방지
  running = true;
  try {
    const result = await checkAIHealth();
    const now = new Date();
    if (!result.ok) {
      if (!downSince) {
        downSince = now;
        logger.warn({ code: result.code, error: result.error }, "🚨 AI 서버 장애 감지");
      }
    } else {
      if (downSince) {
        logger.info("✅ AI 서버 정상 복구");
      }
      downSince = null;
    }
    lastStatus = {
      ok: result.ok,
      code: result.code,
      error: result.error,
      checkedAt: now.toISOString(),
      downSince: downSince ? downSince.toISOString() : null,
    };
    return lastStatus;
  } finally {
    running = false;
  }
}
