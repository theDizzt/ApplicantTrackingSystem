// 면접 대비 보완점: 이력서·자기소개서에서 읽는 사람이 오해하거나 면접에서 질문받기 쉬운
// 표현을 찾아 "원문 → 받을 수 있는 인상 → 고친 문장 → 면접 준비"로 정리한다 (회의 #8 참고 화면 1).
// 문서 표현에 대한 피드백이며, 성격 진단이나 합격·불합격 판단이 아니다.

import { isQuoteInSource, normalizeForMatch, type ScoreFactor } from "./score-evidence";
import { resumeHtmlToText } from "./resume-text";

export interface InterviewPrepPoint {
  /** 보완점 제목 (예: "PL 역할과 개발 역할의 범위가 모호함") */
  title: string;
  /** 이력서·자기소개서 원문 인용 */
  quote: string;
  /** 인용문이 원문에 실제로 있는지 서버가 확인한 결과 */
  quoteVerified: boolean;
  /** 읽는 사람이 받을 수 있는 인상 */
  impression: string;
  /** 이렇게 고쳐보세요 (고친 문장 예시) */
  rewrite: string;
  /** 면접에서 이 부분을 어떻게 설명할지 */
  interviewTip: string;
}

export interface InterviewPrep {
  points: InterviewPrepPoint[];
}

export const MAX_PREP_POINTS = 4;
const RESUME_LIMIT = 6000;
const COVER_LETTER_LIMIT = 3000;
const COMPANY_LIMIT = 1500;
const QUOTE_LIMIT = 120;

export const INTERVIEW_PREP_SYSTEM = `당신은 채용 담당자 출신의 면접 코치입니다. 지원자의 이력서·자기소개서에서 서류를 읽는 사람이 오해하거나, 면접에서 반드시 질문받을 만한 표현을 찾아 면접 전에 점검할 보완점으로 정리하세요.
오직 JSON만 반환하세요:
{
  "points": [{
    "title": "보완점 제목 (30자 이내, 예: PL 역할과 개발 역할의 범위가 모호함)",
    "quote": "문제가 되는 이력서·자기소개서 원문을 그대로 짧게 인용 (80자 이내)",
    "impression": "이 문장에서 읽는 사람이 받을 수 있는 인상 (한국어 1~2문장)",
    "rewrite": "이렇게 고쳐 쓰면 좋다는 고친 문장 예시와 이유 (한국어 1~3문장)",
    "interviewTip": "면접에서 이 부분을 질문받으면 어떻게 설명할지 (한국어 1~3문장)"
  }]
}

작성 규칙:
- points는 면접에 미치는 영향이 큰 순서로 2~${MAX_PREP_POINTS}개입니다. 정말 문제가 없으면 빈 배열도 됩니다.
- 찾을 것: 역할·기여 범위가 모호한 표현, 기간·날짜가 서로 맞지 않는 표기, 근거 없이 과장된 표현, 성과가 수치 없이 뭉뚱그려진 문장, 공고 요건과 연결되지 않는 경험 서술, 앞뒤가 맞지 않는 내용.
- quote는 반드시 원문에 있는 글자 그대로 옮기세요. 요약하거나 바꿔 쓰지 마세요.
- impression은 "문장에서 받을 수 있는 인상"입니다. 지원자의 실제 성격·능력을 단정하지 마세요.
- rewrite와 interviewTip은 원문에 있는 사실 안에서만 쓰세요. 원문에 없는 수치·기간·성과를 지어내지 말고, 지원자가 채워야 할 자리는 [ ]로 표시하세요 (예: "처리 시간을 [ ]% 줄였습니다").
- interviewTip은 상황-행동-결과 순서로 설명하는 방법처럼 바로 연습할 수 있게 쓰세요.
- 외모·사진·나이·성별·가족·종교·출신 지역은 보완점으로 다루지 마세요.
- 맞춤법 같은 사소한 표기보다 면접에서 질문으로 이어질 내용을 우선하세요.`;

function clip(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** AI에 넘길 입력. 이력서는 HTML을 글로 바꾸고 길이를 제한해 토큰을 아낀다. */
export function buildInterviewPrepInput(opts: {
  resumeContent: string | null | undefined;
  coverLetter: string | null | undefined;
  companyText: string;
  minusFactors: ScoreFactor[];
}): string {
  const resume = resumeHtmlToText(opts.resumeContent ?? "");
  const cover = resumeHtmlToText(opts.coverLetter ?? "");
  const lines: string[] = [`[지원 회사]\n${clip(opts.companyText, COMPANY_LIMIT)}`];
  if (resume) lines.push(`[이력서]\n${clip(resume, RESUME_LIMIT)}`);
  if (cover) lines.push(`[자기소개서]\n${clip(cover, COVER_LETTER_LIMIT)}`);
  if (opts.minusFactors.length > 0) {
    lines.push(
      "[서류 심사에서 나온 감점 요인 — 참고용]\n" +
        opts.minusFactors.map((f) => `- ${f.reason}${f.quote ? ` (근거: "${f.quote}")` : ""}`).join("\n"),
    );
  }
  return lines.join("\n\n");
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * AI 응답을 정제한다. 제목·인상·고친 문장이 없는 항목은 버리고,
 * 인용문은 이력서·자기소개서 원문과 대조해 quoteVerified를 붙인다.
 */
export function sanitizeInterviewPrep(raw: Record<string, unknown>, sourceText: string): InterviewPrep {
  const source = normalizeForMatch(sourceText);
  const seen = new Set<string>();
  const points: InterviewPrepPoint[] = [];
  for (const item of Array.isArray(raw.points) ? raw.points : []) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const title = str(r.title);
    const impression = str(r.impression);
    const rewrite = str(r.rewrite);
    if (!title || !impression || !rewrite) continue;
    if (seen.has(title)) continue;
    seen.add(title);
    const quote = clip(str(r.quote), QUOTE_LIMIT);
    points.push({
      title,
      quote,
      quoteVerified: quote !== "" && isQuoteInSource(quote, source),
      impression,
      rewrite,
      interviewTip: str(r.interviewTip),
    });
    if (points.length >= MAX_PREP_POINTS) break;
  }
  // 원문에서 확인된 보완점을 앞에 둔다
  points.sort((a, b) => Number(b.quoteVerified) - Number(a.quoteVerified));
  return { points };
}
