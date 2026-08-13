import { useState } from "react"
import { createPortal } from "react-dom"
import { Printer, X, Check } from "lucide-react"

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// ── 템플릿 정의 ─────────────────────────────────────────────────────────────
export type TemplateId = "classic" | "modern" | "minimal"

interface TemplateMeta {
  id: TemplateId
  name: string
  desc: string
}

const TEMPLATES: TemplateMeta[] = [
  { id: "classic", name: "클래식", desc: "명조체 제목 · 얇은 구분선 · 정통 문서 느낌" },
  { id: "modern",  name: "모던",   desc: "고딕체 · 왼쪽 컬러 바 · 섹션 칩" },
  { id: "minimal", name: "미니멀", desc: "여백 중심 · 옅은 회색 섹션 라벨" },
]

// ── HTML → plain text ──────────────────────────────────────────────────────
function htmlToText(html: string): string {
  if (!html) return ""
  // HTML이 아니면 그대로 반환
  if (!/<[a-z][\s\S]*>/i.test(html)) return html.trim()
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

// ── 섹션 헤딩 감지 ──────────────────────────────────────────────────────────
// [경력], ■ ..., 짧고 ':' 로 끝나는 라인 등을 헤딩으로 취급
function isHeadingLine(line: string): boolean {
  const t = line.trim()
  if (!t) return false
  if (/^\[.+\]$/.test(t)) return true               // [경력]
  if (/^[■◆▶●※□▪]/.test(t)) return true            // ■ 항목
  if (/^#{1,3}\s/.test(t)) return true              // # 마크다운
  if (/^【.+】$/.test(t)) return true                // 【경력】
  // 짧은 라인이 ':' 로 끝나고 뒤에 내용이 거의 없음
  if (t.length <= 24 && /[:：]$/.test(t)) return true
  return false
}

function cleanHeading(line: string): string {
  return line
    .trim()
    .replace(/^[■◆▶●※□▪]\s*/, "")
    .replace(/^#{1,3}\s*/, "")
    .replace(/^\[(.+)\]$/, "$1")
    .replace(/^【(.+)】$/, "$1")
    .replace(/[:：]$/, "")
    .trim()
}

interface Block {
  type: "heading" | "paragraph"
  text: string
}

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = []
  const lines = text.split("\n")
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "")
    if (!line.trim()) continue
    if (isHeadingLine(line)) {
      blocks.push({ type: "heading", text: cleanHeading(line) })
    } else {
      blocks.push({ type: "paragraph", text: line.trim() })
    }
  }
  return blocks
}

// ── 인쇄 영역 데이터 ────────────────────────────────────────────────────────
export interface ResumePrintData {
  title: string
  content: string       // HTML 또는 plain text
  coverLetter: string   // HTML 또는 plain text
  aiSummary?: string | null
}

// ── 템플릿별 렌더 ───────────────────────────────────────────────────────────
function TemplateSection(props: {
  template: TemplateId
  label: string
  blocks: Block[]
}) {
  const { template, label, blocks } = props
  return (
    <section className="rp-section">
      <div className={cn("rp-section-label", `rp-section-label-${template}`)}>
        {label}
      </div>
      <div className="rp-section-body">
        {blocks.map((b, i) =>
          b.type === "heading" ? (
            <h3 key={i} className={cn("rp-heading", `rp-heading-${template}`)}>
              {b.text}
            </h3>
          ) : (
            <p key={i} className="rp-paragraph">{b.text}</p>
          ),
        )}
      </div>
    </section>
  )
}

function PrintDocument(props: { template: TemplateId; data: ResumePrintData }) {
  const { template, data } = props
  const contentText = htmlToText(data.content)
  const coverText   = htmlToText(data.coverLetter)
  const contentBlocks = parseBlocks(contentText)
  const coverBlocks   = parseBlocks(coverText)

  return (
    <div className={cn("rp-doc", `rp-doc-${template}`)}>
      <header className="rp-header">
        <h1 className={cn("rp-title", `rp-title-${template}`)}>{data.title}</h1>
      </header>

      {data.aiSummary && (
        <div className="rp-summary">
          <div className="rp-summary-label">AI 요약</div>
          <p className="rp-summary-text">{data.aiSummary}</p>
        </div>
      )}

      {contentBlocks.length > 0 && (
        <TemplateSection template={template} label="이력서" blocks={contentBlocks} />
      )}
      {coverBlocks.length > 0 && (
        <TemplateSection template={template} label="자기소개서" blocks={coverBlocks} />
      )}
    </div>
  )
}

