import { describe, expect, it } from "vitest";
import { buildSpellcheckPrompt, detectSpellcheckLanguages } from "./spellcheck-prompt";

const EN_TEXT =
  "Backend engineer with five years of experience. Led the migration of a monolith to microservices and reduced deployment time.";
const KO_TEXT = "저는 문제를 끝까지 해결하는 개발자입니다. 입사 후 결제 시스템 안정화에 기여하겠습니다.";

describe("detectSpellcheckLanguages", () => {
  it("detects each field separately", () => {
    expect(detectSpellcheckLanguages(EN_TEXT, KO_TEXT)).toEqual({ content: "en", coverLetter: "ko" });
  });

  it("returns null for empty fields", () => {
    expect(detectSpellcheckLanguages(EN_TEXT, "")).toEqual({ content: "en", coverLetter: null });
  });

  it("falls back to the overall language when a field is too short", () => {
    expect(detectSpellcheckLanguages(EN_TEXT, "Thank you")).toEqual({ content: "en", coverLetter: "en" });
  });
});

describe("buildSpellcheckPrompt", () => {
  it("uses only Korean rules for a Korean resume", () => {
    const prompt = buildSpellcheckPrompt({ content: "ko", coverLetter: "ko" });
    expect(prompt).toContain("한국어 교정 전문가");
    expect(prompt).toContain("국립국어원");
    expect(prompt).not.toContain("[영어 교정 기준]");
  });

  it("uses English rules for an English resume", () => {
    const prompt = buildSpellcheckPrompt({ content: "en", coverLetter: null });
    expect(prompt).toContain("영문 이력서 교정 전문가");
    expect(prompt).toContain("Led the migration");
    expect(prompt).toContain("이력서 내용(content): 영어");
    expect(prompt).not.toContain("[한국어 교정 기준]");
  });

  it("tells the model each field's language when they differ", () => {
    const prompt = buildSpellcheckPrompt({ content: "en", coverLetter: "ko" });
    expect(prompt).toContain("[한국어 교정 기준]");
    expect(prompt).toContain("[영어 교정 기준]");
    expect(prompt).toContain("자기소개서(coverLetter): 한국어");
  });

  it("includes both rule sets when nothing could be detected", () => {
    const prompt = buildSpellcheckPrompt({ content: null, coverLetter: null });
    expect(prompt).toContain("[한국어 교정 기준]");
    expect(prompt).toContain("[영어 교정 기준]");
    expect(prompt).not.toContain("판정된 작성 언어");
  });

  it("always forbids translation and asks for Korean reasons", () => {
    const prompt = buildSpellcheckPrompt({ content: "en", coverLetter: "en" });
    expect(prompt).toContain("절대 번역하지 말고");
    expect(prompt).toContain("항상 한국어로");
  });
});
