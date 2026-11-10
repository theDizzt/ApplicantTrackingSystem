import { useState, useEffect, useCallback } from "react"
import { useLocation } from "wouter"
import {
  Users, Building2, Cpu, TrendingUp, LogOut, Plus, Pencil, Trash2,
  Shield, RefreshCw, ChevronDown, AlertCircle, BellRing
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

interface AlertDeliveryStatus {
  configured: boolean
  windowMs: number
  total: number
  succeeded: number
  failureRate: number
  successRate: number | null
  consecutiveFailures: number
  lastOutcome?: "success" | "permanent_failure" | "retries_exhausted"
  lastDeliveryAt?: string
}

const PLAN_LABELS: Record<string, string> = { free: "Free", basic: "베이직", premium: "프리미엄" }
const PLAN_COLORS: Record<string, string> = {
  free: "bg-slate-100 text-slate-700",
  basic: "bg-green-100 text-green-700",
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

type RoleModels = {
  modelInterview: string
  modelLight: string
  modelVision: string
  embeddingModel: string
}

const EMPTY_ROLE_MODELS: RoleModels = { modelInterview: "", modelLight: "", modelVision: "", embeddingModel: "" }

const ROLE_MODEL_FIELDS: { key: keyof RoleModels; label: string; help: string; placeholder?: string }[] = [
  { key: "modelInterview", label: "면접 모델", help: "면접 질문 생성, 답변 평가, 꼬리 질문에 사용합니다." },
  { key: "modelLight", label: "경량 작업 모델", help: "맞춤법 검토, 이력서 파일 구조화, 기업 추천·매칭, 음성 녹음용 질문 생성에 사용합니다. 빠르고 저렴한 모델을 권장합니다." },
  { key: "modelVision", label: "이미지 인식(OCR) 모델", help: "스캔 PDF·이미지 공고의 글자 인식에 사용합니다. 이미지 입력을 지원하는 모델이어야 합니다." },
  {
    key: "embeddingModel",
    label: "임베딩 모델 (직무 문장 유사도)",
    placeholder: "비우면 OpenAI 서버에서만 text-embedding-3-small 사용",
    help: "공고와 자기소개서의 문장 유사도 계산에 사용합니다. 유사도 기준(60점)은 OpenAI 임베딩 기준이라, 다른 임베딩 모델은 점수 분포가 달라 '유사도 낮음'이 과하게 나올 수 있습니다.",
  },
]

export function AISettingsTab() {
  const [loaded, setLoaded] = useState(false)
  const [apiKeyMasked, setApiKeyMasked] = useState("")
  const [hasApiKey, setHasApiKey] = useState(false)
  const [apiKey, setApiKey] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [model, setModel] = useState("")
  const [sttModel, setSttModel] = useState("")
  // 보조 심사 모델 (선택)
  const [apiKey2Masked, setApiKey2Masked] = useState("")
  const [hasApiKey2, setHasApiKey2] = useState(false)
  const [apiKey2, setApiKey2] = useState("")
  const [baseUrl2, setBaseUrl2] = useState("")
  const [model2, setModel2] = useState("")
  const [apiKey3Masked, setApiKey3Masked] = useState("")
  const [hasApiKey3, setHasApiKey3] = useState(false)
  const [apiKey3, setApiKey3] = useState("")
  const [baseUrl3, setBaseUrl3] = useState("")
  const [model3, setModel3] = useState("")
  const [showSecondary, setShowSecondary] = useState(false)
  const [roleModels, setRoleModels] = useState<RoleModels>(EMPTY_ROLE_MODELS)
  const [showRoles, setShowRoles] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [health, setHealth] = useState<{ ok: boolean; code: string; error?: string } | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [alertStatus, setAlertStatus] = useState<AlertDeliveryStatus | null>(null)
  const [alertStatusLoading, setAlertStatusLoading] = useState(true)

  const loadAlertStatus = useCallback(async () => {
    setAlertStatusLoading(true)
    try {
      setAlertStatus(await api("/admin/settings/alerts/delivery-status"))
    } catch {
      setAlertStatus(null)
    } finally {
      setAlertStatusLoading(false)
    }
  }, [])

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
  useEffect(() => { loadAlertStatus() }, [loadAlertStatus])

  const load = useCallback(async () => {
    try {
      const d = await api("/admin/settings/ai")
      setApiKeyMasked(d.apiKeyMasked)
      setHasApiKey(d.hasApiKey)
      setBaseUrl(d.baseUrl)
      setModel(d.model)
      setSttModel(d.sttModel ?? "gpt-4o-mini-transcribe")
      setApiKey2Masked(d.apiKey2Masked ?? "")
      setHasApiKey2(!!d.hasApiKey2)
      setBaseUrl2(d.baseUrl2 ?? "")
      setModel2(d.model2 ?? "")
      setApiKey3Masked(d.apiKey3Masked ?? "")
      setHasApiKey3(!!d.hasApiKey3)
      setBaseUrl3(d.baseUrl3 ?? "")
      setModel3(d.model3 ?? "")
      if (d.model2 || d.model3) setShowSecondary(true)
      const nextRoles: RoleModels = {
        modelInterview: d.modelInterview ?? "",
        modelLight: d.modelLight ?? "",
        modelVision: d.modelVision ?? "",
        embeddingModel: d.embeddingModel ?? "",
      }
      setRoleModels(nextRoles)
      if (Object.values(nextRoles).some(Boolean)) setShowRoles(true)
      setLoaded(true)
    } catch (e: any) { toast.error(e.message) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    setSaving(true)
    setTestResult(null)
    try {
      await api("/admin/settings/ai", {
        method: "PUT",
        body: JSON.stringify({
          ...(apiKey ? { apiKey } : {}),
          baseUrl,
          model,
          sttModel,
          ...(apiKey2 ? { apiKey2 } : {}),
          baseUrl2,
          model2,
          ...(apiKey3 ? { apiKey3 } : {}),
          baseUrl3,
          model3,
          ...roleModels,
        }),
      })
      toast.success("AI 설정이 저장되었습니다.")
      setApiKey("")
      setApiKey2("")
      setApiKey3("")
      load()
      loadHealth()
    } catch (e: any) {
      toast.error(e.message)
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
    <div className="max-w-2xl space-y-4">
    <Card className="bg-slate-900 border-slate-800">
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
          OpenAI 또는 OpenAI 호환 API 서버를 사용할 수 있습니다.
          API 키와 Base URL, 모델명을 입력한 뒤 저장하세요.
        </p>
        <div className="space-y-2">
          <Label className="text-slate-300">API 키</Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={hasApiKey ? `현재: ${apiKeyMasked} (변경 시에만 입력)` : "sk-..."}
            className="bg-slate-950 border-slate-700 text-white"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">Base URL</Label>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
            className="bg-slate-950 border-slate-700 text-white"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">모델명</Label>
          <Input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-5.6-luna"
            className="bg-slate-950 border-slate-700 text-white"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-slate-300">음성인식 모델 (STT)</Label>
          <Input
            value={sttModel}
            onChange={(e) => setSttModel(e.target.value)}
            placeholder="gpt-4o-mini-transcribe"
            className="bg-slate-950 border-slate-700 text-white"
            data-testid="input-stt-model"
          />
          <p className="text-xs text-slate-500 leading-relaxed">
            음성 자기소개서의 녹음·오디오 파일을 텍스트로 변환할 때 사용하는 모델입니다.
          </p>
        </div>
        {/* ── 보조 심사 모델 (선택) ── */}
        <div className="border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={() => setShowSecondary((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-white"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${showSecondary ? "rotate-180" : ""}`} />
            보조 심사 모델 (선택)
          </button>
          {showSecondary && (
            <div className="mt-3 space-y-5">
              <p className="text-xs text-slate-400 leading-relaxed">
                보조 모델을 등록하면 심사 시 3개 모델의 의견이 함께 표시됩니다 (심사 시간·비용 증가).
                모델명을 비우면 해당 보조 모델은 사용되지 않습니다.
              </p>
              {/* 보조 모델 2 */}
              <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                <p className="text-xs font-semibold text-slate-300">보조 모델 2</p>
                <div className="space-y-2">
                  <Label className="text-slate-400 text-xs">API 키</Label>
                  <Input
                    type="password"
                    value={apiKey2}
                    onChange={(e) => setApiKey2(e.target.value)}
                    placeholder={hasApiKey2 ? `현재: ${apiKey2Masked} (변경 시에만 입력)` : "sk-..."}
                    className="bg-slate-950 border-slate-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-400 text-xs">Base URL</Label>
                  <Input
                    value={baseUrl2}
                    onChange={(e) => setBaseUrl2(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="bg-slate-950 border-slate-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-400 text-xs">모델명</Label>
                  <Input
                    value={model2}
                    onChange={(e) => setModel2(e.target.value)}
                    placeholder="gpt-5.6-luna"
                    className="bg-slate-950 border-slate-700 text-white"
                  />
                </div>
              </div>
              {/* 보조 모델 3 */}
              <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                <p className="text-xs font-semibold text-slate-300">보조 모델 3</p>
                <div className="space-y-2">
                  <Label className="text-slate-400 text-xs">API 키</Label>
                  <Input
                    type="password"
                    value={apiKey3}
                    onChange={(e) => setApiKey3(e.target.value)}
                    placeholder={hasApiKey3 ? `현재: ${apiKey3Masked} (변경 시에만 입력)` : "sk-..."}
                    className="bg-slate-950 border-slate-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-400 text-xs">Base URL</Label>
                  <Input
                    value={baseUrl3}
                    onChange={(e) => setBaseUrl3(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="bg-slate-950 border-slate-700 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-400 text-xs">모델명</Label>
                  <Input
                    value={model3}
                    onChange={(e) => setModel3(e.target.value)}
                    placeholder="gpt-5.6-luna"
                    className="bg-slate-950 border-slate-700 text-white"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        {/* ── 역할별 모델 (선택) ── */}
        <div className="border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={() => setShowRoles((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-white"
            data-testid="button-toggle-role-models"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${showRoles ? "rotate-180" : ""}`} />
            역할별 모델 (선택)
          </button>
          {showRoles && (
            <div className="mt-3 space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                작업마다 다른 모델을 쓸 수 있습니다. 위의 API 키·Base URL을 함께 사용하며,
                비워 둔 역할은 기본 모델명({model || "미설정"})을 사용합니다.
                서류 심사·불합격 원인 리포트·커리어 분석·자기소개서 작성은 기본 모델을 씁니다.
              </p>
              {ROLE_MODEL_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="text-slate-300 text-xs">{f.label}</Label>
                  <Input
                    value={roleModels[f.key]}
                    onChange={(e) => setRoleModels((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder || `비우면 기본 모델(${model || "미설정"}) 사용`}
                    className="bg-slate-950 border-slate-700 text-white"
                    data-testid={`input-${f.key}`}
                  />
                  <p className="text-xs text-slate-500 leading-relaxed">{f.help}</p>
                </div>
              ))}
            </div>
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
    </Card>
    <Card className="bg-slate-900 border-slate-800" data-testid="card-alert-delivery-status">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <BellRing className="h-4 w-4 text-primary" /> 알림 채널 상태
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-slate-400 hover:text-white"
            onClick={loadAlertStatus}
            disabled={alertStatusLoading}
            data-testid="button-refresh-alert-status"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${alertStatusLoading ? "animate-spin" : ""}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alertStatusLoading && !alertStatus ? (
          <p className="text-sm text-slate-400" data-testid="status-alert-loading">불러오는 중...</p>
        ) : !alertStatus ? (
          <p className="text-sm text-red-300" data-testid="status-alert-error">알림 채널 상태를 불러오지 못했습니다.</p>
        ) : !alertStatus.configured ? (
          <div data-testid="status-alert-unconfigured">
            <p className="text-sm font-medium text-amber-300">웹훅 미설정</p>
            <p className="text-xs text-slate-500 mt-1">알림을 전달할 채널이 아직 설정되지 않았습니다.</p>
          </div>
        ) : alertStatus.total === 0 ? (
          <div data-testid="status-alert-no-history">
            <p className="text-sm font-medium text-slate-300">전달 이력 없음</p>
            <p className="text-xs text-slate-500 mt-1">채널은 설정되어 있으며, 최근 집계 구간에 전달 시도가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
              <p className="text-xs text-slate-500">최근 전달</p>
              <p className="text-sm font-semibold text-white mt-1" data-testid="text-alert-last-delivery">
                {alertStatus.lastDeliveryAt ? fmtTime(alertStatus.lastDeliveryAt) : "—"}
              </p>
              <p className={`text-xs mt-1 ${alertStatus.lastOutcome === "success" ? "text-emerald-400" : "text-red-400"}`}>
                {alertStatus.lastOutcome === "success" ? "성공" : "실패"}
              </p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
              <p className="text-xs text-slate-500">최근 성공률</p>
              <p className="text-lg font-bold text-white mt-1" data-testid="text-alert-success-rate">
                {((alertStatus.successRate ?? 0) * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-slate-500 mt-1">{alertStatus.succeeded}/{alertStatus.total}건</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
              <p className="text-xs text-slate-500">연속 실패</p>
              <p className={`text-lg font-bold mt-1 ${alertStatus.consecutiveFailures ? "text-red-300" : "text-emerald-300"}`} data-testid="text-alert-consecutive-failures">
                {alertStatus.consecutiveFailures}건
              </p>
              <p className="text-xs text-slate-500 mt-1">실패율 {(alertStatus.failureRate * 100).toFixed(0)}%</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    </div>
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
