import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, resumesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { getAI } from "../lib/openai";
import { buildSpellcheckPrompt, detectSpellcheckLanguages } from "../lib/spellcheck-prompt";

const router: IRouter = Router();

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

  // 편집 중(미저장) 내용을 검토하므로 저장된 language가 아니라 요청 본문에서 필드별로 판정한다.
  const systemPrompt = buildSpellcheckPrompt(detectSpellcheckLanguages(contentText, coverLetterText));

  const userPrompt = [
    contentText     ? `## 이력서 내용\n${contentText.slice(0, 3000)}` : "",
    coverLetterText ? `## 자기소개서\n${coverLetterText.slice(0, 2000)}` : "",
  ].filter(Boolean).join("\n\n");

  try {
    const ai = await getAI("light");
      const completion = await ai.openai.chat.completions.create({
      model: ai.model,
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
