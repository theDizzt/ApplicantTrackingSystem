/**
 * 이력 항목(자격증·어학·프로젝트·수상/공모전·대외활동·경력·교육)의 표시 이름과,
 * 이력서 본문(리치 텍스트 HTML)에 넣을 때의 서식.
 */
export const PROFILE_KINDS = ["certificate", "language", "project", "award", "activity", "career", "education"] as const
export type ProfileKind = typeof PROFILE_KINDS[number]

export const PROFILE_KIND_LABEL: Record<ProfileKind, string> = {
  certificate: "자격증",
  language: "어학",
  project: "프로젝트",
  award: "수상·공모전",
  activity: "대외활동",
  career: "경력",
  education: "교육·수료",
}

/** 입력 칸 이름: 종류마다 기관·점수 칸의 뜻이 다르다. score가 null이면 점수 칸을 숨긴다. */
export const PROFILE_KIND_FIELDS: Record<ProfileKind, { title: string; organization: string; score: string | null; period: boolean }> = {
  certificate: { title: "자격증명", organization: "발급기관", score: "등급", period: false },
  language: { title: "시험명", organization: "주관기관", score: "점수·등급", period: false },
  project: { title: "프로젝트명", organization: "소속·팀", score: null, period: true },
  award: { title: "대회·공모전명", organization: "주최", score: "수상 결과", period: false },
  activity: { title: "활동명", organization: "기관·단체", score: null, period: true },
  career: { title: "회사·직무", organization: "부서", score: null, period: true },
  education: { title: "교육과정명", organization: "교육기관", score: null, period: true },
}

export interface ProfileItemLike {
  kind: string
  title: string
  organization?: string | null
  startDate?: string | null
  endDate?: string | null
  score?: string | null
  description?: string | null
  url?: string | null
}

export function kindLabel(kind: string): string {
  return PROFILE_KIND_LABEL[kind as ProfileKind] ?? kind
}

/** "2024-06" / "2024-06-15" → "2024.06" / "2024.06.15" */
export function formatPeriod(start?: string | null, end?: string | null): string {
  const f = (v?: string | null) => (v ? v.replace(/-/g, ".") : "")
  if (start && end) return `${f(start)} ~ ${f(end)}`
  if (start) return f(start)
  return end ? `~ ${f(end)}` : ""
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

/** 이름을 뺀 부가 정보: "한국산업인력공단 · 최종 합격 · 2024.06" */
export function details(item: ProfileItemLike): string {
  return [item.organization, item.score, formatPeriod(item.startDate, item.endDate)]
    .map((v) => v?.trim())
    .filter(Boolean)
    .join(" · ")
}

/** 고른 항목을 종류별 소제목과 목록으로 묶은 HTML. 종류 순서는 PROFILE_KINDS를 따른다. */
export function profileItemsHtml(items: ProfileItemLike[]): string {
  const known = new Set<string>(PROFILE_KINDS)
  const kinds = [...PROFILE_KINDS, ...new Set(items.map((i) => i.kind).filter((k) => !known.has(k)))]
  const sections: string[] = []
  for (const kind of kinds) {
    const group = items.filter((i) => i.kind === kind)
    if (group.length === 0) continue
    const rows = group.map((item) => {
      let line = `<strong>${escapeHtml(item.title.trim())}</strong>`
      const rest = details(item)
      if (rest) line += ` · ${escapeHtml(rest)}`
      if (item.description?.trim()) line += `<br>${escapeHtml(item.description.trim()).replace(/\n/g, "<br>")}`
      return `<li><p>${line}</p></li>`
    })
    sections.push(`<h3>${escapeHtml(kindLabel(kind))}</h3><ul>${rows.join("")}</ul>`)
  }
  return sections.join("")
}