// ── 미리보기 썸네일 (CSS-only) ──────────────────────────────────────────────
function TemplateThumb({ template }: { template: TemplateId }) {
  return (
    <div className={cn("rp-thumb", `rp-thumb-${template}`)}>
      <div className="rp-thumb-title" />
      <div className="rp-thumb-rule" />
      <div className="rp-thumb-label" />
      <div className="rp-thumb-line" />
      <div className="rp-thumb-line short" />
      <div className="rp-thumb-label" />
      <div className="rp-thumb-line" />
      <div className="rp-thumb-line short" />
    </div>
  )
}

// ── 인쇄 스타일시트 (스코프 + @media print) ─────────────────────────────────
const PRINT_STYLES = `
/* 화면상 인쇄 영역 컨테이너 */
.rp-print-area {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: #f1f5f9;
  overflow: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.rp-toolbar {
  position: sticky;
  top: 0;
  width: 100%;
  display: flex;
  justify-content: center;
  gap: 12px;
  padding: 12px;
  background: rgba(15, 23, 42, 0.92);
  z-index: 2;
}
.rp-page {
  background: #ffffff;
  color: #1a1a1a;
  width: 210mm;
  min-height: 297mm;
  margin: 24px 0;
  padding: 20mm 18mm;
  box-shadow: 0 4px 24px rgba(0,0,0,0.15);
  box-sizing: border-box;
}
@media (max-width: 240mm) {
  .rp-page { width: 100%; margin: 12px; padding: 14mm 10mm; }
}

/* ── 공통 문서 요소 ── */
.rp-doc { font-size: 10.5pt; line-height: 1.75; word-break: keep-all; }
.rp-header { margin-bottom: 8mm; }
.rp-summary {
  margin: 6mm 0;
  padding: 4mm 5mm;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}
.rp-summary-label { font-size: 8.5pt; font-weight: 700; color: #4f46e5; margin-bottom: 1.5mm; letter-spacing: 0.02em; }
.rp-summary-text { font-size: 9.5pt; color: #334155; margin: 0; }
.rp-section { margin-top: 8mm; page-break-inside: avoid; break-inside: avoid; }
.rp-section-body { }
.rp-paragraph { margin: 0 0 2.2mm; }
.rp-heading { }

/* ── 클래식 ── */
.rp-doc-classic { font-family: "Nanum Myeongjo", "Batang", serif; color: #111; }
.rp-title-classic {
  font-family: "Nanum Myeongjo", "Batang", serif;
  font-size: 20pt; font-weight: 700; text-align: center;
  padding-bottom: 3mm; border-bottom: 1.5px solid #111; margin: 0;
}
.rp-section-label-classic {
  font-family: "Nanum Myeongjo", "Batang", serif;
  font-size: 13pt; font-weight: 700; color: #111;
  border-bottom: 1px solid #999; padding-bottom: 1.5mm; margin-bottom: 3mm;
}
.rp-heading-classic {
  font-family: "Nanum Myeongjo", "Batang", serif;
  font-size: 11pt; font-weight: 700; color: #222; margin: 4mm 0 1.5mm;
}
.rp-doc-classic .rp-paragraph { font-family: "Nanum Gothic", "Malgun Gothic", sans-serif; }

/* ── 모던 ── */
.rp-doc-modern { font-family: "Noto Sans KR", "Malgun Gothic", sans-serif; color: #1e293b; }
.rp-title-modern {
  font-size: 19pt; font-weight: 800; color: #0f172a; margin: 0;
  padding-left: 5mm; border-left: 4px solid #2563eb;
}
.rp-section-label-modern {
  display: inline-block; font-size: 10pt; font-weight: 700; color: #ffffff;
  background: #2563eb; padding: 1mm 4mm; border-radius: 4px; margin-bottom: 3mm;
}
.rp-heading-modern {
  font-size: 11pt; font-weight: 700; color: #1d4ed8; margin: 4mm 0 1.5mm;
  padding-left: 3mm; border-left: 3px solid #93c5fd;
}
.rp-doc-modern .rp-section { padding-left: 4mm; border-left: 2px solid #e2e8f0; }

/* ── 미니멀 ── */
.rp-doc-minimal { font-family: "Noto Sans KR", "Malgun Gothic", sans-serif; color: #374151; letter-spacing: 0.01em; }
.rp-title-minimal {
  font-size: 22pt; font-weight: 300; color: #111827; margin: 0 0 4mm; letter-spacing: 0.02em;
}
.rp-section-minimal { margin-top: 12mm; }
.rp-doc-minimal .rp-section { margin-top: 12mm; }
.rp-section-label-minimal {
  font-size: 8.5pt; font-weight: 600; color: #9ca3af; text-transform: uppercase;
  letter-spacing: 0.15em; margin-bottom: 4mm;
}
.rp-heading-minimal {
  font-size: 11pt; font-weight: 600; color: #374151; margin: 5mm 0 2mm;
}
.rp-doc-minimal .rp-paragraph { color: #4b5563; }

/* ── 썸네일 (선택 카드) ── */
.rp-thumb {
  width: 100%; aspect-ratio: 3 / 4; background: #fff; border-radius: 6px;
  padding: 10px; display: flex; flex-direction: column; gap: 5px;
  border: 1px solid #e2e8f0; overflow: hidden;
}
.rp-thumb-title { height: 10px; border-radius: 2px; background: #1e293b; }
.rp-thumb-rule { height: 2px; background: #cbd5e1; }
.rp-thumb-label { height: 6px; width: 40%; border-radius: 2px; background: #94a3b8; margin-top: 3px; }
.rp-thumb-line { height: 4px; border-radius: 2px; background: #e2e8f0; }
.rp-thumb-line.short { width: 70%; }
.rp-thumb-classic .rp-thumb-title { background: #111; margin: 0 auto; width: 60%; }
.rp-thumb-classic .rp-thumb-rule { background: #111; }
.rp-thumb-modern .rp-thumb-title { background: #2563eb; width: 55%; }
.rp-thumb-modern .rp-thumb-label { background: #2563eb; border-radius: 3px; width: 30%; }
.rp-thumb-modern .rp-thumb-rule { background: #93c5fd; }
.rp-thumb-minimal .rp-thumb-title { background: #d1d5db; width: 65%; height: 12px; }
.rp-thumb-minimal .rp-thumb-rule { background: transparent; }
.rp-thumb-minimal .rp-thumb-label { background: #d1d5db; width: 25%; }
.rp-thumb-minimal .rp-thumb-line { background: #f3f4f6; }

/* ── 인쇄 시: 인쇄 영역만 보이도록 ── */
@media print {
  @page { size: A4; margin: 12mm; }
  body * { visibility: hidden !important; }
  .rp-print-area, .rp-print-area * { visibility: visible !important; }
  .rp-print-area {
    position: absolute !important; inset: 0 !important;
    background: #fff !important; overflow: visible !important;
    display: block !important;
  }
  .rp-toolbar { display: none !important; }
  .rp-page {
    width: auto !important; min-height: 0 !important; margin: 0 !important;
    padding: 0 !important; box-shadow: none !important;
  }
}
`

