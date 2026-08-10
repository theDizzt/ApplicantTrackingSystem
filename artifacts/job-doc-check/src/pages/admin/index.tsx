import { useState, useEffect, useCallback } from "react"
import { useLocation } from "wouter"
import {
  Users, Building2, Cpu, TrendingUp, LogOut, Plus, Pencil, Trash2,
  Shield, RefreshCw, ChevronDown, ChevronUp, X, Check, AlertCircle, Download
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "")

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = new Error(body.error ?? `HTTP ${res.status}`) as Error & { code?: string }
    err.code = body.code
    throw err
  }
  return res.json()
}

interface Stats {
  totalUsers: number
  usersByPlan: Record<string, number>
  monthlyRevenue: number
  totalTokens: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCostKrw: number
  monthTokens: number
  monthCostKrw: number
  totalAnalyses: number
  monthAnalyses: number
  totalOrganizations: number
}

interface User {
  id: number
  name: string
  email: string
  subscriptionStatus: string
  analysesUsedThisMonth: number
  createdAt: string
}

interface Organization {
  id: number
  name: string
  contactPerson: string | null
  contactEmail: string | null
  contactPhone: string | null
  description: string | null
  memberCount: number
  status: string
  registeredAt: string
}

const PLAN_LABELS: Record<string, string> = { free: "Free", basic: "베이직", premium: "프리미엄" }
const PLAN_COLORS: Record<string, string> = {
  free: "bg-slate-100 text-slate-700",
  basic: "bg-blue-100 text-blue-700",
  premium: "bg-amber-100 text-amber-700",
}

