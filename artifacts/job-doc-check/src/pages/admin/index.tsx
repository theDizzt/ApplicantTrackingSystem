import { useState, useEffect, useCallback } from "react"
import { useLocation } from "wouter"
import {
  Users, Building2, Cpu, TrendingUp, LogOut, Plus, Pencil, Trash2,
  Shield, RefreshCw, ChevronDown, ChevronUp, X, Check, AlertCircle
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
    throw new Error(body.error ?? `HTTP ${res.status}`)
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
    description: "", memberCount: "0", status: "active",
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
        status: initial.status,
      })
    } else {
      setForm({ name: "", contactPerson: "", contactEmail: "", contactPhone: "", description: "", memberCount: "0", status: "active" })
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
      const body = { ...form, memberCount: parseInt(form.memberCount, 10) || 0 }
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

type Tab = "overview" | "users" | "organizations"

export default function AdminPage() {
  const [, navigate] = useLocation()
  const [checking, setChecking] = useState(true)
  const [tab, setTab] = useState<Tab>("overview")
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(false)
  const [orgDialog, setOrgDialog] = useState<{ open: boolean; org: Organization | null }>({ open: false, org: null })

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
