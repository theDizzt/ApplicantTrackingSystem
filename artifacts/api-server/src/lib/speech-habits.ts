// 실시간(음성) 면접 말버릇 분석. AI를 부르지 않고, 받아 적은 답변과 녹음 길이로 규칙에 따라 센다.
// 음성 인식(STT)이 "음·어" 같은 소리를 빼고 적는 경우가 있어 실제보다 적게 셀 수 있다(화면에 안내).

export interface SpeechAnswer {
  questionId: number;
  question: string;
  answer: string | null;
  answerSeconds: number | null;
}

export interface CountItem {
  word: string;
  count: number;
}

export type PaceLevel = "slow" | "normal" | "fast" | "unknown";

export interface SpeechHabitReport {
  answeredCount: number;
  totalSeconds: number;
  averageAnswerSeconds: number | null;
  /** 분당 음절 수. 녹음 길이를 모르면 null */
  syllablesPerMinute: number | null;
  paceLevel: PaceLevel;
  /** 음·어 같은 간투사 */
  fillerCount: number;
  fillersPerMinute: number | null;
  fillers: CountItem[];
  /** 이제·약간·그냥 같은 습관어 */
  habitWords: CountItem[];
  /** "~것 같습니다" 같은 습관 표현 */
  habitPhrases: CountItem[];
  /** 질문에 없는데 답변에서 자주 반복한 단어 */
  repeatedWords: CountItem[];
  answers: { questionId: number; seconds: number | null; syllablesPerMinute: number | null; fillerCount: number; length: "short" | "long" | "ok" | "unknown" }[];
  tips: string[];
}

/** 분당 음절 수 기준 (한국어 발표 기준의 대략값, 참고용) */
export const PACE_SLOW_BELOW = 200;
export const PACE_FAST_ABOVE = 350;
const SHORT_ANSWER_SECONDS = 15;
const LONG_ANSWER_SECONDS = 150;

/** 간투사: 단어 하나가 통째로 이 모양일 때만 센다 (음, 음음, 어어, 으음, 아, 흠, 엄, 에) */
const FILLER_PATTERN = /^(음+|으+음*|어+|아+|흠+|엄+|에+)$/;

/** 습관어(군말·강조 부사). 단어 하나가 정확히 이 형태일 때만 센다. */
const HABIT_WORDS = [
  "이제", "약간", "그냥", "막", "좀", "진짜", "되게", "사실", "그러니까", "뭔가", "일단", "솔직히", "아무튼", "뭐", "정말", "너무",
];
const HABIT_WORD_SET = new Set(HABIT_WORDS);

/** 습관 표현 */
const HABIT_PHRASES: { label: string; pattern: RegExp }[] = [
  { label: "~것 같습니다", pattern: /것\s*같(습니다|아요|다|은데|네요|고)/g },
  { label: "~같은 경우", pattern: /같은\s*경우/g },
  { label: "~부분", pattern: /부분(?=에서|에|이|은|을|도|이고|입니다|[\s,.?!]|$)/g },
  { label: "어떻게 보면", pattern: /어떻게\s*보면/g },
  { label: "뭐랄까", pattern: /뭐랄까/g },
  { label: "그런 식으로", pattern: /그런\s*식으로/g },
  { label: "~라고 해야 할까", pattern: /해야\s*(할까|될까)/g },
];

/** 반복 단어 집계에서 빼는 흔한 기능어 */
const STOPWORDS = new Set([
  "저", "제", "저는", "제가", "저희", "저희는", "그리고", "그래서", "하지만", "그런데", "또한", "또", "및",
  "있습니다", "했습니다", "합니다", "입니다", "됩니다", "되었습니다", "있었습니다", "없습니다", "같습니다",
  "있는", "하는", "했던", "되는", "된", "한", "할", "수", "것", "것을", "것이", "등", "더", "잘", "많이",
  "위해", "위해서", "통해", "통해서", "대한", "대해", "대해서", "이런", "그런", "그때", "때문에", "때",
  "이", "그", "그것", "이것", "어떤", "어떻게", "왜", "네", "예", "가장", "다른", "같은", "모든",
]);

const JOSA_SUFFIX = /(에서는|에서|으로|에게|까지|부터|처럼|보다|이라는|라는|이나|는|은|이|가|을|를|에|로|와|과|도|만|의)$/;