function fmt(n: number) { return n.toLocaleString("ko-KR") }
function fmtKrw(n: number) { return `₩${n.toLocaleString("ko-KR")}` }

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color?: string
}) {
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="p-5 flex gap-4 items-start">
        <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg ${color ?? "bg-primary/10"}`}>
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-400 font-medium mb-0.5">{label}</p>
          <p className="text-xl font-bold text-white">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function OrgDialog({
  open, onClose, initial, onSave,
}: {
  open: boolean
  onClose: () => void
  initial?: Organization | null
  onSave: () => void
}) {
  const [form, setForm] = useState({
    name: "", contactPerson: "", contactEmail: "", contactPhone: "",
    description: "", memberCount: "0", plan: "free", status: "active",
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name,
        contactPerson: initial.contactPerson ?? "",
        contactEmail: initial.contactEmail ?? "",
        contactPhone: initial.contactPhone ?? "",
        description: initial.description ?? "",
        memberCount: String(initial.memberCount),
        plan: (initial as any).plan ?? "free",
        status: initial.status,
      })
    } else {
      setForm({ name: "", contactPerson: "", contactEmail: "", contactPhone: "", description: "", memberCount: "0", plan: "free", status: "active" })
    }
  }, [initial, open])

  const field = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value })),
  })

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("협회명을 입력해주세요."); return }
    setSaving(true)
    try {
      const body = { ...form, memberCount: parseInt(form.memberCount, 10) || 0, plan: form.plan }
      if (initial) {
        await api(`/admin/organizations/${initial.id}`, { method: "PATCH", body: JSON.stringify(body) })
        toast.success("협회 정보가 수정되었습니다.")
      } else {
        await api("/admin/organizations", { method: "POST", body: JSON.stringify(body) })
        toast.success("협회가 등록되었습니다.")
      }
      onSave()
      onClose()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">{initial ? "협회 수정" : "협회 등록"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-slate-300 text-xs">협회명 *</Label>
              <Input {...field("name")} placeholder="협회명" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">담당자</Label>
              <Input {...field("contactPerson")} placeholder="담당자명" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">회원 수</Label>
              <Input {...field("memberCount")} type="number" min="0" placeholder="0" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">이메일</Label>
              <Input {...field("contactEmail")} type="email" placeholder="contact@org.com" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">전화번호</Label>
              <Input {...field("contactPhone")} placeholder="02-0000-0000" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-slate-300 text-xs">설명</Label>
              <Input {...field("description")} placeholder="협회 설명 (선택)" className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">소속 플랜 (회원 등급)</Label>
              <Select value={form.plan} onValueChange={(v) => setForm((p) => ({ ...p, plan: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="free">무료 (Free)</SelectItem>
                  <SelectItem value="basic">베이직 (Basic)</SelectItem>
                  <SelectItem value="premium">프리미엄 (Premium)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-500 mt-0.5">이 기관으로 가입한 사용자에게 자동 적용됩니다</p>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-300 text-xs">상태</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700 text-white">
                  <SelectItem value="active">활성</SelectItem>
                  <SelectItem value="inactive">비활성</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white">취소</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "저장 중..." : "저장"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type Tab = "overview" | "users" | "organizations" | "ai"

type LocalStatus = {
  isLocal: boolean
  baseUrl: string
  serverUp: boolean
  models: { name: string; sizeBytes: number; modifiedAt: string }[]
  configuredModel: string
  modelInstalled: boolean
  error?: string
}

function formatGB(bytes: number) {
  return bytes > 0 ? `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB` : ""
}

type DiskUsage = {
  path: string
  totalBytes: number
  freeBytes: number
  usedBytes: number
  usedPercent: number
}

type PullProgress = {
  status: string
  percent: number | null
  completedBytes: number
  totalBytes: number
}

function LocalLLMStatusCard() {
  const [status, setStatus] = useState<LocalStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [pullProgress, setPullProgress] = useState<PullProgress | null>(null)
  const [switching, setSwitching] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ name: string; sizeBytes: number } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [disk, setDisk] = useState<DiskUsage | null>(null)
  const [modelSize, setModelSize] = useState<{ model: string; sizeBytes: number | null; requiredBytes: number | null } | null>(null)

  const handleCleanup = useCallback(async () => {
    setCleaning(true)
    try {
      const d = await api("/admin/settings/ai/local-cleanup", { method: "POST" })
      const freed = Number(d.freedBytes ?? 0)
      if (Number(d.deletedCount ?? 0) > 0) {
        toast.success(`불완전 임시 파일 ${d.deletedCount}개를 정리했습니다 (${formatGB(freed) || "1GB 미만"} 확보).`)
      } else {
        toast.info("정리할 임시 파일이 없습니다.")
      }
      if (Array.isArray(d.errors) && d.errors.length > 0) {
        toast.error(`일부 파일은 정리하지 못했습니다: ${d.errors[0]}`)
      }
    } catch (e: any) {
      toast.error(`임시 파일 정리 실패: ${e.message}`)
    } finally {
      setCleaning(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api("/admin/settings/ai/local-status")
      setStatus(d)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
    // 디스크 여유 공간은 부가 정보 — 실패해도 카드 자체는 동작
    try {
      setDisk(await api("/admin/settings/ai/disk-usage"))
    } catch { setDisk(null) }
    // 설정된 모델의 예상 다운로드 크기 — 조회 실패해도 카드 자체는 동작
    try {
      setModelSize(await api("/admin/settings/ai/model-size"))
    } catch { setModelSize(null) }
  }, [])

  // 서버의 pull 진행 상태를 폴링 — 완료/실패 시 종료
  const pollPullStatus = useCallback(async (): Promise<void> => {
    while (true) {
      let d: any
      try {
        d = await api("/admin/settings/ai/local-pull/status")
      } catch {
        // 일시적 네트워크 오류는 무시하고 재시도
        await new Promise((r) => setTimeout(r, 2000))
        continue
      }
      if (!d.active) break
      setPullProgress({
        status: String(d.status ?? ""),
        percent: d.percent ?? null,
        completedBytes: Number(d.completedBytes ?? 0),
        totalBytes: Number(d.totalBytes ?? 0),
      })
      if (!d.inProgress) {
        if (d.cancelled) {
          const freed = Number(d.cleanedFreedBytes ?? 0)
          toast.info(
            freed > 0
              ? `모델 다운로드가 취소되었습니다. 임시 파일 ${formatGB(freed)}를 정리했습니다.`
              : "모델 다운로드가 취소되었습니다."
          )
        }
        else if (d.error) toast.error(`모델 다운로드 실패: ${d.error}`)
        else if (d.done) toast.success("모델 다운로드가 완료되었습니다.")
        break
      }
      await new Promise((r) => setTimeout(r, 1500))
    }
    setPulling(false)
    setPullProgress(null)
    refresh()
  }, [refresh])

  const handlePull = useCallback(async () => {
    setPulling(true)
    setPullProgress({ status: "요청 중...", percent: null, completedBytes: 0, totalBytes: 0 })
    try {
      await api("/admin/settings/ai/local-pull", { method: "POST" })
      await pollPullStatus()
    } catch (e: any) {
      toast.error(`모델 다운로드 실패: ${e.message}`)
      setPulling(false)
      setPullProgress(null)
    }
  }, [pollPullStatus])

  // 페이지 재진입 시 진행 중인 다운로드가 있으면 진행률 표시 재개
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const d: any = await api("/admin/settings/ai/local-pull/status")
        if (!cancelled && d.active && d.inProgress) {
          setPulling(true)
          setPullProgress({
            status: String(d.status ?? ""),
            percent: d.percent ?? null,
            completedBytes: Number(d.completedBytes ?? 0),
            totalBytes: Number(d.totalBytes ?? 0),
          })
          pollPullStatus()
        }
      } catch { /* 무시 */ }
    })()
    return () => { cancelled = true }
  }, [pollPullStatus])

  const handleCancelPull = useCallback(async () => {
    setCancelling(true)
    try {
      await api("/admin/settings/ai/local-pull/cancel", { method: "POST" })
      // 이후 상태 정리는 pollPullStatus 가 !inProgress 를 감지하며 처리
    } catch (e: any) {
      toast.error(`다운로드 취소 실패: ${e.message}`)
    } finally {
      setCancelling(false)
    }
  }, [])

  const handleUseModel = useCallback(async (name: string) => {
    setSwitching(name)
    try {
      await api("/admin/settings/ai", { method: "PUT", body: JSON.stringify({ model: name }) })
      toast.success(`사용 모델이 ${name}(으)로 변경되었습니다.`)
      await refresh()
    } catch (e: any) {
      toast.error(`모델 전환 실패: ${e.message}`)
    } finally {
      setSwitching(null)
    }
  }, [refresh])

  const handleDeleteModel = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api("/admin/settings/ai/local-models", {
        method: "DELETE",
        body: JSON.stringify({ model: deleteTarget.name }),
      })
      toast.success(`모델 ${deleteTarget.name}이(가) 삭제되었습니다.`)
      setDeleteTarget(null)
      await refresh()
    } catch (e: any) {
      toast.error(`모델 삭제 실패: ${e.message}`)
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, refresh])

  useEffect(() => { refresh() }, [refresh])

  // Ollama 태그 규칙: 태그 없는 이름은 ":latest"로 해석
  const normalize = (name: string) => (name.includes(":") ? name : `${name}:latest`)

  const badge = (ok: boolean, okText: string, failText: string) => (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-0.5 ${ok ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800" : "bg-red-950/60 text-red-300 border border-red-800"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />
      {ok ? okText : failText}
    </span>
  )

  return (
    <Card className="bg-slate-900 border-slate-800 max-w-2xl">
      <CardHeader>
        <CardTitle className="text-white text-base flex items-center justify-between">
          <span className="flex items-center gap-2"><Cpu className="h-4 w-4 text-primary" /> 로컬 AI(Ollama) 설치 상태</span>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="border-slate-700 text-slate-300">
            {loading ? "확인 중..." : "새로고침"}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!status ? (
          <div className="text-slate-400 text-sm">상태 확인 중...</div>
        ) : (
          !status.isLocal ? (
            <div className="text-xs rounded-md border border-slate-700 bg-slate-950 text-slate-400 px-3 py-2 space-y-1">
              <p>현재 로컬 AI(Ollama)가 설정되어 있지 않습니다{status.baseUrl ? <> — 설정된 Base URL: <code className="text-slate-300">{status.baseUrl}</code></> : ""}.</p>
              <p>로컬 AI를 사용하려면 서버에서 <code className="text-slate-200">bash install.sh --ollama</code>로 설치한 뒤, 아래 AI 공급자 설정에서 Base URL을 <code className="text-slate-200">http://localhost:11434/v1</code>로 지정하세요.</p>
            </div>
          ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {badge(status.serverUp, "서버 응답 정상", "서버 응답 없음")}
              {status.serverUp && badge(status.modelInstalled, `모델 설치됨 (${status.configuredModel})`, status.configuredModel ? `모델 없음 (${status.configuredModel})` : "설정된 모델 없음")}
            </div>
            {status.baseUrl && (
              <p className="text-xs text-slate-500">확인 대상: <code className="text-slate-400">{status.baseUrl}</code></p>
            )}
            {disk && disk.totalBytes > 0 && (() => {
              const lowSpace = disk.freeBytes < 10 * 1024 * 1024 * 1024 || disk.usedPercent >= 90
              return (
                <div className={`text-xs rounded-md border px-3 py-2 space-y-1.5 ${lowSpace ? "border-red-800 bg-red-950/50" : "border-slate-800 bg-slate-950"}`}>
                  <div className="flex items-center justify-between">
                    <span className={lowSpace ? "text-red-300 font-medium" : "text-slate-300"}>
                      서버 디스크 여유 공간: {formatGB(disk.freeBytes) || "0GB"}
                    </span>
                    <span className="text-slate-500">
                      {formatGB(disk.usedBytes) || "0GB"} / {formatGB(disk.totalBytes)} 사용 ({disk.usedPercent}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${lowSpace ? "bg-red-400" : "bg-emerald-400"}`}
                      style={{ width: `${Math.min(100, disk.usedPercent)}%` }}
                    />
                  </div>
                  {lowSpace && (
                    <p className="text-[11px] text-red-300">
                      여유 공간이 부족합니다. 사용하지 않는 모델을 삭제하거나 임시 파일을 정리하세요.
                    </p>
                  )}
                </div>
              )
            })()}
            {!status.serverUp && (
              <div className="text-xs rounded-md border border-red-800 bg-red-950/50 text-red-300 px-3 py-2 space-y-1">
                <p>Ollama 서버에 연결할 수 없습니다{status.error ? ` — ${status.error}` : ""}.</p>
                <p>터미널에서 아래 명령으로 로컬 AI를 (재)설치하세요:</p>
                <code className="block bg-slate-950 rounded px-2 py-1 text-slate-200">bash install.sh --ollama</code>
              </div>
            )}
            {status.serverUp && !status.modelInstalled && (
              <div className="text-xs rounded-md border border-amber-800 bg-amber-950/50 text-amber-300 px-3 py-2 space-y-2">
                {status.models.length === 0 ? (
                  <p>서버는 실행 중이지만 다운로드된 모델이 없습니다.</p>
                ) : (
                  <p>설정된 모델 <code className="text-amber-200">{status.configuredModel || "(없음)"}</code>이(가) 설치 목록에 없습니다.</p>
                )}
                {status.configuredModel ? (
                  <>
                    <p>아래 버튼으로 설정된 모델(<code className="text-amber-200">{status.configuredModel}</code>)을 바로 내려받을 수 있습니다.</p>
                    {modelSize?.sizeBytes != null && (
                      <p className="text-[11px] text-amber-200/90">
                        예상 다운로드 크기: <span className="font-medium">{formatGB(modelSize.sizeBytes) || "1GB 미만"}</span>
                        {disk && disk.totalBytes > 0 && <> · 현재 여유 공간: {formatGB(disk.freeBytes) || "0GB"}</>}
                      </p>
                    )}
                    {(() => {
                      // 여유 공간 부족 경고: 예상 크기+마진 대비, 조회 실패 시 10GB 폴백 기준
                      if (!disk || disk.totalBytes <= 0) return null
                      const required = modelSize?.requiredBytes ?? 10 * 1024 * 1024 * 1024
                      if (disk.freeBytes >= required) return null
                      return (
                        <p className="text-[11px] text-red-300 font-medium">
                          ⚠ 여유 공간이 부족합니다 (필요: 약 {formatGB(required)}, 여유: {formatGB(disk.freeBytes) || "0GB"}).
                          사용하지 않는 모델을 삭제하거나 임시 파일을 정리한 뒤 시도하세요.
                        </p>
                      )
                    })()}
                    {pulling && pullProgress && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-amber-200">
                          <span>{pullProgress.status}</span>
                          <span>
                            {pullProgress.percent !== null
                              ? `${pullProgress.percent}% (${formatGB(pullProgress.completedBytes) || "0GB"} / ${formatGB(pullProgress.totalBytes)})`
                              : ""}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full bg-amber-400 transition-all ${pullProgress.percent === null ? "w-1/3 animate-pulse" : ""}`}
                            style={pullProgress.percent !== null ? { width: `${pullProgress.percent}%` } : undefined}
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <Button size="sm" onClick={handlePull} disabled={pulling}>
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        {pulling ? "내려받는 중..." : "모델 내려받기"}
                      </Button>
                      {pulling && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-slate-700 text-slate-300"
                          disabled={cancelling}
                          onClick={handleCancelPull}
                        >
                          <X className="h-3.5 w-3.5 mr-1.5" />
                          {cancelling ? "취소 중..." : "취소"}
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <p>AI 공급자 설정에서 모델명을 먼저 지정한 뒤 내려받을 수 있습니다.</p>
                )}
              </div>
            )}
            {status.isLocal && (
              <div className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-950 px-2.5 py-1.5">
                <p className="text-[11px] text-slate-500">
                  취소된 다운로드가 남긴 불완전 임시 파일을 정리해 디스크 공간을 확보합니다.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[11px] border-slate-700 text-slate-300 shrink-0"
                  disabled={cleaning || pulling}
                  onClick={handleCleanup}
                >
                  {cleaning ? "정리 중..." : "임시 파일 정리"}
                </Button>
              </div>
            )}
            {status.serverUp && status.models.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">다운로드된 모델 ({status.models.length}개)</Label>
                <ul className="text-xs text-slate-300 space-y-1">
                  {status.models.map((m) => {
                    const inUse = !!status.configuredModel && normalize(m.name) === normalize(status.configuredModel)
                    return (
                      <li key={m.name} className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-950 px-2.5 py-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <code className="truncate">{m.name}</code>
                          <span className="text-slate-500 shrink-0">{formatGB(m.sizeBytes)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {inUse ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-300">
                              <Check className="h-3.5 w-3.5" /> 사용 중
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[11px] border-slate-700 text-slate-300"
                              disabled={switching !== null}
                              onClick={() => handleUseModel(m.name)}
                            >
                              {switching === m.name ? "전환 중..." : "이 모델 사용"}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 w-6 p-0 border-slate-700 text-slate-400 hover:text-red-300 hover:border-red-800"
                            disabled={pulling || deleting}
                            onClick={() => setDeleteTarget({ name: m.name, sizeBytes: m.sizeBytes })}
                            title="모델 삭제"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </>
          )
        )}
        <Dialog open={deleteTarget !== null} onOpenChange={(v) => { if (!v && !deleting) setDeleteTarget(null) }}>
          <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-400" /> 모델 삭제
              </DialogTitle>
            </DialogHeader>
            <div className="text-sm text-slate-300 space-y-2 py-1">
              <p>
                모델 <code className="text-white bg-slate-800 rounded px-1.5 py-0.5">{deleteTarget?.name}</code>
                {deleteTarget && deleteTarget.sizeBytes > 0 ? ` (${formatGB(deleteTarget.sizeBytes)})` : ""}
                을(를) 서버에서 삭제할까요?
              </p>
              <p className="text-xs text-slate-500">
                모델이 차지하던 디스크 공간이 확보됩니다. 다시 사용하려면 모델을 새로 내려받아야 합니다.
              </p>
              {deleteTarget && status?.configuredModel && normalize(deleteTarget.name) === normalize(status.configuredModel) && (
                <p className="text-xs text-amber-300 rounded border border-amber-800 bg-amber-950/50 px-2 py-1.5">
                  현재 사용 중으로 설정된 모델입니다. 삭제하면 심사 기능이 동작하지 않으니, 삭제 후 다른 모델을 지정하거나 다시 내려받으세요.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting} className="text-slate-400 hover:text-white">
                취소
              </Button>
              <Button variant="destructive" onClick={handleDeleteModel} disabled={deleting}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                {deleting ? "삭제 중..." : "삭제"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

function AISettingsTab() {
  const [loaded, setLoaded] = useState(false)
  const [apiKeyMasked, setApiKeyMasked] = useState("")
  const [hasApiKey, setHasApiKey] = useState(false)
  const [apiKey, setApiKey] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [model, setModel] = useState("")
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [health, setHealth] = useState<{ ok: boolean; code: string; error?: string } | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  // 입력 중인 모델의 예상 다운로드 크기 미리보기 (디바운스 조회)
  const [sizePreview, setSizePreview] = useState<{
    model: string
    sizeBytes: number | null
    requiredBytes: number | null
    freeBytes: number | null
    registryStatus: "found" | "not_found" | "unknown"
  } | null>(null)
  const [sizeLoading, setSizeLoading] = useState(false)

  useEffect(() => {
    const m = model.trim()
    if (!m) { setSizePreview(null); setSizeLoading(false); return }
    setSizeLoading(true)
    let stale = false
    const timer = setTimeout(async () => {
      try {
        const [size, disk] = await Promise.all([
          api(`/admin/settings/ai/model-size?model=${encodeURIComponent(m)}`),
          api("/admin/settings/ai/disk-usage").catch(() => null),
        ])
        if (stale) return
        setSizePreview({
          model: String(size.model ?? m),
          sizeBytes: size.sizeBytes ?? null,
          requiredBytes: size.requiredBytes ?? null,
          freeBytes: disk ? Number(disk.freeBytes ?? 0) : null,
          registryStatus:
            size.registryStatus === "found" || size.registryStatus === "not_found"
              ? size.registryStatus
              : "unknown",
        })
      } catch {
        if (!stale) setSizePreview(null)
      } finally {
        if (!stale) setSizeLoading(false)
      }
    }, 600)
    return () => { stale = true; clearTimeout(timer) }
  }, [model])

  const loadHealth = useCallback(async () => {
    setHealthLoading(true)
    try {
      setHealth(await api("/admin/settings/ai/health"))
    } catch {
      setHealth({ ok: false, code: "unreachable", error: "상태 확인 요청에 실패했습니다." })
    } finally {
      setHealthLoading(false)
    }
  }, [])

  useEffect(() => { loadHealth() }, [loadHealth])

  const load = useCallback(async () => {
    try {
      const d = await api("/admin/settings/ai")
      setApiKeyMasked(d.apiKeyMasked)
      setHasApiKey(d.hasApiKey)
      setBaseUrl(d.baseUrl)
      setModel(d.model)
      setLoaded(true)
    } catch (e: any) { toast.error(e.message) }
  }, [])

  useEffect(() => { load() }, [load])

  // 서버가 "레지스트리에 없는 모델" (409 model_not_found)로 거부했을 때 확인 다이얼로그 표시용
  const [forceConfirm, setForceConfirm] = useState<string | null>(null)

  const handleSave = async (force = false) => {
    setSaving(true)
    setTestResult(null)
    try {
      await api("/admin/settings/ai", {
        method: "PUT",
        body: JSON.stringify({
          ...(apiKey ? { apiKey } : {}),
          baseUrl,
          model,
          ...(force ? { force: true } : {}),
        }),
      })
      setForceConfirm(null)
      toast.success("AI 설정이 저장되었습니다.")
      setApiKey("")
      load()
      loadHealth()
    } catch (e: any) {
      if (e.code === "model_not_found") {
        setForceConfirm(e.message)
      } else {
        toast.error(e.message)
      }
    }
    finally { setSaving(false) }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const d = await api("/admin/settings/ai/test", { method: "POST" })
      setTestResult({ ok: true, text: `연결 성공 — 모델 ${d.model}, 응답 ${d.latencyMs}ms, 답변: "${(d.reply || "").slice(0, 50)}"` })
    } catch (e: any) {
      setTestResult({ ok: false, text: `연결 실패: ${e.message}` })
    } finally {
      setTesting(false)
      loadHealth()
    }
  }

  if (!loaded) return <div className="text-slate-400 text-sm">불러오는 중...</div>

  return (
    <Card className="bg-slate-900 border-slate-800 max-w-2xl">
      <CardHeader>
        <CardTitle className="text-white text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" /> AI 공급자 설정
          </span>
          <span className="flex items-center gap-2">
            {healthLoading && !health ? (
              <span className="text-xs text-slate-500">상태 확인 중...</span>
            ) : health && (
              <span
                title={health.error ?? ""}
                className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-0.5 border ${
                  health.ok
                    ? "bg-emerald-950/60 text-emerald-300 border-emerald-800"
                    : health.code === "no_key" || health.code === "auth_error"
                      ? "bg-amber-950/60 text-amber-300 border-amber-800"
                      : "bg-red-950/60 text-red-300 border-red-800"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${
                  health.ok ? "bg-emerald-400"
                    : health.code === "no_key" || health.code === "auth_error" ? "bg-amber-400"
                    : "bg-red-400"
                }`} />
                {health.ok ? "연결 정상"
                  : health.code === "no_key" ? "키 미설정"
                  : health.code === "auth_error" ? "키 오류"
                  : "연결 실패"}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] text-slate-400 hover:text-white"
              onClick={loadHealth}
              disabled={healthLoading}
            >
              <RefreshCw className={`h-3 w-3 ${healthLoading ? "animate-spin" : ""}`} />
            </Button>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {health && !health.ok && health.error && (
          <div className="text-xs rounded-md border border-red-800 bg-red-950/50 text-red-300 px-3 py-2">
            {health.error}
          </div>
        )}
        <p className="text-xs text-slate-400 leading-relaxed">
          OpenAI 또는 OpenAI 호환 로컬 LLM 서버(Ollama, LM Studio 등)를 사용할 수 있습니다.
          로컬 LLM 사용 시 Base URL을 <code className="text-slate-300">http://localhost:11434/v1</code> 형식으로,
          API 키는 아무 값(예: <code className="text-slate-300">ollama</code>)으로 설정하세요.
        </p>
        <div className="space-y-2">
          <Label className="text-slate-300">API 키</Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={hasApiKey ? `현재: ${apiKeyMasked} (변경 시에만 입력)` : "sk-... 또는 ollama"}
            className="bg-slate-950 border-slate-700 text-white"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">Base URL</Label>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1 또는 http://localhost:11434/v1"
            className="bg-slate-950 border-slate-700 text-white"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">모델명</Label>
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-5.6-luna 또는 qwen2.5:14b"
            className="bg-slate-950 border-slate-700 text-white"
          />
          {model.trim() && (
            sizeLoading ? (
              <p className="text-[11px] text-slate-500">예상 다운로드 크기 확인 중...</p>
            ) : sizePreview && sizePreview.sizeBytes !== null ? (() => {
              const insufficient =
                sizePreview.freeBytes !== null &&
                sizePreview.requiredBytes !== null &&
                sizePreview.freeBytes < sizePreview.requiredBytes
              return (
                <div className={`text-[11px] rounded-md border px-2.5 py-1.5 space-y-0.5 ${insufficient ? "border-red-800 bg-red-950/50 text-red-300" : "border-slate-800 bg-slate-950 text-slate-400"}`}>
                  <p>
                    예상 다운로드 크기: <span className={insufficient ? "font-medium" : "text-slate-300"}>{formatGB(sizePreview.sizeBytes)}</span>
                    {sizePreview.requiredBytes !== null && <> (여유 공간 포함 약 {formatGB(sizePreview.requiredBytes)} 필요)</>}
                    {sizePreview.freeBytes !== null && <> · 서버 여유 공간: {formatGB(sizePreview.freeBytes) || "0GB"}</>}
                  </p>
                  {insufficient && (
                    <p className="font-medium">서버 디스크 공간이 부족합니다. 저장 전에 공간을 확보하거나 더 작은 모델을 선택하세요.</p>
                  )}
                </div>
              )
            })() : sizePreview?.registryStatus === "not_found" ? (
              <div className="text-[11px] rounded-md border border-red-800 bg-red-950/50 text-red-300 px-2.5 py-1.5 flex items-start gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-px" />
                <p>
                  <span className="font-medium">레지스트리에 없는 모델입니다.</span>{" "}
                  모델명에 오타가 없는지 확인하세요 (예: <code className="text-red-200">qwen2.5:14b</code>).
                </p>
              </div>
            ) : sizePreview ? (
              <p className="text-[11px] text-slate-500">
                이 모델의 예상 크기를 확인할 수 없습니다 (Ollama 공식 레지스트리 모델만 조회 가능).
              </p>
            ) : null
          )}
        </div>
        {testResult && (
          <div className={`text-xs rounded-md border px-3 py-2 ${testResult.ok ? "border-emerald-800 bg-emerald-950/50 text-emerald-300" : "border-red-800 bg-red-950/50 text-red-300"}`}>
            {testResult.text}
          </div>
        )}
        <div className="flex gap-2">
          <Button onClick={() => handleSave()} disabled={saving}>
            {saving ? "저장 중..." : "저장"}
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={testing} className="border-slate-700 text-slate-300">
            {testing ? "테스트 중..." : "연결 테스트"}
          </Button>
        </div>
      </CardContent>
      <Dialog open={forceConfirm !== null} onOpenChange={(v) => !v && setForceConfirm(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400" /> 레지스트리에 없는 모델
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-300 space-y-2 py-1">
            <p>{forceConfirm}</p>
            <p className="text-xs text-slate-400">
              잘못된 모델명을 저장하면 AI 분석이 동작하지 않을 수 있습니다. 그래도 저장하시겠습니까?
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForceConfirm(null)} className="text-slate-400 hover:text-white">
              취소
            </Button>
            <Button variant="destructive" onClick={() => handleSave(true)} disabled={saving}>
              {saving ? "저장 중..." : "그래도 저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

type AIHealthBannerStatus = {
  checked: boolean
  ok?: boolean
  code?: string
  error?: string
  checkedAt?: string
  downSince?: string | null
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })
}

function AIHealthBanner({ status }: { status: AIHealthBannerStatus | null }) {
  if (!status || !status.checked || status.ok) return null
  return (
    <div className="rounded-lg border border-red-800 bg-red-950/60 px-4 py-3 flex items-start gap-3">
      <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
      <div className="text-sm space-y-0.5 min-w-0">
        <p className="font-semibold text-red-300">AI 서버 장애가 감지되었습니다 — 심사 요청이 실패할 수 있습니다.</p>
        {status.error && <p className="text-red-300/80 text-xs break-words">{status.error}</p>}
        <p className="text-red-400/70 text-xs">
          {status.downSince && <>장애 시작: {fmtTime(status.downSince)} · </>}
          마지막 점검: {status.checkedAt ? fmtTime(status.checkedAt) : "-"} (5분마다 자동 점검)
        </p>
      </div>
    </div>
  )
}

export default function AdminPage() {
  const [, navigate] = useLocation()
  const [checking, setChecking] = useState(true)
  const [tab, setTab] = useState<Tab>("overview")
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(false)
  const [orgDialog, setOrgDialog] = useState<{ open: boolean; org: Organization | null }>({ open: false, org: null })
  const [aiHealth, setAiHealth] = useState<AIHealthBannerStatus | null>(null)

  // AI 서버 헬스 상태 — 진입 시 조회 + 1분마다 갱신
  useEffect(() => {
    if (checking) return
    let cancelled = false
    const load = async () => {
      try {
        const d = await api("/admin/settings/ai/health-status")
        if (!cancelled) setAiHealth(d)
      } catch { /* 무시 — 다음 주기에 재시도 */ }
    }
    load()
    const timer = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [checking])

  // Check admin session
  useEffect(() => {
    api("/admin/me")
      .then((d) => {
        if (!d.isAdmin) navigate("/admin/login")
        else setChecking(false)
      })
      .catch(() => navigate("/admin/login"))
  }, [navigate])

  const loadStats = useCallback(async () => {
    try { setStats(await api("/admin/stats")) } catch (e: any) { toast.error(e.message) }
  }, [])
  const loadUsers = useCallback(async () => {
    try { setUsers(await api("/admin/users")) } catch (e: any) { toast.error(e.message) }
  }, [])
  const loadOrgs = useCallback(async () => {
    try { setOrgs(await api("/admin/organizations")) } catch (e: any) { toast.error(e.message) }
  }, [])

  useEffect(() => {
    if (checking) return
    setLoading(true)
    Promise.all([loadStats(), loadUsers(), loadOrgs()]).finally(() => setLoading(false))
  }, [checking, loadStats, loadUsers, loadOrgs])

  const handleLogout = async () => {
    await api("/admin/logout", { method: "POST" }).catch(() => {})
    navigate("/admin/login")
  }

  const handleDeleteOrg = async (id: number) => {
    if (!confirm("협회를 삭제하시겠습니까?")) return
    try {
      await api(`/admin/organizations/${id}`, { method: "DELETE" })
      toast.success("삭제되었습니다.")
      loadOrgs()
    } catch (e: any) { toast.error(e.message) }
  }

  if (checking) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-slate-400 text-sm">인증 확인 중...</div>
    </div>
  )

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: "대시보드" },
    { key: "organizations", label: "협회 관리" },
    { key: "users", label: "사용자 관리" },
    { key: "ai", label: "AI 설정" },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-white text-sm">관리자 포털</span>
            <span className="hidden sm:inline text-slate-600">·</span>
            <span className="hidden sm:inline text-slate-400 text-xs">AI 서류 심사관</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white"
              onClick={() => {
                setLoading(true)
                Promise.all([loadStats(), loadUsers(), loadOrgs()]).finally(() => setLoading(false))
              }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-400" onClick={handleLogout}>
              <LogOut className="h-3.5 w-3.5 mr-1.5" />
              로그아웃
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* AI 장애 경고 배너 — 모든 탭 상단에 표시 */}
        <AIHealthBanner status={aiHealth} />

        {/* Tab Nav */}
        <div className="flex gap-1 bg-slate-900 p-1 rounded-lg w-fit border border-slate-800">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-primary text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ── */}
        {tab === "overview" && stats && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={Users}
                label="전체 사용자"
                value={fmt(stats.totalUsers)}
                sub={`이번 달 분석 ${fmt(stats.monthAnalyses)}건`}
              />
              <StatCard
                icon={TrendingUp}
                label="월 구독 수익"
                value={fmtKrw(stats.monthlyRevenue)}
                sub={`유료 ${fmt((stats.usersByPlan.basic ?? 0) + (stats.usersByPlan.premium ?? 0))}명`}
              />
              <StatCard
                icon={Cpu}
                label="총 토큰 사용량"
                value={`${(stats.totalTokens / 1_000).toFixed(1)}K`}
                sub={`누적 비용 ${fmtKrw(stats.totalCostKrw)}`}
              />
              <StatCard
                icon={Building2}
                label="등록 협회"
                value={fmt(stats.totalOrganizations)}
                sub="협회·기관 수"
              />
            </div>

            {/* Plan breakdown + Token detail */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Plan breakdown */}
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-slate-300 font-medium">플랜별 사용자 현황</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {["free", "basic", "premium"].map((plan) => {
                    const cnt = stats.usersByPlan[plan] ?? 0
                    const pct = stats.totalUsers > 0 ? (cnt / stats.totalUsers) * 100 : 0
                    return (
                      <div key={plan}>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-slate-400">{PLAN_LABELS[plan]}</span>
                          <span className="text-xs font-medium text-white">{fmt(cnt)}명 ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-800">
                          <div
                            className="h-1.5 rounded-full bg-primary"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>

              {/* Token detail */}
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-slate-300 font-medium">토큰 사용 & 비용</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {[
                    { label: "입력 토큰 (누계)", value: `${(stats.totalInputTokens / 1_000).toFixed(1)}K` },
                    { label: "출력 토큰 (누계)", value: `${(stats.totalOutputTokens / 1_000).toFixed(1)}K` },
                    { label: "이번 달 토큰", value: `${(stats.monthTokens / 1_000).toFixed(1)}K` },
                    { label: "이번 달 추정 비용", value: fmtKrw(stats.monthCostKrw) },
                    { label: "누적 추정 비용", value: fmtKrw(stats.totalCostKrw) },
                    { label: "총 분석 건수", value: `${fmt(stats.totalAnalyses)}건` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-0">
                      <span className="text-xs text-slate-400">{label}</span>
                      <span className="text-sm font-semibold text-white">{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ── Organizations Tab ── */}
        {tab === "organizations" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">협회 등록 관리</h2>
                <p className="text-xs text-slate-500 mt-0.5">총 {orgs.length}개 협회·기관</p>
              </div>
              <Button size="sm" onClick={() => setOrgDialog({ open: true, org: null })}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                협회 등록
              </Button>
            </div>

            <Card className="bg-slate-900 border-slate-800">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400 text-xs">협회명</TableHead>
                      <TableHead className="text-slate-400 text-xs">담당자</TableHead>
                      <TableHead className="text-slate-400 text-xs">연락처</TableHead>
                      <TableHead className="text-slate-400 text-xs text-right">회원 수</TableHead>
                      <TableHead className="text-slate-400 text-xs">상태</TableHead>
                      <TableHead className="text-slate-400 text-xs">등록일</TableHead>
                      <TableHead className="text-slate-400 text-xs text-right">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orgs.length === 0 && (
                      <TableRow className="border-slate-800">
                        <TableCell colSpan={7} className="text-center text-slate-500 py-10 text-sm">
                          등록된 협회가 없습니다
                        </TableCell>
                      </TableRow>
                    )}
                    {orgs.map((org) => (
                      <TableRow key={org.id} className="border-slate-800 hover:bg-slate-800/40">
                        <TableCell className="font-medium text-white text-sm">
                          <div>{org.name}</div>
                          {org.description && (
                            <div className="text-xs text-slate-500 truncate max-w-[200px]">{org.description}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-300 text-sm">{org.contactPerson ?? "—"}</TableCell>
                        <TableCell className="text-slate-300 text-sm">
                          <div>{org.contactEmail ?? "—"}</div>
                          {org.contactPhone && <div className="text-xs text-slate-500">{org.contactPhone}</div>}
                        </TableCell>
                        <TableCell className="text-right text-slate-300 text-sm">{fmt(org.memberCount)}</TableCell>
                        <TableCell>
                          <Badge
                            className={`text-xs ${
                              org.status === "active"
                                ? "bg-emerald-900/40 text-emerald-400 border-emerald-800"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                            }`}
                            variant="outline"
                          >
                            {org.status === "active" ? "활성" : "비활성"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-400 text-xs">
                          {new Date(org.registeredAt).toLocaleDateString("ko-KR")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-white"
                              onClick={() => setOrgDialog({ open: true, org })}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-400 hover:text-red-400"
                              onClick={() => handleDeleteOrg(org.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        )}

        {/* ── Users Tab ── */}
        {tab === "users" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-white">사용자 관리</h2>
              <p className="text-xs text-slate-500 mt-0.5">총 {users.length}명 등록</p>
            </div>

            <Card className="bg-slate-900 border-slate-800">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400 text-xs">이름 / 이메일</TableHead>
                      <TableHead className="text-slate-400 text-xs">구독 플랜</TableHead>
                      <TableHead className="text-slate-400 text-xs text-right">이번 달 분석</TableHead>
                      <TableHead className="text-slate-400 text-xs">가입일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.length === 0 && (
                      <TableRow className="border-slate-800">
                        <TableCell colSpan={4} className="text-center text-slate-500 py-10 text-sm">
                          사용자가 없습니다
                        </TableCell>
                      </TableRow>
                    )}
                    {users.map((u) => (
                      <TableRow key={u.id} className="border-slate-800 hover:bg-slate-800/40">
                        <TableCell>
                          <div className="font-medium text-white text-sm">{u.name}</div>
                          <div className="text-xs text-slate-400">{u.email}</div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`text-xs ${PLAN_COLORS[u.subscriptionStatus] ?? "bg-slate-100 text-slate-700"}`}
                          >
                            {PLAN_LABELS[u.subscriptionStatus] ?? u.subscriptionStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-slate-300 text-sm">
                          {u.analysesUsedThisMonth}건
                        </TableCell>
                        <TableCell className="text-slate-400 text-xs">
                          {new Date(u.createdAt).toLocaleDateString("ko-KR")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        )}
        {/* ── AI Settings Tab ── */}
        {tab === "ai" && (
          <div className="space-y-6">
            <LocalLLMStatusCard />
            <AISettingsTab />
          </div>
        )}
      </div>

      <OrgDialog
        open={orgDialog.open}
        onClose={() => setOrgDialog({ open: false, org: null })}
        initial={orgDialog.org}
        onSave={() => { loadOrgs(); loadStats() }}
      />
    </div>
  )
}
