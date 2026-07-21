import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, resumesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import OpenAI from "openai";

const router: IRouter = Router();

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// HTML 태그 제거 유틸
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

router.post("/resumes/:id/spellcheck", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) { res.status(400).json({ error: "유효하지 않은 ID입니다." }); return; }

  const [resume] = await db.select().from(resumesTable)
    .where(and(eq(resumesTable.id, id), eq(resumesTable.userId, req.session.userId!)));
  if (!resume) { res.status(404).json({ error: "이력서를 찾을 수 없습니다." }); return; }

  const { content, coverLetter } = req.body as { content?: string; coverLetter?: string };

  const contentText     = content     ? stripHtml(content)     : "";
  const coverLetterText = coverLetter ? stripHtml(coverLetter) : "";

  if (!contentText && !coverLetterText) {
    res.json({ corrections: [], contentCorrected: content ?? "", coverLetterCorrected: coverLetter ?? "" });
    return;
  }

  const systemPrompt = `당신은 한국어 교정 전문가입니다. 이력서와 자기소개서의 오탈자, 맞춤법 오류, 문법 오류를 찾아 수정합니다.
반드시 JSON 형식으로만 응답하세요:
{
  "corrections": [
    { "field": "content" | "coverLetter", "original": "오류 원문", "corrected": "수정된 텍스트", "reason": "수정 이유" }
  ],
  "contentCorrected": "교정된 이력서 전체 텍스트",
  "coverLetterCorrected": "교정된 자기소개서 전체 텍스트"
}
오류가 없으면 corrections 배열은 비워두고, 원문을 그대로 반환하세요.
HTML 태그는 결과에 포함하지 마세요. 순수 텍스트로만 반환하세요.`;

  const userPrompt = [
    contentText     ? `## 이력서 내용\n${contentText.slice(0, 3000)}` : "",
    coverLetterText ? `## 자기소개서\n${coverLetterText.slice(0, 2000)}` : "",
  ].filter(Boolean).join("\n\n");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      max_completion_tokens: 3000,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON 파싱 실패");

    const parsed = JSON.parse(jsonMatch[0]) as {
      corrections: Array<{ field: string; original: string; corrected: string; reason: string }>;
      contentCorrected: string;
      coverLetterCorrected: string;
    };

    res.json({
      corrections: parsed.corrections ?? [],
      contentCorrected: parsed.contentCorrected ?? contentText,
      coverLetterCorrected: parsed.coverLetterCorrected ?? coverLetterText,
    });
  } catch {
    // AI 오류 시 원문 그대로 반환
    res.json({ corrections: [], contentCorrected: contentText, coverLetterCorrected: coverLetterText });
  }
});

export default router;
