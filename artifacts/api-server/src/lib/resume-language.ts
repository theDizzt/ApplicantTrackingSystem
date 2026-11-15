import { resumeHtmlToText } from "./resume-text";

// ── 이력서 언어 감지 ──────────────────────────────────────────────────────────
// AI 호출 없이 어절(단어) 단위로 한글/라틴 비율을 세어 이력서 언어를 판정한다.
// 글자 수가 아니라 어절 수를 쓰는 이유: 한글은 한 어절이 짧고 영어는 길어서,
// 글자 수로 세면 기술 스택(React, TypeScript …)이 많은 한국어 이력서가 영어로 기운다.

export const RESUME_LANGUAGES = ["ko", "en", "mixed"] as const;
export type ResumeLanguage = (typeof RESUME_LANGUAGES)[number];

/** 한글 어절 비율이 이 값 이상이면 한국어 이력서로 본다. */
const KO_MIN_SHARE = 0.35;
/** 한글 어절 비율이 이 값 미만이면 영문 이력서로 본다(이름·주소 정도만 한글인 경우). */
const EN_MAX_SHARE = 0.1;
/** 판정에 필요한 최소 어절 수. 이보다 적으면 판단을 보류한다(null). */
const MIN_WORDS = 5;

const URL_OR_EMAIL = /\b(?:https?:\/\/|www\.)\S+|\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b|\b[\w-]+(?:\.[\w-]+)*\.(?:com|net|org|io|dev|kr|co)(?:\/\S*)?/gi;
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/;
const LATIN_WORD = /^[A-Za-z][A-Za-z'’-]*$/;

/**
 * 이력서 본문·자기소개서(HTML 또는 일반 텍스트)의 언어를 판정한다.
 * 반환: "ko" | "en" | "mixed", 판정할 만큼 단어가 없으면 null.
 */
export function detectResumeLanguage(...parts: Array<string | null | undefined>): ResumeLanguage | null {
  const text = parts
    .map((part) => resumeHtmlToText(part ?? ""))
    .join("\n")
    .replace(URL_OR_EMAIL, " ");

  let koWords = 0;
  let enWords = 0;
  for (const token of text.split(/[^\p{L}'’-]+/u)) {
    if (!token) continue;
    if (HANGUL.test(token)) koWords++;
    else if (LATIN_WORD.test(token) && token.length > 1) enWords++;
  }

  const total = koWords + enWords;
  if (total < MIN_WORDS) return null;

  const koShare = koWords / total;
  if (koShare >= KO_MIN_SHARE) return "ko";
  if (koShare < EN_MAX_SHARE) return "en";
  return "mixed";
}

/** 저장된 언어가 있으면 그대로, 없으면(기존 데이터) 본문에서 즉시 판정한다. */
export function resolveResumeLanguage(resume: {
  language?: string | null;
  content?: string | null;
  coverLetter?: string | null;
}): ResumeLanguage | null {
  const stored = resume.language;
  if (stored && (RESUME_LANGUAGES as readonly string[]).includes(stored)) {
    return stored as ResumeLanguage;
  }
  return detectResumeLanguage(resume.content, resume.coverLetter);
}
