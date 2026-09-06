import { describe, expect, it } from "vitest";
import { resumeHtmlToText } from "./resume-text";

describe("resumeHtmlToText", () => {
  it("removes editor markup while preserving readable line breaks", () => {
    expect(resumeHtmlToText("<p>이력서</p><p><br/></p><p>## 인적사항</p><p>| 항목 | 내용 |</p>"))
      .toBe("이력서\n\n## 인적사항\n| 항목 | 내용 |");
  });

  it("removes executable markup and decodes common entities", () => {
    expect(resumeHtmlToText("<script>alert(1)</script><p>A&amp;B&nbsp;&lt;C&gt;</p>"))
      .toBe("A&B <C>");
  });
});