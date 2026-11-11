/**
 * 채용공고에서 지원 일정(서류 마감일·결과 발표일·면접일)을 뽑는다.
 *
 * ● 사람인 검색 목록의 마감 표시("~ 11/30(일)", "오늘마감", "D-3")는 규칙으로 읽는다.
 * ● 공고 본문은 AI로 읽되, 공고에 적힌 날짜만 근거 문장과 함께 받고 형식·범위를 검사한다.
 */
import { getAI } from "./openai";
import { isCalendarDate, SCHEDULE_DATE_FIELDS, type ScheduleDateField } from "./application-schedule";

const DAY_MS = 24 * 60 * 60 * 1000;

/** 한국 시간 기준 오늘 (UTC 자정 Date로 표현). */
export function seoulToday(now: Date = new Date()): Date {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
}

function toKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * 사람인 목록의 마감 표시를 YYYY-MM-DD로 바꾼다. 상시채용·채용시 마감 등 날짜가 없으면 null.
 * 연도가 없는 "~ 1/5"는 오늘보다 30일 넘게 지난 날짜면 내년으로 본다 (연말에 다음 해 1월 마감 공고).
 */
export function parseSaraminDeadline(text: string | undefined, now: Date = new Date()): string | null {
  if (!text) return null;
  const t = text.replace(/\s+/g, " ").trim();
  const today = seoulToday(now);
  if (/오늘\s*마감/.test(t)) return toKey(today);
  if (/내일\s*마감/.test(t)) return toKey(new Date(today.getTime() + DAY_MS));
  const dday = /D\s*-\s*(\d{1,3})/i.exec(t);
  if (dday) return toKey(new Date(today.getTime() + Number(dday[1]) * DAY_MS));

  const full = /(\d{4})[./-]\s*(\d{1,2})[./-]\s*(\d{1,2})/.exec(t);
  if (full) {
    const key = `${full[1]}-${full[2].padStart(2, "0")}-${full[3].padStart(2, "0")}`;
    return isCalendarDate(key) ? key : null;
  }
  const md = /(\d{1,2})\s*\/\s*(\d{1,2})/.exec(t);
  if (md) {
    let year = today.getUTCFullYear();
    const build = (y: number) => `${y}-${md[1].padStart(2, "0")}-${md[2].padStart(2, "0")}`;
    if (!isCalendarDate(build(year))) return null;
    if (new Date(`${build(year)}T00:00:00Z`).getTime() < today.getTime() - 30 * DAY_MS) year += 1;
    return isCalendarDate(build(year)) ? build(year) : null;
  }
  return null;
}

export type ExtractedDate = { date: string; evidence: string };
export type ExtractedSchedule = Partial<Record<ScheduleDateField, ExtractedDate>>;

const FIELD_HINT: Record<ScheduleDateField, string> = {
  deadlineDate: "서류 접수 마감일 (접수기간의 끝 날짜)",
  announcementDate: "서류 합격자(결과) 발표일",
  interviewDate: "면접일 (기간이면 첫날)",
};

/**
 * 공고 본문에서 일정을 뽑는다. 공고에 날짜가 명시된 항목만 돌려준다.
 * 오늘 기준 1년 전 ~ 2년 후 범위 밖의 날짜는 잘못 읽은 것으로 보고 버린다.
 */
export async function extractPostingDates(postingText: string, now: Date = new Date()): Promise<ExtractedSchedule> {
  const text = postingText.replace(/\s+\n/g, "\n").trim().slice(0, 12000);
  if (!text) return {};
  const today = seoulToday(now);
  const todayKey = toKey(today);

  const ai = await getAI("light");
  const completion = await ai.openai.chat.completions.create({
    model: ai.model,
    messages: [
      {
        role: "system",
        content: `당신은 채용공고에서 일정을 읽는 도우미입니다. 오늘은 ${todayKey}(한국 시간)입니다.
JSON 객체만 반환하세요:
{${SCHEDULE_DATE_FIELDS.map((f) => `"${f}": {"date": "YYYY-MM-DD" 또는 "", "evidence": "공고 원문 그대로의 근거 문장" 또는 ""}`).join(", ")}}
항목 뜻:
${SCHEDULE_DATE_FIELDS.map((f) => `- ${f}: ${FIELD_HINT[f]}`).join("\n")}
규칙:
- 공고에 날짜가 적혀 있을 때만 채우세요. "추후 안내", "개별 통보", "채용 시 마감", "상시채용"처럼 날짜가 없으면 빈 문자열로 두세요.
- 날짜를 추측하거나 계산해서 만들지 마세요. (예: "마감 후 1주일 이내" → 빈 문자열)
- 연도가 없는 날짜는 오늘(${todayKey}) 이후 가장 가까운 해로 정하세요.
- evidence에는 그 날짜가 들어 있는 공고 문장을 고치지 말고 그대로 옮기세요 (80자 이내).`,
      },
      { role: "user", content: text },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 4000,
  });

  const raw = (completion.choices[0]?.message?.content ?? "")
    .replace(/```json?\s*/gi, "").replace(/```\s*/g, "").trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return {};
  let data: Record<string, unknown>;
  try { data = JSON.parse(match[0]) as Record<string, unknown>; } catch { return {}; }

  const min = today.getTime() - 365 * DAY_MS;
  const max = today.getTime() + 2 * 365 * DAY_MS;
  const result: ExtractedSchedule = {};
  for (const field of SCHEDULE_DATE_FIELDS) {
    const item = (data[field] ?? {}) as Record<string, unknown>;
    const date = typeof item.date === "string" ? item.date.trim() : "";
    const evidence = typeof item.evidence === "string" ? item.evidence.trim().slice(0, 120) : "";
    if (!isCalendarDate(date)) continue;
    const time = new Date(`${date}T00:00:00Z`).getTime();
    if (time < min || time > max) continue;
    result[field] = { date, evidence };
  }
  return result;
}
