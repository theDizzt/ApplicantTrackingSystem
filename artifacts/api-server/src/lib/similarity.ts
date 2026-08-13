import { getAI, getAIConfig, getSetting } from "./openai";

// 공고 직무 내용과 지원자 자기소개서 간의 임베딩 기반 문장 유사도(0~100)를 계산한다.
// 임베딩 API가 없는 환경에서는 null을 반환하며, 어떤 오류에도 throw하지 않는다.

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 임베딩 모델 선택:
 *   settings 키 ai_embedding_model 이 있으면 그 값을 사용,
 *   없으면 baseUrl 미설정 또는 "openai" 포함 시 "text-embedding-3-small",
 *   그 외에는 null(건너뜀).
 */
export async function jobSimilarityScore(
  jobText: string,
  applicantText: string,
): Promise<number | null> {
  try {
    if (!jobText || !jobText.trim() || !applicantText || !applicantText.trim()) {
      return null;
    }

    const configured = (await getSetting("ai_embedding_model"))?.trim() || "";
    let embeddingModel: string | null;
    if (configured) {
      embeddingModel = configured;
    } else {
      const { baseUrl } = await getAIConfig();
      if (!baseUrl || baseUrl.toLowerCase().includes("openai")) {
        embeddingModel = "text-embedding-3-small";
      } else {
        embeddingModel = null;
      }
    }
    if (!embeddingModel) return null;

    const { openai } = await getAI();
    const response = await openai.embeddings.create({
      model: embeddingModel,
      input: [jobText.slice(0, 4000), applicantText.slice(0, 4000)],
    });

    const vecA = response.data[0]?.embedding;
    const vecB = response.data[1]?.embedding;
    if (!Array.isArray(vecA) || !Array.isArray(vecB)) return null;

    const cos = cosineSimilarity(vecA, vecB);
    return Math.max(0, Math.min(100, Math.round(cos * 100)));
  } catch {
    return null;
  }
}
