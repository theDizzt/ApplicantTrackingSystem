import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { GrowthPlanCard, type GrowthPlan } from "./growth-plan-card"

const plan: GrowthPlan = {
  stage: "senior",
  weeklyHours: 6,
  createdAt: "2026-11-24T00:00:00.000Z",
  items: [
    {
      title: "RPA 자동화 성과 정리",
      quote: "RPA 자동화로 정산 업무 처리",
      quoteVerified: true,
      whyHelpful: "공고의 자동화 요건과 연결됩니다.",
      totalWeeks: 4,
      hoursPerWeek: 4,
      weeklyTasks: [1, 2, 3, 4].map((week) => ({ week, task: `${week}주차 할 일`, deliverable: `${week}주차 결과물` })),
      completionCriteria: "전후 차이를 설명할 수 있으면 완료",
    },
    {
      title: "API 연계 역량 보완",
      quote: "",
      quoteVerified: false,
      whyHelpful: "운영 연계 요건과 연결됩니다.",
      totalWeeks: 6,
      hoursPerWeek: 2,
      weeklyTasks: [1, 2, 3, 4, 5, 6].map((week) => ({ week, task: `API ${week}주차`, deliverable: "" })),
      completionCriteria: "API 호출 흐름을 그림으로 설명",
    },
  ],
}

function renderCard(p?: GrowthPlan) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <GrowthPlanCard analysisId={7} plan={p} />
    </QueryClientProvider>,
  )
}

describe("GrowthPlanCard", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("asks for the learner stage before creating a plan and sends the chosen settings", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ growthPlan: plan }) })
    vi.stubGlobal("fetch", fetchMock)
    renderCard()

    const create = screen.getByRole("button", { name: /계획 만들기/ })
    expect(create).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: /졸업 후 구직 중/ }))
    fireEvent.click(screen.getByRole("button", { name: "주 10시간" }))
    expect(create).toBeEnabled()
    fireEvent.click(create)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/analyses/7/growth-plan")
    expect(JSON.parse(init.body)).toEqual({ stage: "graduate", weeklyHours: 10 })
  })

  it("summarizes an existing plan and shows weekly tasks in the details", async () => {
    renderCard(plan)
    expect(screen.getByText("바로 시작할 수 있는 단기 계획 2개 · 4~6주")).toBeInTheDocument()
    expect(screen.getByText("RPA 자동화 성과 정리 · 4주")).toBeInTheDocument()
    expect(screen.getByText("4학년·졸업 예정 · 주 6시간 기준")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /세부 분석 보기/ }))
    expect(await screen.findByText("1주차 할 일")).toBeInTheDocument()
    expect(screen.getByText("API 6주차")).toBeInTheDocument()
    expect(screen.getAllByText("이력서 원문")).toHaveLength(1)
    expect(screen.getByText("총 6주")).toBeInTheDocument()
  })

  it("lets the user regenerate with the previous settings preselected", () => {
    renderCard(plan)
    fireEvent.click(screen.getByRole("button", { name: /조건 바꿔 다시 만들기/ }))
    expect(screen.getByRole("button", { name: /4학년·졸업 예정/ })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "주 6시간" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: /계획 만들기/ })).toBeEnabled()
  })
})
