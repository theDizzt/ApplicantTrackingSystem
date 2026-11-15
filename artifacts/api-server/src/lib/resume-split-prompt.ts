import type { ResumeLanguage } from "./resume-language";

// ── 업로드 이력서: 본문 / 자기소개서 분리 프롬프트 ─────────────────────────────
// 한국어 이력서는 '성장과정', '지원동기' 같은 섹션으로 자기소개서를 구분하지만,
// 영문 이력서는 섹션 이름과 관례가 달라(Summary는 본문, Cover Letter는 별도 문서)
// 언어별 규칙을 따로 준다. 감지가 안 되면(null) 두 언어 규칙을 모두 준다.

const KO_RULES = `[한국어 이력서 규칙]
- 자기소개서(coverLetter): '자기소개서', '성장과정', '지원동기', '직무 역량', '입사 후 포부', '장단점', '성격의 장단점' 등 서술형 에세이 섹션 전체.
- 이력서 본문(resumeContent): 인적사항, 학력, 경력, 자격증, 어학, 수상, 활동, 프로젝트 등.`;

const EN_RULES = `[영문 이력서 규칙]
- 자기소개서(coverLetter): 'Cover Letter', 'Personal Statement', 'Statement of Purpose', 'Motivation Letter', 'Letter of Intent' 섹션, 그리고 'Dear Hiring Manager' / 'Dear ...'로 시작해 'Sincerely', 'Best regards' 등으로 끝나는 편지 형식의 글 전체.
- 이력서 본문(resumeContent): Contact, Summary, Professional Summary, Profile, Objective, Career Objective, Experience, Work History, Education, Skills, Projects, Certifications, Licenses, Publications, Awards, Languages, Volunteer, References 등.
- 주의: Summary·Profile·Objective는 짧은 요약(보통 1~5줄)이므로 자기소개서가 아니라 이력서 본문에 남깁니다.
- 경력·프로젝트의 bullet(•, -, *) 목록은 표로 바꾸지 말고 bullet 목록 그대로 유지합니다.`;

const LANGUAGE_HINT: Record<ResumeLanguage, string> = {
  ko: "이 문서는 한국어 이력서로 판정되었습니다.",
  en: "이 문서는 영문 이력서로 판정되었습니다.",
  mixed: "이 문서는 한국어와 영어가 섞인 이력서로 판정되었습니다(예: 영문 이력서 + 한글 자기소개서). 두 언어의 규칙을 모두 적용하세요.",
};

/** 감지된 언어에 맞는 이력서 분리 시스템 프롬프트를 만든다. */
export function buildResumeSplitPrompt(language: ResumeLanguage | null): string {
  const rules =
    language === "ko" ? KO_RULES
    : language === "en" ? EN_RULES
    : `${KO_RULES}\n\n${EN_RULES}`;
  const hint = language ? `\n${LANGUAGE_HINT[language]}\n` : "";

  return `당신은 이력서 파싱 전문가입니다. 아래 텍스트에서 이력서 본문과 자기소개서를 분리하고, 표 형태 데이터를 마크다운 테이블로 변환하세요.
${hint}
반환 형식 (JSON):
{
  "resumeContent": "이력서 본문 (자기소개서 완전 제외. 표는 마크다운 테이블로 변환)",
  "coverLetter":   "자기소개서 전체 텍스트 (없으면 빈 문자열)"
}

${rules}

공통 규칙:
1. 자기소개서로 분류한 섹션은 coverLetter에만 넣고 이력서 본문에서는 완전히 제거합니다.
2. 마크다운 테이블: 스페이스로 정렬된 열 데이터(학력, 경력, 자격증 목록 등)를 | 헤더1 | 헤더2 | 형식으로 변환합니다.
3. 이력서 본문(resumeContent)은 마크다운 테이블과 일반 텍스트(목록 포함)로만 구성하세요.
4. 원문의 언어를 그대로 유지하세요. 절대 번역하지 말고, 날짜·숫자·고유명사도 원문 표기 그대로 둡니다.
5. 오직 JSON만 반환하세요. 마크다운 코드 블록 없이.`;
}
