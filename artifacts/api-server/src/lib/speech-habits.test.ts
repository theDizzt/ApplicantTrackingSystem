import { describe, expect, it } from "vitest";
import { analyzeSpeechHabits, countSyllables, paceLevel, speechHabitSummary } from "./speech-habits";

const answer = (questionId: number, text: string | null, seconds: number | null, question = "협업 경험을 말해 주세요") =>
  ({ questionId, question, answer: text, answerSeconds: seconds });

describe("analyzeSpeechHabits", () => {
  it("returns null when nothing was answered", () => {
    expect(analyzeSpeechHabits([answer(1, null, null)])).toBeNull();
  });

  it("counts fillers, habit words and hedging phrases", () => {
    const report = analyzeSpeechHabits([
      answer(1, "음 저는 이제 백엔드를 맡았는데요, 어 이제 API를 만든 것 같습니다. 음음 이제 일정도 조율한 것 같아요.", 20),
      answer(2, "어어 약간 어려웠던 부분은 약간 배포 부분이었습니다. 이제 다시 하면 잘할 것 같습니다.", 15),
    ])!;
    expect(report.fillerCount).toBe(4);
    expect(report.fillers).toEqual([{ word: "어", count: 2 }, { word: "음", count: 2 }]);
    expect(report.habitWords[0]).toEqual({ word: "이제", count: 4 });
    expect(report.habitWords).toContainEqual({ word: "약간", count: 2 });
    expect(report.habitPhrases).toContainEqual({ word: "~것 같습니다", count: 3 });
    expect(report.habitPhrases).toContainEqual({ word: "~부분", count: 2 });
    expect(report.totalSeconds).toBe(35);
    expect(report.tips.some((tip) => tip.includes("'이제'를 4번"))).toBe(true);
    expect(report.tips.some((tip) => tip.includes("'~것 같습니다'를 3번"))).toBe(true);
  });

  it("does not count legitimate words inside longer words", () => {
    const report = analyzeSpeechHabits([answer(1, "음악 동아리에서 어린이 교육 봉사를 했고 아침마다 이제야 깨달았습니다.", 12)])!;
    expect(report.fillerCount).toBe(0);
    expect(report.habitWords).toEqual([]);
  });

  it("reports repeated words that are not in the question, ignoring particles", () => {
    const report = analyzeSpeechHabits([
      answer(1, "열정을 가지고 열정적으로 했습니다. 열정이 제 강점이고 열정으로 협업 경험을 쌓았습니다.", 20),
    ])!;
    expect(report.repeatedWords[0]).toEqual({ word: "열정", count: 3 });
    expect(report.repeatedWords.find((item) => item.word === "협업")).toBeUndefined();
  });

  it("measures pace and flags short and long answers", () => {
    const text = "가".repeat(400);
    const report = analyzeSpeechHabits([answer(1, text, 60), answer(2, "네 했습니다", 5), answer(3, "짧게 답합니다", 8), answer(4, "길게 ".repeat(200), 200)])!;
    expect(report.answers[0].syllablesPerMinute).toBe(400);
    expect(report.answers.map((item) => item.length)).toEqual(["ok", "short", "short", "long"]);
    expect(report.tips.some((tip) => tip.includes("2개 답변이 15초보다 짧았습니다"))).toBe(true);
    expect(report.tips.some((tip) => tip.includes("2.5분을 넘었습니다"))).toBe(true);
  });

  it("leaves pace unknown when durations are missing and still gives a tip", () => {
    const report = analyzeSpeechHabits([answer(1, "프로젝트에서 데이터베이스 설계를 맡아 쿼리 속도를 절반으로 줄였습니다.", null)])!;
    expect(report.syllablesPerMinute).toBeNull();
    expect(report.paceLevel).toBe("unknown");
    expect(report.tips).toEqual(["눈에 띄는 말버릇이 적고 답변 길이도 적당합니다. 지금처럼 결론부터 말하는 습관을 유지하세요."]);
  });
});

describe("helpers", () => {
  it("counts Hangul syllables and latin words", () => {
    expect(countSyllables("API를 3번 호출")).toBe(2 * 2 + 4);
  });

  it("classifies pace", () => {
    expect(paceLevel(150)).toBe("slow");
    expect(paceLevel(280)).toBe("normal");
    expect(paceLevel(400)).toBe("fast");
    expect(paceLevel(null)).toBe("unknown");
  });

  it("summarizes briefly for the overall evaluation prompt", () => {
    const report = analyzeSpeechHabits([answer(1, "음 이제 이제 했습니다", 10)]);
    expect(speechHabitSummary(report)).toContain("간투사(음·어 등) 1회");
    expect(speechHabitSummary(null)).toBe("");
  });
});
