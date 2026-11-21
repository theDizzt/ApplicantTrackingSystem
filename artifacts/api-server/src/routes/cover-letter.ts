import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import OpenAI from "openai";
import { db, resumesTable } from "@workspace/db";
import {
  GenerateCoverLetterResponse,
  GenerateGuidedPromptsBody,
  GenerateGuidedPromptsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import {
  recordGuidedPromptGeneration,
  type GuidedPromptFailureType,
} from "../lib/guided-prompt-monitor";
import { getAI } from "../lib/openai";
import { handleAudioUpload, limitConcurrentAudioJobs, transcribeUpload } from "../lib/audio-transcription";
import { resumeHtmlToText } from "../lib/resume-text";

const router: IRouter = Router();

function cleanGeneratedText(value: string): string {
  return value
    .replace(/^```(?:markdown)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

const FALLBACK_GUIDED_PROMPTS = [
  "지금까지 어떤 환경에서 살아왔고, 그 과정에서 형성된 가치관은 무엇인지 이야기해 주세요.",
  "학교생활에서 가장 기억에 남는 경험과 그 경험을 통해 배운 점을 이야기해 주세요.",
  "지금까지 겪은 가장 어려운 일은 무엇이었으며, 어떻게 해결했는지 구체적으로 이야기해 주세요.",
  "본인의 강점이 잘 드러났던 경험과 그 강점을 지원 업무에서 어떻게 활용할지 이야기해 주세요.",
  "지원한 회사와 직무를 선택한 이유, 그리고 입사를 위해 준비해 온 내용을 이야기해 주세요.",
  "입사 후 어떤 방식으로 일하고 성장하며 회사에 기여하고 싶은지 이야기해 주세요.",
];

function parseGuidedPrompts(content: string): string[] {
  try {
    const parsed = JSON.parse(content) as { prompts?: unknown[] };
    const prompts = Array.isArray(parsed.prompts) ? parsed.prompts : [];
    return [...new Set(prompts
      .map(item => typeof item === "string"
        ? item
        : typeof (item as { question?: unknown })?.question === "string"
          ? (item as { question: string }).question
          : "")
      .map(question => question.trim())
      .filter(question => question.length >= 10))]
      .slice(0, 8);
  } catch {
    return [];
  }
}
function classifyGuidedPromptError(error: unknown): GuidedPromptFailureType {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401 || error.status === 403) return "authentication";
    if (error.status === 429) return "rate_limit";
    if (error.status >= 500) return "upstream";
  }
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ETIMEDOUT" || code === "ECONNABORTED" || error.name === "AbortError") return "timeout";
  }
  return "unknown";
}

router.post("/cover-letter/guided-prompts", requireAuth, async (req, res): Promise<void> => {
  const input = GenerateGuidedPromptsBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "질문을 만들 이력서를 선택해주세요." });
    return;
  }
  const { resumeId } = input.data;

  const [resume] = await db.select().from(resumesTable).where(and(
    eq(resumesTable.id, resumeId),
    eq(resumesTable.userId, req.session.userId!),
  ));
  if (!resume) {
    res.status(404).json({ error: "이력서를 찾을 수 없습니다." });
    return;
  }

  const coverLetterText = resumeHtmlToText(resume.coverLetter);
  const resumeText = resumeHtmlToText(resume.content);
  if (!coverLetterText && !resumeText) {
    res.status(422).json({ error: "선택한 이력서에 분석할 내용이 없습니다. 이력서 내용을 먼저 작성해주세요." });
    return;
  }

  let metricModel = "unknown";
  try {
      const ai = await getAI("light");
    metricModel = ai.model;
    const response = await ai.openai.chat.completions.create({
      model: ai.model,
      messages: [
        {
          role: "system",
          content: `당신은 한국 취업 준비생이 자기소개서에 쓸 경험을 편안하게 말하도록 돕는 전문 커리어 코치입니다.
제공된 이력서와 기존 자기소개서를 분석해 음성 녹음용 질문을 6~8개 만드세요.
기존 자기소개서 내용에 연결되는 후속 질문을 최우선으로 하고, 그 다음 이력서의 학력·경력·프로젝트·성과·지원 방향을 활용하세요.
성장 과정, 학교생활, 어려움을 해결한 경험, 강점과 역량, 지원 동기, 입사 후 일하는 방식과 포부가 고르게 드러나야 합니다.
이력서에 구체적인 사실이 있으면 그 사실을 직접 언급해 더 자세한 상황·행동·결과를 말하도록 질문하세요.
정보가 없는 주제는 사실을 지어내거나 단정하지 말고, 사용자가 자유롭게 경험을 꺼낼 수 있는 질문으로 작성하세요.
한 질문에는 한 가지 주제만 담고, 사용자가 그대로 듣고 답하기 쉬운 존댓말을 사용하세요.
반드시 JSON 형식으로만 반환하세요: { "prompts": ["질문 1", "질문 2"] }`,
        },
        {
          role: "user",
          content: `이력서 제목: ${resume.title}

기존 자기소개서(가장 우선해서 질문에 반영):
${coverLetterText || "(작성된 자기소개서 없음)"}

이력서 내용:
${resumeText || "(작성된 이력서 본문 없음)"}`,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 3000,
    });

    const generated = parseGuidedPrompts(response.choices[0]?.message?.content ?? "{}");
    const prompts = [...generated];
    let usedFallback = false;
    for (const fallback of FALLBACK_GUIDED_PROMPTS) {
      if (prompts.length >= 6) break;
      if (!prompts.includes(fallback)) {
        prompts.push(fallback);
        usedFallback = true;
      }
    }
    await recordGuidedPromptGeneration({
      outcome: usedFallback ? "fallback" : "generated",
      failureType: usedFallback ? "invalid_response" : undefined,
    }, req.log).catch(alertError => {
      req.log.error({ err: alertError }, "Failed to persist guided prompt generation alert");
    });
    req.log.info({
      metric: "guided_prompt_generation",
      outcome: usedFallback ? "fallback" : "generated",
      model: metricModel,
      failureType: usedFallback ? "invalid_response" : undefined,
    }, "Guided prompt generation metric");
    res.json(GenerateGuidedPromptsResponse.parse({ prompts: prompts.slice(0, 8), usedFallback }));
  } catch (error) {
    req.log.error({ err: error, resumeId }, "Failed to generate guided recording prompts");
    req.log.warn({
      metric: "guided_prompt_generation",
      outcome: "fallback",
      model: metricModel,
      failureType: classifyGuidedPromptError(error),
    }, "Guided prompt generation metric");
    await recordGuidedPromptGeneration({
      outcome: "fallback",
      failureType: classifyGuidedPromptError(error),
    }, req.log).catch(alertError => {
      req.log.error({ err: alertError }, "Failed to persist guided prompt generation alert");
    });
    res.json(GenerateGuidedPromptsResponse.parse({
      prompts: FALLBACK_GUIDED_PROMPTS,
      usedFallback: true,
    }));
  }
});

router.post(
  "/cover-letter/generate",
  requireAuth,
  limitConcurrentAudioJobs,
  handleAudioUpload,
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "녹음하거나 선택한 오디오 파일을 첨부해주세요." });
      return;
    }

    try {
      const transcript = await transcribeUpload(req.file, req.log);
      if (transcript.length < 10) {
        res.status(422).json({ error: "음성에서 충분한 내용을 인식하지 못했습니다. 조금 더 길고 또렷하게 녹음해주세요." });
        return;
      }

      // 자기소개서 작성은 글 품질이 중요하므로 기본(심사) 모델을 쓴다.
      const ai = await getAI("screening");
      const completion = await ai.openai.chat.completions.create({
        model: ai.model,
        messages: [
          {
            role: "system",
            content: `당신은 한국 채용 시장의 전문 커리어 컨설턴트이자 자기소개서 작성 전문가입니다.
사용자가 말한 사실만 사용하고, 회사명·수치·성과·경력을 새로 만들어내지 마세요.
출력은 한국어 자기소개서 본문만 반환하고 설명, 코드 블록, 작성 메모는 포함하지 마세요.`,
          },
          {
            role: "user",
            content: `아래는 구직자의 음성을 변환한 원문입니다.

<음성원문>
${transcript.slice(0, 30000)}
</음성원문>

다음 조건으로 자기소개서를 작성하세요.
1. "## 성장배경", "## 경력 및 경험", "## 입사 후 포부" 세 부분으로 구성합니다.
2. 각 부분은 도입-본론-결론 또는 상황-행동-결과가 드러나는 자연스러운 3문단으로 작성합니다.
3. 이력서에 바로 사용할 수 있는 전문적이고 간결한 문체를 사용합니다.
4. 원문의 의미와 사실을 보존하면서 중복 표현과 구어체를 정리합니다.
5. 원문에 없는 정보는 추측하지 않습니다.
6. 전체 분량은 A4 1~2장 이내로 작성합니다.`,
          },
        ],
        max_completion_tokens: 8192,
      });
      const coverLetter = cleanGeneratedText(completion.choices[0]?.message?.content ?? "");
      if (!coverLetter) throw new Error("AI가 빈 자기소개서를 반환했습니다.");

      res.json(GenerateCoverLetterResponse.parse({ transcript, coverLetter }));
    } catch (error) {
      req.log.error({ err: error }, "Cover letter voice generation failed");
      res.status(502).json({
        error: error instanceof Error && error.message.includes("설정되지 않았습니다")
          ? error.message
          : "음성 변환 또는 자기소개서 생성을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.",
      });
    }
  },
);

export default router;
