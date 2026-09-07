import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CoverLetterPage from "./cover-letter";

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  generateCoverLetter: vi.fn(),
  generateGuidedPrompts: vi.fn(),
  updateResume: vi.fn(),
  analyticsTrack: vi.fn(),
  setLocation: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => ({
  getGetResumeQueryKey: vi.fn(),
  getListResumesQueryKey: vi.fn(),
  useListResumes: () => ({
    data: [{ id: 21, title: "백엔드 이력서" }],
    isLoading: false,
  }),
  useGenerateCoverLetter: () => ({
    mutateAsync: mocks.generateCoverLetter,
    isPending: false,
  }),
  useGenerateGuidedPrompts: () => ({
    mutateAsync: mocks.generateGuidedPrompts,
    isPending: false,
  }),
  useUpdateResume: () => ({
    mutate: mocks.updateResume,
    isPending: false,
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn() }),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/cover-letter", mocks.setLocation],
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

async function generateGuidedPrompts(usedFallback: boolean) {
  mocks.generateGuidedPrompts.mockResolvedValue({
    prompts: ["경험을 구체적으로 이야기해 주세요."],
    usedFallback,
  });

  render(<CoverLetterPage />);
  await userEvent.click(screen.getByTestId("tab-guided"));
  fireEvent.click(await screen.findByTestId("button-fetch-prompts"));
  await screen.findByText("경험을 구체적으로 이야기해 주세요.");
}

describe("CoverLetterPage 가이드 질문 복구 안내", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:test-audio"),
      revokeObjectURL: vi.fn(),
    });
    window.umami = { track: mocks.analyticsTrack };
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


describe("CoverLetterPage 분석 이벤트", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:test-audio"),
      revokeObjectURL: vi.fn(),
    });
    window.umami = { track: mocks.analyticsTrack };
  });

  async function selectAudioFile() {
    render(<CoverLetterPage />);
    await userEvent.click(screen.getByTestId("tab-upload"));
    const audio = new File(["voice"], "private-name.webm", { type: "audio/webm" });
    await userEvent.upload(await screen.findByTestId("input-file"), audio);
    expect(mocks.analyticsTrack).toHaveBeenCalledWith("voice_file_selected", undefined);
  }

  it("생성 성공 이벤트에는 입력 방식만 담고 음성·문서 내용은 담지 않는다", async () => {
    mocks.generateCoverLetter.mockResolvedValue({
      transcript: "비공개 음성 인식 원문",
      coverLetter: "비공개 자기소개서 본문",
    });
    await selectAudioFile();

    await userEvent.click(screen.getByTestId("button-generate"));
    await screen.findByText("비공개 자기소개서 본문");

    expect(mocks.analyticsTrack).toHaveBeenCalledWith("cover_letter_generated", {
      source: "file",
    });
    expect(mocks.analyticsTrack).not.toHaveBeenCalledWith(
      "cover_letter_generated",
      expect.objectContaining({
        transcript: expect.anything(),
        coverLetter: expect.anything(),
        fileName: expect.anything(),
      }),
    );
  });

  it("생성 실패 이벤트에도 입력 방식만 담고 사용자는 오류 안내를 계속 받는다", async () => {
    mocks.generateCoverLetter.mockRejectedValue(new Error("생성 서비스를 사용할 수 없습니다."));
    await selectAudioFile();

    await userEvent.click(screen.getByTestId("button-generate"));

    expect(await screen.findByTestId("error-message")).toHaveTextContent(
      "생성 서비스를 사용할 수 없습니다.",
    );
    expect(mocks.analyticsTrack).toHaveBeenCalledWith("cover_letter_generation_failed", {
      source: "file",
    });
  });

  it("이력서 반영 성공 이벤트는 식별 payload 없이 전송한다", async () => {
    mocks.generateCoverLetter.mockResolvedValue({
      transcript: "인식 원문",
      coverLetter: "완성된 자기소개서",
    });
    mocks.updateResume.mockImplementation((_input, options) => {
      options.onSuccess({ id: 21, title: "백엔드 이력서" });
    });
    await selectAudioFile();
    await userEvent.click(screen.getByTestId("button-generate"));
    await screen.findByTestId("text-cover-letter");

    await userEvent.click(screen.getByTestId("button-apply-to-resume"));

    expect(mocks.analyticsTrack).toHaveBeenCalledWith(
      "cover_letter_applied_to_resume",
      undefined,
    );
    expect(mocks.setLocation).toHaveBeenCalledWith("/resumes/21");
  });

  it("분석 추적기가 실패해도 파일 선택과 자기소개서 생성은 완료된다", async () => {
    mocks.analyticsTrack.mockImplementation(() => {
      throw new Error("analytics unavailable");
    });
    mocks.generateCoverLetter.mockResolvedValue({
      transcript: "분석 실패와 무관한 인식 원문",
      coverLetter: "분석 실패와 무관한 완성 결과",
    });

    await selectAudioFile();
    expect(screen.getByTestId("button-generate")).toBeEnabled();

    await userEvent.click(screen.getByTestId("button-generate"));

    expect(await screen.findByTestId("text-cover-letter")).toHaveTextContent(
      "분석 실패와 무관한 완성 결과",
    );
    expect(screen.queryByTestId("error-message")).not.toBeInTheDocument();
    expect(mocks.analyticsTrack).toHaveBeenCalledWith("cover_letter_generated", {
      source: "file",
    });
  });
});