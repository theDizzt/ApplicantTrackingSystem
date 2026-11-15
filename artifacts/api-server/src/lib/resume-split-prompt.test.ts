import { describe, expect, it } from "vitest";
import { buildResumeSplitPrompt } from "./resume-split-prompt";

describe("buildResumeSplitPrompt", () => {
  it("uses only Korean section rules for Korean resumes", () => {
    const prompt = buildResumeSplitPrompt("ko");
    expect(prompt).toContain("성장과정");
    expect(prompt).not.toContain("Cover Letter");
    expect(prompt).toContain("한국어 이력서로 판정");
  });

  it("uses English section rules and keeps Summary in the resume body", () => {
    const prompt = buildResumeSplitPrompt("en");
    expect(prompt).toContain("Cover Letter");
    expect(prompt).toContain("Personal Statement");
    expect(prompt).toContain("Summary·Profile·Objective는 짧은 요약");
    expect(prompt).not.toContain("성장과정");
  });

  it("includes both rule sets for mixed or undetected resumes", () => {
    for (const language of ["mixed", null] as const) {
      const prompt = buildResumeSplitPrompt(language);
      expect(prompt).toContain("성장과정");
      expect(prompt).toContain("Cover Letter");
    }
    expect(buildResumeSplitPrompt(null)).not.toContain("판정되었습니다");
  });

  it("always forbids translation and requires JSON only", () => {
    for (const language of ["ko", "en", "mixed", null] as const) {
      const prompt = buildResumeSplitPrompt(language);
      expect(prompt).toContain("절대 번역하지 말고");
      expect(prompt).toContain("오직 JSON만 반환하세요");
    }
  });
});
