import cron from "node-cron";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./lib/logger";
import { runAIHealthCheck } from "./lib/ai-health-monitor";

/**
 * 매주 월요일 오전 9시 (KST) 실행:
 * - 모든 회사의 isRecommended를 초기화 (이력서 기반 재추천 유도)
 * - synced_at 갱신 (이번 주 최신 공고 반영 완료 시각)
 */
export function startScheduler(): void {
  // "0 9 * * 1" = 월요일 09:00 KST
  cron.schedule(
    "0 9 * * 1",
    async () => {
      logger.info("🔄 [주간 업데이트] 회사 목록 동기화 시작");
      try {
        const result = await db.execute(
          sql`UPDATE companies SET is_recommended = false, synced_at = NOW()`
        );
        logger.info(
          { rowCount: (result as any).rowCount },
          "✅ [주간 업데이트] 완료 — 추천 초기화 및 동기화 시각 갱신"
        );
      } catch (err) {
        logger.error({ err }, "❌ [주간 업데이트] 실패");
      }
    },
    { timezone: "Asia/Seoul" }
  );

  // AI 서버 헬스체크 — 5분마다 + 서버 시작 직후 1회
  cron.schedule("*/5 * * * *", async () => {
    try {
      await runAIHealthCheck();
    } catch (err) {
      logger.error({ err }, "❌ AI 헬스체크 실행 실패");
    }
  });
  void runAIHealthCheck().catch((err) =>
    logger.error({ err }, "❌ 초기 AI 헬스체크 실패")
  );

  logger.info("⏰ 스케줄러 시작 — 매주 월요일 09:00 KST 회사 목록 자동 갱신, 5분마다 AI 헬스체크");
}
