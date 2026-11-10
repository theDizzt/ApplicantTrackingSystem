import { useState } from "react"
import { Link } from "wouter"
import { getListProfileItemsQueryKey, useListProfileItems } from "@workspace/api-client-react"
import { Award } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { details, kindLabel, PROFILE_KINDS, profileItemsHtml } from "@/lib/profile-items"

/** 등록해 둔 이력 항목을 골라 이력서 본문 끝에 넣는다. */
export function ProfileItemsPicker({ onInsert }: { onInsert: (html: string) => void }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const { data: items, isLoading } = useListProfileItems({ query: { enabled: open, queryKey: getListProfileItemsQueryKey() } })

  const sorted = [...(items ?? [])].sort(
    (a, b) => (PROFILE_KINDS as readonly string[]).indexOf(a.kind) - (PROFILE_KINDS as readonly string[]).indexOf(b.kind),
  )
  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const insert = () => {
    const html = profileItemsHtml(sorted.filter((i) => selected.has(i.id)))
    if (html) onInsert(html)
    setOpen(false)
    setSelected(new Set())
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)} data-testid="button-insert-profile-items">
        <Award className="w-4 h-4 mr-1.5" /> 이력 항목 넣기
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>이력 항목 넣기</DialogTitle>
            <DialogDescription>고른 항목을 종류별로 묶어 이력서 내용 끝에 붙입니다. 넣은 뒤에도 자유롭게 고칠 수 있습니다.</DialogDescription>
          </DialogHeader>
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              등록된 항목이 없습니다. <Link href="/profile" className="text-primary underline">이력 항목</Link>에서 먼저 추가해주세요.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {sorted.map((item) => (
                <li key={item.id}>
                  <label className="flex items-start gap-3 rounded-lg border p-2.5 cursor-pointer hover:border-primary/50">
                    <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggle(item.id)} className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="text-[11px] font-semibold text-primary mr-1.5">{kindLabel(item.kind)}</span>
                      <span className="text-sm font-medium">{item.title}</span>
                      {details(item) && <span className="block text-xs text-muted-foreground">{details(item)}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button onClick={insert} disabled={selected.size === 0} data-testid="button-confirm-insert">
              {selected.size > 0 ? `${selected.size}개 넣기` : "넣기"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
