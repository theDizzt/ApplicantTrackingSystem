import { detectResumeLanguage, type ResumeLanguage } from "./resume-language";

// ── 이력서 맞춤법 검토 프롬프트 ──────────────────────────────────────────────
// 이력서 본문과 자기소개서의 언어가 다를 수 있으므로(예: 영문 이력서 + 한글 자기소개서)
// 필드마다 언어를 판정해 각 필드에 맞는 교정 기준을 알려 준다.
// 수정 이유(reason)는 서비스 UI가 한국어이므로 항상 한국어로 받는다.

export interface SpellcheckLanguages {
  content: ResumeLanguage | null;
  coverLetter: ResumeLanguage | null;
}

/** 필드별 언어를 판정한다. 한쪽이 너무 짧아 판정이 안 되면 전체 텍스트 기준으로 채운다. */
export function detectSpellcheckLanguages(contentText: string, coverLetterText: string): SpellcheckLanguages {
  const overall = detectResumeLanguage(contentText, coverLetterText);
  return {
    content: contentText ? detectResumeLanguage(contentText) ?? overall : null,
    coverLetter: coverLetterText ? detectResumeLanguage(coverLetterText) ?? overall : null,
  };
}

const LANGUAGE_LABEL: Record<ResumeLanguage, string> = {
  ko: "한국어",
  en: "영어",
  mixed: "한국어·영어 혼용",
};

const KO_RULES = `[한국어 교정 기준]
- 국립국어원 표준 맞춤법·띄어쓰기·외래어 표기법을 기준으로 오탈자, 맞춤법, 문법 오류를 고칩니다.
- 문장 안에 섞인 영어 기술 용어(React, AWS 등)는 한글로 바꾸지 않습니다.`;

const EN_RULES = `[영어 교정 기준]
- 철자(spelling), 문법(grammar), 구두점(punctuation), 대소문자, 시제 일관성 오류를 고칩니다.
- 문서가 쓰는 철자 관례(미국식 color / 영국식 colour)를 유지하고, 한 문서 안에서 섞여 있으면 더 많이 쓰인 쪽으로 통일합니다.
- 이력서 bullet 특유의 주어 없는 문장("Led the migration of ...", "Built a payment API")은 올바른 형식이므로 완전한 문장으로 고치지 않습니다.
- 기술 용어·제품명·회사명·고유명사의 공식 표기(Node.js, PostgreSQL, GitHub, iOS)는 오류가 아닙니다. 공식 표기와 다르게 쓴 경우(Github, Postgresql)만 고칩니다.`;

/** 필드별 언어에 맞는 맞춤법 검토 시스템 프롬프트를 만든다. */
export function buildSpellcheckPrompt(languages: SpellcheckLanguages): string {
  const used = new Set<ResumeLanguage>();
  for (const language of [languages.content, languages.coverLetter]) {
    if (language) used.add(language);
  }
  // 판정이 하나도 안 되면 기존 동작(한국어)을 유지하되 영어 기준도 함께 준다.
  const needKo = used.size === 0 || used.has("ko") || used.has("mixed");
  const needEn = used.size === 0 || used.has("en") || used.has("mixed");
  const rules = [needKo ? KO_RULES : "", needEn ? EN_RULES : ""].filter(Boolean).join("\n\n");

  const fieldLines = [
    languages.content ? `- 이력서 내용(content): ${LANGUAGE_LABEL[languages.content]}` : "",
    languages.coverLetter ? `- 자기소개서(coverLetter): ${LANGUAGE_LABEL[languages.coverLetter]}` : "",
  ].filter(Boolean);
  const fieldInfo = fieldLines.length ? `\n판정된 작성 언어:\n${fieldLines.join("\n")}\n` : "";

  const role = needKo && needEn ? "한국어·영어 이력서 교정 전문가" : needEn ? "영문 이력서 교정 전문가" : "한국어 교정 전문가";

  return `당신은 ${role}입니다. 이력서와 자기소개서의 오탈자, 맞춤법 오류, 문법 오류를 찾아 수정합니다.
${fieldInfo}
${rules}

공통 규칙:
- 원문의 언어를 그대로 유지하세요. 절대 번역하지 말고, 오류가 아닌 표현은 바꾸지 마세요(문체 다듬기·내용 추가 금지).
- "reason"(수정 이유)은 항상 한국어로 짧게 씁니다.

반드시 JSON 형식으로만 응답하세요:
{
  "corrections": [
    { "field": "content" | "coverLetter", "original": "오류 원문", "corrected": "수정된 텍스트", "reason": "수정 이유" }
  ],
  "contentCorrected": "교정된 이력서 전체 텍스트",
  "coverLetterCorrected": "교정된 자기소개서 전체 텍스트"
}
오류가 없으면 corrections 배열은 비워두고, 원문을 그대로 반환하세요.
HTML 태그는 결과에 포함하지 마세요. 순수 텍스트로만 반환하세요.`;
}
