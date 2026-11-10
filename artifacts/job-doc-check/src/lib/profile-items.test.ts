import { describe, expect, it } from "vitest"
import { details, formatPeriod, profileItemsHtml } from "./profile-items"

describe("formatPeriod", () => {
  it("formats single dates and ranges", () => {
    expect(formatPeriod("2024-06")).toBe("2024.06")
    expect(formatPeriod("2023-03", "2023-12")).toBe("2023.03 ~ 2023.12")
    expect(formatPeriod(null, null)).toBe("")
  })
})

describe("details", () => {
  it("joins the filled fields after the title", () => {
    expect(details({ kind: "certificate", title: "정보처리기사", organization: "한국산업인력공단", score: " ", startDate: "2024-06" }))
      .toBe("한국산업인력공단 · 2024.06")
  })
})

describe("profileItemsHtml", () => {
  it("groups items by kind in a fixed order and escapes text", () => {
    const html = profileItemsHtml([
      { kind: "project", title: "사내 <대시보드>", startDate: "2023-03", endDate: "2023-12", description: "React 개발\n배포 자동화" },
      { kind: "certificate", title: "SQLD", organization: "한국데이터산업진흥원" },
    ])
    expect(html.indexOf("<h3>자격증</h3>")).toBeLessThan(html.indexOf("<h3>프로젝트</h3>"))
    expect(html).toContain("<strong>사내 &lt;대시보드&gt;</strong> · 2023.03 ~ 2023.12<br>React 개발<br>배포 자동화")
    expect(html).toContain("<li><p><strong>SQLD</strong> · 한국데이터산업진흥원</p></li>")
  })

  it("returns nothing for no items", () => {
    expect(profileItemsHtml([])).toBe("")
  })
})
