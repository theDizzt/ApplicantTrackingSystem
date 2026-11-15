import { describe, expect, it } from "vitest";
import { detectResumeLanguage, resolveResumeLanguage } from "./resume-language";

describe("detectResumeLanguage", () => {
  it("detects a Korean resume even with many English tech terms", () => {
    const text =
      "<p>## 경력사항</p><p>| 회사 | 기간 | 담당 업무 |</p>" +
      "<p>주식회사 예시에서 React, TypeScript, Node.js, AWS 기반 서비스를 개발하고 운영했습니다.</p>" +
      "<p>Docker와 Kubernetes로 배포 파이프라인을 구축했습니다.</p>";
    expect(detectResumeLanguage(text)).toBe("ko");
  });

  it("detects an English resume with a Korean name and address", () => {
    const text = [
      "홍길동 (Gildong Hong)",
      "서울특별시 강남구",
      "gildong@example.com | github.com/gildong",
      "SUMMARY",
      "Backend engineer with five years of experience building payment systems in Go and Java.",
      "EXPERIENCE",
      "Led the migration of a monolith to microservices, reducing deployment time by 60 percent.",
    ].join("\n");
    expect(detectResumeLanguage(text)).toBe("en");
  });

  it("detects a mixed resume", () => {
    // 영문 본문 + 짧은 한글 자기소개서 → 한글 어절 약 20%
    const resume =
      "Software engineer experienced in distributed systems and cloud infrastructure design. " +
      "Built and operated payment services handling millions of daily transactions with strict latency targets.";
    const coverLetter = "입사 후 결제 시스템 안정화에 기여하겠습니다.";
    expect(detectResumeLanguage(resume, coverLetter)).toBe("mixed");
  });

  it("ignores URLs and e-mail addresses", () => {
    const text = "포트폴리오 https://my-portfolio.example.com/projects/backend 참고 부탁드립니다 연락처 me@example.com 입니다";
    expect(detectResumeLanguage(text)).toBe("ko");
  });

  it("returns null when there is too little text", () => {
    expect(detectResumeLanguage("")).toBeNull();
    expect(detectResumeLanguage(null, undefined)).toBeNull();
    expect(detectResumeLanguage("Hello 안녕")).toBeNull();
  });
});

describe("resolveResumeLanguage", () => {
  it("prefers the stored language", () => {
    expect(resolveResumeLanguage({ language: "en", content: "한국어로만 작성된 이력서 본문입니다 정말로 그렇습니다" })).toBe("en");
  });

  it("falls back to detection for legacy rows", () => {
    expect(resolveResumeLanguage({ language: null, content: "한국어로만 작성된 이력서 본문입니다 정말로 그렇습니다" })).toBe("ko");
  });
});
