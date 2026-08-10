/**
 * AI 설정 탭(AISettingsTab) 통합 테스트 — 잘못된 모델명 저장 차단 흐름
 *
 * 서버(PUT /admin/settings/ai)의 실제 검증 로직을 그대로 모사한 가짜 백엔드로
 * 관리자 화면의 UI 흐름을 끝까지 검증한다:
 *  1) 오타 모델 저장 → 409 → 확인 다이얼로그 → "그래도 저장" → force:true 재요청 → 저장·반영
 *  2) 로컬에 이미 설치된 모델 → 다이얼로그 없이 저장
 *  3) 레지스트리 조회 불가(unknown) → 저장이 막히지 않음
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AISettingsTab } from "./index"

// ── 가짜 백엔드 (서버 검증 로직 모사) ────────────────────────────────────
const OLLAMA_BASE = "http://localhost:11434/v1"
// 레지스트리 상태: 존재하지 않는 모델 / 조회 불가 모델
const NOT_FOUND_MODELS = new Set(["qwen-typo-xyz"])
const UNKNOWN_MODELS = new Set(["myregistry.example.com/ns/custommodel"])
// 로컬 Ollama에 설치된 모델 (레지스트리에는 없음 — 직접 빌드한 모델)
const INSTALLED_MODELS = new Set(["mycustombuild:latest"])

let state: { baseUrl: string; model: string }
let putRequests: Array<{ baseUrl?: string; model?: string; force?: boolean }>

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function registryStatus(model: string): "found" | "not_found" | "unknown" {
  if (NOT_FOUND_MODELS.has(model)) return "not_found"
  if (UNKNOWN_MODELS.has(model)) return "unknown"
  return "found"
}

const normalize = (name: string) => (name.includes(":") ? name : `${name}:latest`)

function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input)
  const method = (init?.method ?? "GET").toUpperCase()
  const path = url.replace(/^.*\/api/, "")

  if (path === "/admin/settings/ai" && method === "GET") {
    return Promise.resolve(json({ apiKeyMasked: "sk-abc…wxyz", hasApiKey: true, baseUrl: state.baseUrl, model: state.model }))
  }
  if (path === "/admin/settings/ai" && method === "PUT") {
    const body = JSON.parse(String(init?.body ?? "{}")) as { baseUrl?: string; model?: string; force?: boolean }
    putRequests.push(body)
    // 서버 로직 모사: 로컬 Ollama + 미설치 + 레지스트리 not_found + force 아님 → 409
    if (
      body.model && body.model.trim() !== "" && body.force !== true &&
      (body.baseUrl ?? state.baseUrl).startsWith("http://localhost:11434") &&
      !INSTALLED_MODELS.has(normalize(body.model.trim())) &&
      registryStatus(body.model.trim()) === "not_found"
    ) {
      return Promise.resolve(json({
        code: "model_not_found",
        error: `모델 "${body.model.trim()}"이(가) Ollama 레지스트리에 존재하지 않습니다. 모델명에 오타가 없는지 확인하세요.`,
      }, 409))
    }
    if (body.baseUrl !== undefined) state.baseUrl = body.baseUrl.trim()
    if (body.model !== undefined) state.model = body.model.trim()
    return Promise.resolve(json({ ok: true }))
  }
  if (path === "/admin/settings/ai/health") {
    return Promise.resolve(json({ ok: true, code: "ok" }))
  }
  if (path.startsWith("/admin/settings/ai/model-size")) {
    const m = new URL(url, "http://x").searchParams.get("model") ?? ""
    return Promise.resolve(json({ model: m, sizeBytes: null, requiredBytes: null, registryStatus: registryStatus(m) }))
  }
  if (path === "/admin/settings/ai/disk-usage") {
    return Promise.resolve(json({ path: "/home", totalBytes: 100e9, freeBytes: 50e9, usedBytes: 50e9, usedPercent: 50 }))
  }
  return Promise.resolve(json({ error: `unhandled: ${method} ${path}` }, 404))
}

beforeEach(() => {
  state = { baseUrl: OLLAMA_BASE, model: "qwen2.5:14b" }
  putRequests = []
  vi.stubGlobal("fetch", vi.fn(fakeFetch))
})

async function renderTab() {
  const user = userEvent.setup()
  render(<AISettingsTab />)
  // 초기 로드 완료 대기 (Base URL 입력창 등장)
  const baseUrlInput = await screen.findByPlaceholderText(/api\.openai\.com/)
  const modelInput = screen.getByPlaceholderText(/gpt-5\.6-luna/)
  const saveButton = screen.getByRole("button", { name: "저장" })
  return { user, baseUrlInput, modelInput, saveButton }
}

describe("AISettingsTab — 잘못된 모델명 저장 차단", () => {
  it("오타 모델 저장 시 확인 다이얼로그가 뜨고, '그래도 저장'으로 force 저장된다", async () => {
    const { user, modelInput, saveButton } = await renderTab()

    await user.clear(modelInput)
    await user.type(modelInput, "qwen-typo-xyz")
    await user.click(saveButton)

    // 409 → 확인 다이얼로그 표시
    const dialog = await screen.findByRole("dialog")
    expect(dialog).toHaveTextContent("레지스트리에 없는 모델")
    expect(dialog).toHaveTextContent('모델 "qwen-typo-xyz"이(가) Ollama 레지스트리에 존재하지 않습니다')
    expect(dialog).toHaveTextContent("그래도 저장하시겠습니까?")
    // 이 시점에는 저장되지 않음
    expect(state.model).toBe("qwen2.5:14b")
    expect(putRequests[0]?.force).toBeUndefined()

    // "그래도 저장" 클릭 → force:true 재요청 → 저장 성공, 다이얼로그 닫힘
    await user.click(screen.getByRole("button", { name: "그래도 저장" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(putRequests).toHaveLength(2)
    expect(putRequests[1]).toMatchObject({ model: "qwen-typo-xyz", force: true })
    expect(state.model).toBe("qwen-typo-xyz")

    // 저장 후 재조회로 화면에 저장된 값이 반영됨
    await waitFor(() => expect(modelInput).toHaveValue("qwen-typo-xyz"))
  })

  it("다이얼로그에서 '취소'를 누르면 저장되지 않는다", async () => {
    const { user, modelInput, saveButton } = await renderTab()

    await user.clear(modelInput)
    await user.type(modelInput, "qwen-typo-xyz")
    await user.click(saveButton)
    await screen.findByRole("dialog")

    await user.click(screen.getByRole("button", { name: "취소" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(putRequests).toHaveLength(1)
    expect(state.model).toBe("qwen2.5:14b")
  })

  it("이미 설치된 로컬 모델은 다이얼로그 없이 바로 저장된다", async () => {
    const { user, modelInput, saveButton } = await renderTab()

    await user.clear(modelInput)
    await user.type(modelInput, "mycustombuild")
    await user.click(saveButton)

    await waitFor(() => expect(state.model).toBe("mycustombuild"))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(putRequests).toHaveLength(1)
    expect(putRequests[0]?.force).toBeUndefined()
  })

  it("레지스트리 조회 불가(unknown) 모델은 저장이 막히지 않는다", async () => {
    const { user, modelInput, saveButton } = await renderTab()

    await user.clear(modelInput)
    await user.type(modelInput, "myregistry.example.com/ns/custommodel")
    await user.click(saveButton)

    await waitFor(() => expect(state.model).toBe("myregistry.example.com/ns/custommodel"))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(putRequests).toHaveLength(1)
  })
})
