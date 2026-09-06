import { afterEach, describe, expect, it, vi } from "vitest";
import { recordsConflict, sanitizeCareer, verifyPaper } from "./career-analysis";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sanitizeCareer", () => {
  it("does not invent an NCS level and normalizes each job salary range", () => {
    const result = sanitizeCareer({
      strengths: [],
      ncsCategories: [
        { major: "20. 정보통신", middle: "정보기술", fitReason: "적합" },
        { major: "01. 사업관리", middle: "프로젝트관리", level: 9, fitReason: "적합" },
        { major: "02. 경영", middle: "사무", level: 5, fitReason: "적합" },
      ],
      recommendedJobs: [{
        job: "데이터 과학자",
        ncsCategory: "정보기술",
        fitScore: 90,
        reason: "적합",
        outlook: "밝음",
        outlookScore: 80,
        salaryGuide: { min: 7000, max: 4500, basis: "시장 기준" },
      }],
      papers: [{
        title: "논문",
        authors: ["가", "나"],
        applicantAuthorOrder: 1,
        venue: "학회",
        abstract: "초록",
        issues: [],
      }],
    });

    expect(result.ncsCategories.map((item) => item.level)).toEqual([0, 0, 5]);
    expect(result.recommendedJobs[0].salaryGuide).toEqual({ min: 4500, max: 7000, basis: "시장 기준" });
    expect(result.papers[0]).toEqual(expect.objectContaining({
      title: "논문",
      authors: ["가", "나"],
      verification: expect.objectContaining({ status: "unverified" }),
    }));
  });
});

describe("paper verification", () => {
  it("checks OpenAlex after Crossref has no matching title", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: { items: [] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [{
          id: "https://openalex.org/W1",
          display_name: "국내 학회 논문",
          doi: null,
          authorships: [
            { author: { display_name: "홍길동" } },
            { author: { display_name: "김연구" } },
          ],
          primary_location: {
            landing_page_url: "https://example.kr/paper/1",
            source: { display_name: "한국정보학회", country_code: "KR" },
          },
          locations: [],
        }],
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifyPaper({
      title: "국내 학회 논문",
      authors: ["홍길동", "김연구"],
      applicantAuthorOrder: 1,
      venue: "한국정보학회",
      abstract: "",
      issues: [],
      verification: { status: "unverified", records: [], conflicts: [] },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.verification).toEqual(expect.objectContaining({
      status: "verified",
      records: [expect.objectContaining({
        source: "OpenAlex",
        url: "https://example.kr/paper/1",
      })],
    }));
    expect(result.issues).toContain("Crossref 미발견 후 OpenAlex 국내 학술 메타데이터에서 확인했습니다.");
  });

  it("checks KCI official records only after Crossref and OpenAlex have no match", async () => {
    const kciHtml = `
      <table><tr>
        <td>
          <a class="subject" href="/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART001">국내 학회 논문</a>
          <input type="hidden" name="b" value="저자 : 홍길동 | 김연구" />
          <input type="hidden" name="c" value="학회명 : 한국정보학회" />
          <input type="hidden" name="d" value="학술지명 : 정보학연구" />
        </td>
      </tr></table>`;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: { items: [] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(kciHtml, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifyPaper({
      title: "국내 학회 논문",
      authors: ["홍길동", "김연구"],
      applicantAuthorOrder: 1,
      venue: "정보학연구",
      abstract: "",
      issues: [],
      verification: { status: "unverified", records: [], conflicts: [] },
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2]?.[0]).toBe("https://www.kci.go.kr/kciportal/po/search/poArtiSearList.kci");
    expect(result.verification).toEqual(expect.objectContaining({
      status: "verified",
      records: [expect.objectContaining({
        source: "KCI",
        title: "국내 학회 논문",
        authors: ["홍길동", "김연구"],
        venue: "정보학연구",
        url: "https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART001",
      })],
    }));
    expect(result.issues).toContain("Crossref와 OpenAlex 미발견 후 KCI 공식 공개 기록에서 확인했습니다.");
  });

  it("reports source differences instead of auto-confirming them", () => {
    const conflicts = recordsConflict(
      {
        source: "Crossref",
        title: "같은 논문",
        authors: ["홍길동", "김연구"],
        venue: "한국정보학회",
        doi: "10.1000/example",
        url: "https://doi.org/10.1000/example",
      },
      {
        source: "OpenAlex",
        title: "같은 논문",
        authors: ["김연구", "홍길동"],
        venue: "다른 학회",
        doi: "10.1000/example",
        url: "https://example.kr/paper/1",
      },
    );

    expect(conflicts).toEqual([
      "출처별 저자명 또는 저자순이 다릅니다.",
      "출처별 학회·저널 정보가 다릅니다.",
    ]);
  });
});