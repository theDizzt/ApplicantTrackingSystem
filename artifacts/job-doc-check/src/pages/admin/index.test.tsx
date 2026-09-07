import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { AISettingsTab } from "./index"

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: vi.fn() },
}))

const aiSettings = {
  apiKeyMasked: "",
  hasApiKey: false,
  baseUrl: "",
  model: "",
  sttModel: "gpt-4o-mini-transcribe",
}

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500) {
  return {
    ok,
    status,
    json: async () => body,
  }
}

function mockRequests(alertResponse: unknown, alertOk = true) {
  mocks.fetch.mockImplementation(async (input: string | URL | Request) => {
    const url = String(input)
    if (url.endsWith("/admin/settings/alerts/delivery-status")) {
      return jsonResponse(alertResponse, alertOk)
    }
    if (url.endsWith("/admin/settings/ai/health")) {
      return jsonResponse({ ok: true, code: "ok" })
    }
    if (url.endsWith("/admin/settings/ai")) {
      return jsonResponse(aiSettings)
    }
    throw new Error(`Unexpected request: ${url}`)
  })
}

describe("AISettingsTab 알림 채널 상태", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", mocks.fetch)
  })

  it("미설정 상태를 전달 정보 없이 명확히 표시한다", async () => {
    mockRequests({
      configured: false,
      windowMs: 3_600_000,
      total: 0,
      succeeded: 0,
      failureRate: 0,
      successRate: null,
      consecutiveFailures: 0,
    })

    render(<AISettingsTab />)

    expect(await screen.findByTestId("status-alert-unconfigured")).toHaveTextContent("웹훅 미설정")
    expect(screen.queryByTestId("text-alert-last-delivery")).not.toBeInTheDocument()
    expect(screen.queryByTestId("text-alert-success-rate")).not.toBeInTheDocument()
  })

  it("설정됐지만 이력이 없는 상태를 실패와 구분한다", async () => {
    mockRequests({
      configured: true,
      windowMs: 3_600_000,
      total: 0,
      succeeded: 0,
      failureRate: 0,
      successRate: null,
      consecutiveFailures: 0,
    })

    render(<AISettingsTab />)

    const emptyState = await screen.findByTestId("status-alert-no-history")
    expect(emptyState).toHaveTextContent("전달 이력 없음")
    expect(emptyState).toHaveTextContent("채널은 설정되어 있으며")
    expect(screen.queryByText("실패", { exact: true })).not.toBeInTheDocument()
  })

  it("성공률, 최근 전달 시각, 연속 실패를 API 응답대로 표시한다", async () => {
    const lastDeliveryAt = "2026-09-07T03:04:00.000Z"
    mockRequests({
      configured: true,
      windowMs: 3_600_000,
      total: 8,
      succeeded: 6,
      failureRate: 0.25,
      successRate: 0.75,
      consecutiveFailures: 2,
      lastOutcome: "retries_exhausted",
      lastDeliveryAt,
    })

    render(<AISettingsTab />)

    expect(await screen.findByTestId("text-alert-success-rate")).toHaveTextContent("75%")
    expect(screen.getByText("6/8건")).toBeInTheDocument()
    expect(screen.getByTestId("text-alert-consecutive-failures")).toHaveTextContent("2건")
    expect(screen.getByText("실패율 25%")).toBeInTheDocument()
    expect(screen.getByTestId("text-alert-last-delivery")).toHaveTextContent(
      new Date(lastDeliveryAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }),
    )
    expect(screen.getByText("실패", { exact: true })).toBeInTheDocument()
  })

  it("상태 조회 실패 시 안전한 오류 문구를 표시한다", async () => {
    mockRequests({ error: "internal details must not be shown" }, false)

    render(<AISettingsTab />)

    expect(await screen.findByTestId("status-alert-error")).toHaveTextContent(
      "알림 채널 상태를 불러오지 못했습니다.",
    )
    expect(screen.queryByText("internal details must not be shown")).not.toBeInTheDocument()
  })
})