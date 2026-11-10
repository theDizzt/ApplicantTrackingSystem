import { useState } from "react"
import {
  useListProfileItems, useCreateProfileItem, useUpdateProfileItem, useDeleteProfileItem,
  getListProfileItemsQueryKey, type ProfileItem, type ProfileItemInputKind,
} from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { Award, ExternalLink, Pencil, Plus, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { details, PROFILE_KINDS, PROFILE_KIND_FIELDS, PROFILE_KIND_LABEL, type ProfileKind } from "@/lib/profile-items"

interface Draft {
  id: number | null
  kind: ProfileKind
  title: string
  organization: string
  startDate: string
  endDate: string
  score: string
  description: string
  url: string
}

const EMPTY: Omit<Draft, "kind"> = { id: null, title: "", organization: "", startDate: "", endDate: "", score: "", description: "", url: "" }
const DATE_PATTERN = /^\d{4}-\d{2}(-\d{2})?$/

function toDraft(item: ProfileItem): Draft {
  return {
    id: item.id,
    kind: item.kind as ProfileKind,
    title: item.title,
    organization: item.organization ?? "",
    startDate: item.startDate ?? "",
    endDate: item.endDate ?? "",
    score: item.score ?? "",
    description: item.description ?? "",
    url: item.url ?? "",
  }
}

export default function ProfileItemsPage() {
  const queryClient = useQueryClient()
  const { data: items, isLoading } = useListProfileItems()
  const create = useCreateProfileItem()
  const update = useUpdateProfileItem()
  const remove = useDeleteProfileItem()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [filter, setFilter] = useState<ProfileKind | "all">("all")

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListProfileItemsQueryKey() })
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d))

  const save = () => {
    if (!draft) return
    if (!draft.title.trim()) { toast.error(`${PROFILE_KIND_FIELDS[draft.kind].title}을(를) 입력해주세요`); return }
    for (const v of [draft.startDate, draft.endDate]) {
      if (v && !DATE_PATTERN.test(v)) { toast.error("날짜는 YYYY-MM 형식으로 입력해주세요"); return }
    }
    const fields = PROFILE_KIND_FIELDS[draft.kind]
    const data = {
      kind: draft.kind as ProfileItemInputKind,
      title: draft.title.trim(),
      organization: draft.organization.trim() || null,
      startDate: draft.startDate || null,
      endDate: fields.period ? draft.endDate || null : null,
      score: fields.score ? draft.score.trim() || null : null,
      description: draft.description.trim() || null,
      url: draft.url.trim() || null,
    }
    const done = { onSuccess: () => { toast.success("저장했습니다"); setDraft(null); refresh() }, onError: () => toast.error("저장하지 못했습니다") }
    if (draft.id == null) create.mutate({ data }, done)
    else update.mutate({ id: draft.id, data }, done)
  }

  const destroy = (item: ProfileItem) => {
    if (!window.confirm(`'${item.title}' 항목을 삭제할까요?`)) return
    remove.mutate({ id: item.id }, { onSuccess: () => { toast.success("삭제했습니다"); refresh() }, onError: () => toast.error("삭제하지 못했습니다") })
  }

  const shown = (items ?? []).filter((i) => filter === "all" || i.kind === filter)
  const counts = new Map<string, number>()
  for (const i of items ?? []) counts.set(i.kind, (counts.get(i.kind) ?? 0) + 1)
  const fields = draft ? PROFILE_KIND_FIELDS[draft.kind] : null
  const saving = create.isPending || update.isPending

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">이력 항목</h1>
          <p className="text-muted-foreground mt-1">
            자격증·어학·프로젝트·공모전 등을 한 번 등록해 두고, 이력서 편집 화면에서 골라 넣습니다.
          </p>
        </div>
        <Button onClick={() => setDraft({ ...EMPTY, kind: filter === "all" ? "certificate" : filter })} data-testid="button-add-item">
          <Plus className="w-4 h-4 mr-2" /> 항목 추가
        </Button>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="항목 종류">
        {(["all", ...PROFILE_KINDS] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={filter === k}
            onClick={() => setFilter(k)}
            className={cn(
              "px-3 py-1 rounded-full text-sm font-medium border transition-colors",
              filter === k ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-input hover:border-primary/60",
            )}
          >
            {k === "all" ? `전체 ${items?.length ?? 0}` : `${PROFILE_KIND_LABEL[k]} ${counts.get(k) ?? 0}`}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      ) : shown.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <Award className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold">등록된 항목이 없습니다</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-2">
              자격증, 어학 점수, 프로젝트, 수상 내역을 등록하면 여러 이력서에 똑같이 넣을 수 있습니다.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="list-profile-items">
          {shown.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {PROFILE_KIND_LABEL[item.kind as ProfileKind] ?? item.kind}
                  </span>
                  <div className="font-semibold break-words">{item.title}</div>
                  {details(item) && <div className="text-sm text-muted-foreground">{details(item)}</div>}
                  {item.description && <p className="text-sm text-slate-600 whitespace-pre-line line-clamp-3">{item.description}</p>}
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      <ExternalLink className="w-3 h-3" /> 링크
                    </a>
                  )}
                </div>
                <div className="flex shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => setDraft(toDraft(item))} aria-label="수정"><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => destroy(item)} aria-label="삭제"><Trash2 className="w-4 h-4 text-rose-500" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={draft != null} onOpenChange={(open) => { if (!open) setDraft(null) }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id == null ? "항목 추가" : "항목 수정"}</DialogTitle>
            <DialogDescription>날짜는 연·월만 넣어도 됩니다.</DialogDescription>
          </DialogHeader>
          {draft && fields && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {PROFILE_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => set("kind", k)}
                    className={cn(
                      "px-3 py-1 rounded-full text-sm font-medium border",
                      draft.kind === k ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-input",
                    )}
                  >
                    {PROFILE_KIND_LABEL[k]}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-title">{fields.title}</Label>
                <Input id="item-title" value={draft.title} onChange={(e) => set("title", e.target.value)} maxLength={200} data-testid="input-item-title" />
              </div>
              <div className={cn("grid gap-4", fields.score ? "sm:grid-cols-2" : "")}>
                <div className="space-y-1.5">
                  <Label htmlFor="item-org">{fields.organization}</Label>
                  <Input id="item-org" value={draft.organization} onChange={(e) => set("organization", e.target.value)} maxLength={200} />
                </div>
                {fields.score && (
                  <div className="space-y-1.5">
                    <Label htmlFor="item-score">{fields.score}</Label>
                    <Input id="item-score" value={draft.score} onChange={(e) => set("score", e.target.value)} maxLength={100} />
                  </div>
                )}
              </div>
              <div className={cn("grid gap-4", fields.period ? "grid-cols-2" : "")}>
                <div className="space-y-1.5">
                  <Label htmlFor="item-start">{fields.period ? "시작" : "취득·수상일"}</Label>
                  <Input id="item-start" type="month" placeholder="2024-06" value={draft.startDate.slice(0, 7)} onChange={(e) => set("startDate", e.target.value)} />
                </div>
                {fields.period && (
                  <div className="space-y-1.5">
                    <Label htmlFor="item-end">종료 (진행 중이면 비움)</Label>
                    <Input id="item-end" type="month" placeholder="2024-12" value={draft.endDate.slice(0, 7)} onChange={(e) => set("endDate", e.target.value)} />
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-desc">설명 (역할·성과)</Label>
                <Textarea id="item-desc" rows={4} value={draft.description} onChange={(e) => set("description", e.target.value)} maxLength={4000} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-url">링크 (결과물·증빙)</Label>
                <Input id="item-url" type="url" placeholder="https://" value={draft.url} onChange={(e) => set("url", e.target.value)} maxLength={1000} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>취소</Button>
            <Button onClick={save} disabled={saving} data-testid="button-save-item">
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