// ── 인쇄 뷰 (portal) ────────────────────────────────────────────────────────
function PrintView(props: {
  template: TemplateId
  data: ResumePrintData
  onClose: () => void
}) {
  const { template, data, onClose } = props
  return createPortal(
    <>
      <style>{PRINT_STYLES}</style>
      <div className="rp-print-area" role="dialog" aria-modal="true">
        <div className="rp-toolbar">
          <Button onClick={() => window.print()} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Printer className="w-4 h-4" />
            인쇄 / PDF 저장
          </Button>
          <Button variant="secondary" onClick={onClose} className="gap-2">
            <X className="w-4 h-4" />
            닫기
          </Button>
        </div>
        <div className="rp-page">
          <PrintDocument template={template} data={data} />
        </div>
      </div>
    </>,
    document.body,
  )
}

// ── 메인: 템플릿 선택 다이얼로그 + 인쇄 뷰 ───────────────────────────────────
export function ResumePrintDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: ResumePrintData
}) {
  const { open, onOpenChange, data } = props
  const [printing, setPrinting] = useState<TemplateId | null>(null)

  const startPrint = (id: TemplateId) => {
    onOpenChange(false)
    setPrinting(id)
  }

  return (
    <>
      <style>{PRINT_STYLES}</style>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>이력서 PDF 다운로드</DialogTitle>
            <DialogDescription>
              원하는 템플릿을 선택하세요. 인쇄 화면에서 &ldquo;PDF로 저장&rdquo;을 선택하면 파일로 저장됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => startPrint(t.id)}
                className={cn(
                  "group flex flex-col rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-left",
                  "transition-all hover:border-blue-400 hover:shadow-md focus:outline-none",
                  "focus-visible:ring-2 focus-visible:ring-blue-500",
                )}
              >
                <div className="mb-3 rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-100">
                  <TemplateThumb template={t.id} />
                </div>
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  {t.name}
                  <Check className="w-3.5 h-3.5 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="mt-0.5 text-xs text-slate-500 leading-snug">{t.desc}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {printing && (
        <PrintView
          template={printing}
          data={data}
          onClose={() => setPrinting(null)}
        />
      )}
    </>
  )
}
