import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  CareerAnalysisPanel,
  type CareerAnalysisResult,
  type CareerAnalysisState,
} from "./career-analysis-panel"

const baseResult: CareerAnalysisResult = {
  strengths: [],
  ncsCategories: [],
  recommendedJobs: [],
  summary: "분석 요약",
  papers: [],
}

function mockCareerAnalysis(result: CareerAnalysisResult) {
  const response: CareerAnalysisState = {
    inProgress: false,
    error: null,
    analyzedAt: "2026-09-06T00:00:00.000Z",
    result,
  }

  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => response,
  }))
}

async function openCareerAnalysisDetails(resumeId: number) {
  render(<CareerAnalysisPanel resumeId={resumeId} />)
  fireEvent.click(await screen.findByRole("button", { name: /세부 분석 보기/ }))
}

describe("CareerAnalysisPanel 논문 출처 확인 상태", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("verified 상태에서 Crossref와 OpenAlex 출처 및 원문 링크를 표시한다", async () => {
    mockCareerAnalysis({
      ...baseResult,
      papers: [{
        title: "검증된 논문",
        authors: ["김지원", "박연구"],
        applicantAuthorOrder: 1,
        venue: "한국정보학회",
        abstract: "",
        issues: [],
        verification: {
          status: "verified",
          records: [
            {
              source: "Crossref",
              title: "검증된 논문",
              authors: ["김지원", "박연구"],
              venue: "한국정보학회",
              doi: "10.1000/crossref",
              url: "https://doi.org/10.1000/crossref",
            },
            {
              source: "OpenAlex",
              title: "검증된 논문",
              authors: ["김지원", "박연구"],
              venue: "한국정보학회",
              doi: "",
              url: "https://openalex.org/W123",
            },
          ],
        },
      }],
    })

    await openCareerAnalysisDetails(7)

    expect(await screen.findByText("Crossref · OpenAlex 확인")).toBeInTheDocument()
    expect(screen.getByText("출처: Crossref")).toBeInTheDocument()
    expect(screen.getByText("출처: OpenAlex")).toBeInTheDocument()

    const links = screen.getAllByRole("link")
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute("href", "https://doi.org/10.1000/crossref")
    expect(links[0]).toHaveTextContent("DOI·원문 확인")
    expect(links[1]).toHaveAttribute("href", "https://openalex.org/W123")
    expect(links[1]).toHaveTextContent("원문 기록 확인")
  })

  it("unverified 상태를 외부 확인 필요로 표시한다", async () => {
    mockCareerAnalysis({
      ...baseResult,
      papers: [{
        title: "확인되지 않은 논문",
        authors: ["이지원"],
        applicantAuthorOrder: 1,
        venue: "미상 학회",
        abstract: "",
        issues: [],
        verification: { status: "unverified", records: [] },
      }],
    })

    await openCareerAnalysisDetails(8)

    const paperTitle = await screen.findByText("확인되지 않은 논문")
    const paperCard = paperTitle.closest(".rounded-lg")
    expect(paperCard).not.toBeNull()
    expect(within(paperCard as HTMLElement).getByText("외부 확인 필요")).toBeInTheDocument()
    expect(within(paperCard as HTMLElement).queryByRole("link")).not.toBeInTheDocument()
  })

  it("conflict 상태에서 출처 기록과 자동 확정하지 않은 차이를 표시한다", async () => {
    mockCareerAnalysis({
      ...baseResult,
      papers: [{
        title: "출처가 충돌한 논문",
        authors: ["최지원"],
        applicantAuthorOrder: 1,
        venue: "제출 학회",
        abstract: "",
        issues: [],
        verification: {
          status: "conflict",
          records: [
            {
              source: "Crossref",
              title: "Crossref 제목",
              authors: ["최지원"],
              venue: "Crossref 저널",
              doi: "10.1000/conflict",
              url: "https://doi.org/10.1000/conflict",
            },
            {
              source: "OpenAlex",
              title: "OpenAlex 제목",
              authors: ["최지원", "공동저자"],
              venue: "OpenAlex 저널",
              doi: "",
              url: "https://openalex.org/W999",
            },
          ],
          conflicts: [
            "제목이 출처별로 다릅니다.",
            "저자 목록이 출처별로 다릅니다.",
          ],
        },
      }],
    })

    await openCareerAnalysisDetails(9)

    expect(await screen.findByText("출처 정보 충돌")).toBeInTheDocument()
    expect(screen.getByText("출처: Crossref")).toBeInTheDocument()
    expect(screen.getByText("출처: OpenAlex")).toBeInTheDocument()
    expect(screen.getByText("자동 확정하지 않은 차이")).toBeInTheDocument()
    expect(screen.getByText("제목이 출처별로 다릅니다.")).toBeInTheDocument()
    expect(screen.getByText("저자 목록이 출처별로 다릅니다.")).toBeInTheDocument()
  })
})