function tokens(text: string): string[] {
  return text
    .split(/[\s,.!?…·~"'“”‘’()[\]{}:;/\\-]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function stem(token: string): string {
  const stripped = token.replace(JOSA_SUFFIX, "");
  return stripped.length >= 2 ? stripped : token;
}

/** 말 속도 계산용 음절 수: 한글 음절 + 영문·숫자 단어는 2음절로 친다 */
export function countSyllables(text: string): number {
  const hangul = (text.match(/[가-힣]/g) ?? []).length;
  const latinWords = (text.match(/[A-Za-z0-9]+/g) ?? []).length;
  return hangul + latinWords * 2;
}

function perMinute(count: number, seconds: number): number | null {
  return seconds >= 10 ? Math.round((count / (seconds / 60)) * 10) / 10 : null;
}

function sortCounts(map: Map<string, number>, min = 1): CountItem[] {
  return [...map.entries()]
    .filter(([, count]) => count >= min)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, "ko"));
}

function bump(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

export function paceLevel(syllablesPerMinute: number | null): PaceLevel {
  if (syllablesPerMinute == null) return "unknown";
  if (syllablesPerMinute < PACE_SLOW_BELOW) return "slow";
  if (syllablesPerMinute > PACE_FAST_ABOVE) return "fast";
  return "normal";
}

/** 답한 질문이 없으면 null */
export function analyzeSpeechHabits(items: SpeechAnswer[]): SpeechHabitReport | null {
  const answered = items.filter((item): item is SpeechAnswer & { answer: string } => typeof item.answer === "string" && item.answer.trim().length > 0);
  if (answered.length === 0) return null;

  const fillers = new Map<string, number>();
  const habitWords = new Map<string, number>();
  const habitPhrases = new Map<string, number>();
  const wordCounts = new Map<string, number>();
  const questionWords = new Set(items.flatMap((item) => tokens(item.question).map(stem)));
  let totalTokens = 0;
  let timedSyllables = 0;
  let timedSeconds = 0;
  let timedFillers = 0;
  let totalSeconds = 0;

  const answers = answered.map((item) => {
    const words = tokens(item.answer);
    totalTokens += words.length;
    let fillerCount = 0;
    for (const word of words) {
      if (FILLER_PATTERN.test(word)) {
        fillerCount += 1;
        bump(fillers, word.replace(/(.)\1+$/, "$1"));
      } else if (HABIT_WORD_SET.has(word)) {
        bump(habitWords, word);
      } else if (/[가-힣]/.test(word) && word.length >= 2) {
        const key = stem(word);
        if (!STOPWORDS.has(word) && !STOPWORDS.has(key) && !questionWords.has(key)) bump(wordCounts, key);
      }
    }
    for (const { label, pattern } of HABIT_PHRASES) {
      const matches = item.answer.match(pattern);
      if (matches) bump(habitPhrases, label, matches.length);
    }

    const seconds = item.answerSeconds != null && item.answerSeconds > 0 ? item.answerSeconds : null;
    const syllables = countSyllables(item.answer);
    if (seconds != null) {
      totalSeconds += seconds;
      timedSeconds += seconds;
      timedSyllables += syllables;
      timedFillers += fillerCount;
    }
    return {
      questionId: item.questionId,
      seconds,
      syllablesPerMinute: seconds != null ? perMinute(syllables, seconds) : null,
      fillerCount,
      length: seconds == null ? "unknown" as const
        : seconds < SHORT_ANSWER_SECONDS ? "short" as const
        : seconds > LONG_ANSWER_SECONDS ? "long" as const
        : "ok" as const,
    };
  });

  const fillerCount = [...fillers.values()].reduce((sum, count) => sum + count, 0);
  const syllablesPerMinute = timedSeconds > 0 ? perMinute(timedSyllables, timedSeconds) : null;
  const fillersPerMinute = timedSeconds > 0 ? perMinute(timedFillers, timedSeconds) : null;
  const timedAnswers = answers.filter((answer) => answer.seconds != null);
  const repeatMin = Math.max(3, Math.ceil(totalTokens * 0.015));

  const report: SpeechHabitReport = {
    answeredCount: answered.length,
    totalSeconds: Math.round(totalSeconds),
    averageAnswerSeconds: timedAnswers.length > 0 ? Math.round(totalSeconds / timedAnswers.length) : null,
    syllablesPerMinute: syllablesPerMinute != null ? Math.round(syllablesPerMinute) : null,
    paceLevel: paceLevel(syllablesPerMinute),
    fillerCount,
    fillersPerMinute,
    fillers: sortCounts(fillers),
    habitWords: sortCounts(habitWords),
    habitPhrases: sortCounts(habitPhrases),
    repeatedWords: sortCounts(wordCounts, repeatMin).slice(0, 5),
    answers,
    tips: [],
  };
  report.tips = speechTips(report);
  return report;
}

/** 분석 결과로 연습 방향을 정한다. 기준에 걸리는 것이 없으면 칭찬 한 줄. */
export function speechTips(report: Omit<SpeechHabitReport, "tips">): string[] {
  const tips: string[] = [];
  const minutes = report.totalSeconds / 60;
  const frequent = (count: number) => count >= 3 && (minutes <= 0 || count / Math.max(minutes, 1) >= 1.5);

  if (report.fillersPerMinute != null ? report.fillersPerMinute >= 4 : report.fillerCount >= 5) {
    tips.push(`'음·어' 같은 소리가 ${report.fillerCount}번 나왔습니다${report.fillersPerMinute != null ? ` (1분에 약 ${report.fillersPerMinute}번)` : ""}. 말이 막힐 때 소리를 내는 대신 1초 정도 멈췄다가 이어 가는 연습을 해 보세요.`);
  }
  const topHabit = report.habitWords[0];
  if (topHabit && frequent(topHabit.count)) {
    const others = report.habitWords.slice(1, 3).filter((item) => item.count >= 2).map((item) => `'${item.word}'(${item.count}번)`);
    tips.push(`'${topHabit.word}'를 ${topHabit.count}번 썼습니다${others.length ? `. ${others.join(", ")}도 자주 나옵니다` : ""}. 답변을 녹음해 다시 들으며 이 말을 빼고 말해 보세요.`);
  }
  const hedge = report.habitPhrases.find((item) => item.word === "~것 같습니다");
  if (hedge && hedge.count >= 2) {
    tips.push(`'~것 같습니다'를 ${hedge.count}번 썼습니다. 자기 경험을 말할 때는 '~했습니다', '~입니다'처럼 단정해야 자신감 있게 들립니다.`);
  }
  const otherPhrase = report.habitPhrases.find((item) => item.word !== "~것 같습니다" && item.count >= 3);
  if (otherPhrase) {
    tips.push(`'${otherPhrase.word}' 표현을 ${otherPhrase.count}번 썼습니다. 같은 표현이 반복되면 준비한 답을 외운 것처럼 들릴 수 있습니다.`);
  }
  const repeated = report.repeatedWords[0];
  if (repeated) {
    tips.push(`'${repeated.word}'를 ${repeated.count}번 반복했습니다. 비슷한 뜻의 다른 표현이나 구체적인 사실·수치로 바꿔 보세요.`);
  }
  if (report.paceLevel === "fast") {
    tips.push(`말이 빠른 편입니다 (분당 약 ${report.syllablesPerMinute}음절). 긴장하면 더 빨라지니, 문장 끝에서 한 박자 쉬어 가세요.`);
  } else if (report.paceLevel === "slow") {
    tips.push(`말이 느린 편입니다 (분당 약 ${report.syllablesPerMinute}음절). 핵심 문장을 미리 정해 두면 머뭇거림이 줄어듭니다.`);
  }
  const shortCount = report.answers.filter((answer) => answer.length === "short").length;
  if (shortCount >= 2) {
    tips.push(`${shortCount}개 답변이 ${SHORT_ANSWER_SECONDS}초보다 짧았습니다. 결론을 먼저 말한 뒤 근거가 된 경험을 한두 문장 덧붙여 보세요.`);
  }
  const longCount = report.answers.filter((answer) => answer.length === "long").length;
  if (longCount >= 1) {
    tips.push(`${longCount}개 답변이 ${Math.round(LONG_ANSWER_SECONDS / 60 * 10) / 10}분을 넘었습니다. 핵심을 먼저 말하고 1분 안팎으로 정리하는 연습을 해 보세요.`);
  }
  if (tips.length === 0) tips.push("눈에 띄는 말버릇이 적고 답변 길이도 적당합니다. 지금처럼 결론부터 말하는 습관을 유지하세요.");
  return tips;
}

/** 종합 평가 프롬프트에 붙일 짧은 요약 (토큰을 적게 쓰도록 숫자만) */
export function speechHabitSummary(report: SpeechHabitReport | null): string {
  if (!report) return "";
  const parts = [
    report.syllablesPerMinute != null ? `말 속도 분당 약 ${report.syllablesPerMinute}음절` : null,
    `간투사(음·어 등) ${report.fillerCount}회`,
    report.habitWords.length ? `습관어 ${report.habitWords.slice(0, 3).map((item) => `${item.word} ${item.count}회`).join(", ")}` : null,
    report.habitPhrases.length ? `습관 표현 ${report.habitPhrases.slice(0, 2).map((item) => `${item.word} ${item.count}회`).join(", ")}` : null,
  ].filter(Boolean);
  return `\n\n말버릇 자동 분석(참고용, 음성 인식 기준): ${parts.join(" · ")}`;
}
