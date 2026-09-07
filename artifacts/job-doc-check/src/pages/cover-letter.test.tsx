import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CoverLetterPage from "./cover-letter";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => ({
  getGetResumeQueryKey: vi.fn(),
  getListResumesQueryKey: vi.fn(),
  useListResumes: () => ({
    data: [{ id: 21, title: "백엔드 이력서" }],
    isLoading: false,
  }),
  useUpdateResume: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn() }),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/cover-letter", vi.fn()],
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

async function generateGuidedPrompts(usedFallback: boolean) {
  mocks.fetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      prompts: ["경험을 구체적으로 이야기해 주세요."],
      usedFallback,
    }),
  });

  render(<CoverLetterPage />);
  await userEvent.click(screen.getByTestId("tab-guided"));
  fireEvent.click(await screen.findByTestId("button-fetch-prompts"));
  await screen.findByText("경험을 구체적으로 이야기해 주세요.");
}

describe("CoverLetterPage 가이드 질문 복구 안내", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
  });

  it("기본 질문으로 복구된 응답에는 안내를 표시한다", async () => {
    await generateGuidedPrompts(true);

    expect(screen.getByTestId("guided-prompts-fallback-notice")).toHaveTextContent(
      "맞춤 질문을 만들지 못해 기본 질문으로 안내하고 있습니다.",
    );
  });

  it("정상 AI 응답에는 기존 질문 화면만 표시한다", async () => {
    await generateGuidedPrompts(false);

    expect(screen.queryByTestId("guided-prompts-fallback-notice")).not.toBeInTheDocument();
  });
});