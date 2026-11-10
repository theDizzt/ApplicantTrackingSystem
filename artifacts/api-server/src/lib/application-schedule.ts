import { APPLICATION_STATUSES } from "@workspace/db/schema";

/**
 * 회사 지원 일정 입력 정리 — 서류 마감일·결과 발표일·면접일(YYYY-MM-DD)과 지원 상태.
 *   undefined → 변경 없음, null/"" → 지우기, 그 밖의 값은 검사 후 저장. 잘못된 값은 오류 메시지를 돌려준다.
 */
export const SCHEDULE_DATE_FIELDS = ["deadlineDate", "announcementDate", "interviewDate"] as const;
export type ScheduleDateField = typeof SCHEDULE_DATE_FIELDS[number];

const DATE_LABEL: Record<ScheduleDateField, string> = {
  deadlineDate: "서류 마감일",
  announcementDate: "결과 발표일",
  interviewDate: "면접일",
};

/** "2026-11-30" 같은 실제 달력 날짜만 통과시킨다 (2월 30일 등은 거부). */
export function isCalendarDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

export type ScheduleInput = Partial<Record<ScheduleDateField | "applicationStatus", string | null>>;

export function parseScheduleInput(body: Record<string, unknown>):
  { ok: true; value: ScheduleInput } | { ok: false; error: string } {
  const value: ScheduleInput = {};
  for (const field of SCHEDULE_DATE_FIELDS) {
    const raw = body[field];
    if (raw === undefined) continue;
    if (raw === null || raw === "") { value[field] = null; continue; }
    if (typeof raw !== "string" || !isCalendarDate(raw.trim())) {
      return { ok: false, error: `${DATE_LABEL[field]}은 YYYY-MM-DD 형식의 날짜여야 합니다.` };
    }
    value[field] = raw.trim();
  }
  const status = body.applicationStatus;
  if (status !== undefined) {
    if (status === null || status === "") value.applicationStatus = null;
    else if (typeof status === "string" && (APPLICATION_STATUSES as readonly string[]).includes(status)) value.applicationStatus = status;
    else return { ok: false, error: `지원 상태는 ${APPLICATION_STATUSES.join("·")} 중 하나여야 합니다.` };
  }
  return { ok: true, value };
}
