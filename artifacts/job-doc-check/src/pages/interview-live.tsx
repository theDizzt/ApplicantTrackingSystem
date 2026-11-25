import { useEffect, useRef, useState } from "react"
import { Link, useLocation, useParams } from "wouter"
import { useQueryClient } from "@tanstack/react-query"
import {
  getGetInterviewQueryKey,
  useAnswerLiveQuestion,
  useFinishLiveInterview,
  useGetInterview,
  type InterviewQuestion,
} from "@workspace/api-client-react"
import { AlertCircle, Bot, Camera, CameraOff, ChevronLeft, CornerDownRight, Loader2, Mic, RotateCcw, Square, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { LiveWaveform } from "@/components/audio/live-waveform"
import { cancelSpeech, hasKoreanVoice, liveProgress, nextLiveQuestion, speak } from "@/lib/live-interview"
import { difficultyLabel } from "@/lib/interview-labels"
import type { CameraMetrics } from "@/lib/camera-analysis"
import { useCameraAnalysis, type CameraHint } from "@/lib/use-camera-analysis"
import { cameraLabel } from "@/lib/camera-devices"

/** 한 답변의 최대 녹음 시간 (넘으면 자동으로 답변 완료) */
const MAX_ANSWER_SECONDS = 3 * 60

type Phase = "intro" | "asking" | "recording" | "processing" | "error" | "finishing"

const getSupportedMimeType = () => {
  for (const type of ["audio/webm", "audio/mp4", "audio/ogg"]) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type
  }
  return ""
}

const CAMERA_HINT: Record<Exclude<CameraHint, null>, { text: string; className: string }> = {
  ok: { text: "카메라를 잘 보고 있어요", className: "bg-emerald-600/80" },
  "look-camera": { text: "카메라 렌즈를 봐 주세요", className: "bg-amber-600/80" },
  "no-face": { text: "얼굴이 보이지 않아요", className: "bg-red-600/80" },
}

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`

function errorReason(err: unknown, fallback: string): string {
  const reason = (err as { data?: { error?: unknown } } | null)?.data?.error
  return typeof reason === "string" && reason ? reason : fallback
}

/** 답한 질문들을 실제로 오간 순서(기본 질문 → 그 꼬리 질문들)로 */
function conversation(questions: InterviewQuestion[]): InterviewQuestion[] {
  const out: InterviewQuestion[] = []
  for (const base of questions.filter(q => q.parentQuestionId == null).sort((a, b) => a.order - b.order)) {
    let current: InterviewQuestion | undefined = base
    while (current && current.answer != null && !out.includes(current)) {
      out.push(current)
      const parentId: number = current.id
      current = questions.find(q => q.parentQuestionId === parentId)
    }
  }
  return out
}

export default function InterviewLivePage() {
  const params = useParams()
  const interviewId = parseInt(params.id!, 10)
  const [, setLocation] = useLocation()
  const queryClient = useQueryClient()
  const { data: interview, isLoading } = useGetInterview(interviewId, {
    query: { queryKey: getGetInterviewQueryKey(interviewId), enabled: !!interviewId },
  })
  const answerLive = useAnswerLiveQuestion()
  const finishLive = useFinishLiveInterview()

  const [phase, setPhase] = useState<Phase>("intro")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [errorDuring, setErrorDuring] = useState<"answer" | "finish">("answer")
  const [voiceOn, setVoiceOn] = useState(true)
  const [voiceAvailable, setVoiceAvailable] = useState<boolean | null>(null)
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [askingId, setAskingId] = useState<number | null>(null)
  const [cameraOn, setCameraOn] = useState(false)
  const camera = useCameraAnalysis()

  const mountedRef = useRef(true)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const discardRef = useRef(false)
  const askTokenRef = useRef(0)
  const questionIdRef = useRef<number | null>(null)
  const voiceRef = useRef(true)
  voiceRef.current = voiceOn && voiceAvailable === true

  useEffect(() => {
    mountedRef.current = true
    void hasKoreanVoice().then(ok => { if (mountedRef.current) setVoiceAvailable(ok) })
    return () => {
      mountedRef.current = false
      askTokenRef.current += 1
      cancelSpeech()
      if (timerRef.current) window.clearInterval(timerRef.current)
      discardRef.current = true
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop()
      streamRef.current?.getTracks().forEach(track => track.stop())
    }
  }, [])

  // 글로 답하는 면접이거나 이미 끝난 면접이면 결과 화면으로
  useEffect(() => {
    if (interview && (interview.mode !== "live" || interview.status === "evaluated")) {
      setLocation(`/interviews/${interviewId}`)
    }
  }, [interview, interviewId, setLocation])

  const questions = interview?.questions ?? []
  const current = askingId != null ? questions.find(q => q.id === askingId) ?? null : nextLiveQuestion(questions)
  const progress = liveProgress(questions)
  const answered = conversation(questions)

  const stopTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = null
  }

  const releaseMic = () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    setLiveStream(null)
  }

  const finish = () => {
    askTokenRef.current += 1
    cancelSpeech()
    setPhase("finishing")
    finishLive.mutate({ id: interviewId }, {
      onSuccess: (data) => {
        releaseMic()
        camera.disable()
        queryClient.setQueryData(getGetInterviewQueryKey(interviewId), data)
        setLocation(`/interviews/${interviewId}`)
      },
      onError: (err) => {
        if (!mountedRef.current) return
        setErrorDuring("finish")
        setErrorMessage(errorReason(err, "종합 평가를 만들지 못했습니다. 다시 시도해주세요."))
        setPhase("error")
      },
    })
  }

  const upload = (blob: Blob, questionId: number, cameraMetrics: CameraMetrics | null) => {
    const type = blob.type || "audio/webm"
    const ext = type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : "webm"
    const file = new File([blob], `answer.${ext}`, { type })
    // 영상은 보내지 않고 자세·시선 숫자 요약만 함께 보낸다
    const data = cameraMetrics ? { audio: file, camera: JSON.stringify(cameraMetrics) } : { audio: file }
    answerLive.mutate({ id: interviewId, questionId, data }, {
      onSuccess: (data) => {
        if (!mountedRef.current) return
        queryClient.setQueryData(getGetInterviewQueryKey(interviewId), data.session)
        const next = nextLiveQuestion(data.session.questions ?? [])
        if (next) void ask(next)
        else finish()
      },
      onError: (err) => {
        if (!mountedRef.current) return
        setErrorDuring("answer")
        setErrorMessage(errorReason(err, "답변을 처리하지 못했습니다. 다시 답해주세요."))
        setPhase("error")
      },
    })
  }

  const startRecording = () => {
    const stream = streamRef.current
    const questionId = questionIdRef.current
    if (!stream || questionId == null) return
    const mimeType = getSupportedMimeType()
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    recorderRef.current = recorder
    chunksRef.current = []
    discardRef.current = false
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      recorderRef.current = null
      stopTimer()
      const cameraMetrics = camera.endAnswer()
      if (discardRef.current || !mountedRef.current) return
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" })
      upload(blob, questionId, cameraMetrics)
    }
    recorder.onerror = () => {
      stopTimer()
      discardRef.current = true
      setErrorDuring("answer")
      setErrorMessage("녹음 장치 오류가 발생했습니다. 마이크 연결을 확인한 후 다시 답해주세요.")
      setPhase("error")
    }
    recorder.start()
    camera.beginAnswer()
    setSeconds(0)
    setPhase("recording")
    timerRef.current = window.setInterval(() => {
      setSeconds(prev => {
        if (prev + 1 >= MAX_ANSWER_SECONDS && recorder.state !== "inactive") {
          recorder.stop()
          setPhase("processing")
        }
        return prev + 1
      })
    }, 1000)
  }

  const stopRecording = () => {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === "inactive") return
    setPhase("processing")
    recorder.stop()
  }

  async function ask(question: InterviewQuestion) {
    const token = ++askTokenRef.current
    questionIdRef.current = question.id
    setAskingId(question.id)
    setErrorMessage(null)
    setPhase("asking")
    if (voiceRef.current) await speak(question.question)
    if (token !== askTokenRef.current || !mountedRef.current) return
    startRecording()
  }

  const begin = async () => {
    const first = nextLiveQuestion(questions)
    if (!first) {
      finish()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mountedRef.current) {
        stream.getTracks().forEach(track => track.stop())
        return
      }
      streamRef.current = stream
      setLiveStream(stream)
      // 카메라는 선택 사항: 켜지 못해도 음성 면접은 그대로 진행한다
      if (cameraOn) await camera.enable()
      if (!mountedRef.current) return
      stream.getAudioTracks().forEach(track => {
        track.onended = () => {
          if (!mountedRef.current) return
          discardRef.current = true
          if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop()
          streamRef.current = null
          setLiveStream(null)
          setErrorDuring("answer")
          setErrorMessage("마이크 연결이 끊겼습니다. 마이크를 다시 연결한 뒤 다시 답해주세요.")
          setPhase("error")
        }
      })
      void ask(first)
    } catch {
      setErrorDuring("answer")
      setErrorMessage("마이크를 사용할 수 없습니다. 브라우저 주소창의 마이크 권한을 허용한 뒤 다시 시작해주세요.")
      setPhase("error")
    }
  }

  const retryAnswer = async () => {
    if (!streamRef.current) {
      await begin()
      return
    }
    if (current) void ask(current)
  }

  const endInterview = () => {
    if (!window.confirm("면접을 여기서 끝내고 종합 평가를 받을까요? 답하지 않은 질문은 '답하지 않음'으로 평가됩니다.")) return
    discardRef.current = true
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop()
    stopTimer()
    finish()
  }

  if (isLoading || !interview) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  const isFollowUp = (current?.depth ?? 0) > 0
  const busy = phase === "processing" || phase === "finishing"
  const resuming = progress.answered > 0
  // 지금 몇 번째 기본 질문을 다루는지 (꼬리 질문은 이미 답한 기본 질문에 속한다)
  const position = phase === "intro" || !current
    ? progress.answered
    : Math.min(current.parentQuestionId == null ? progress.answered + 1 : progress.answered, progress.total)

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link
          href="/interviews"
          className="inline-flex items-center justify-center w-10 h-10 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="면접 목록으로"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">실시간 AI 면접</h1>
          <p className="text-muted-foreground mt-1 truncate">{interview.companyName} • {interview.resumeTitle} • 난이도 {difficultyLabel(interview.difficulty)}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs text-muted-foreground">진행</div>
          <div className="text-lg font-bold font-mono">{position}/{progress.total}</div>
        </div>
      </div>

      {camera.stream && phase !== "intro" && (
        <div className="flex flex-col items-end gap-1.5">
          <div className="relative w-40 md:w-48 aspect-[4/3] rounded-lg overflow-hidden border bg-black">
            {/* 거울처럼 좌우를 뒤집어 보여 준다 */}
            <video ref={camera.attachVideo} muted playsInline autoPlay className="w-full h-full object-cover -scale-x-100" aria-label="내 카메라 화면" />
            {camera.status === "loading" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-xs gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />분석 준비 중
              </div>
            )}
            {/* 검은 화면이면 얼굴 안내보다 이것을 먼저 보여 준다 (캡처 보드·가상 카메라가 잡힌 경우) */}
            {camera.dark ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-3 text-center text-white" aria-live="polite">
                <CameraOff className="w-4 h-4" />
                <p className="text-[11px] leading-snug">카메라 화면이 검게 나와요.{camera.devices.length > 1 ? " 아래에서 다른 카메라를 골라 주세요." : " 렌즈 덮개나 다른 앱 사용 여부를 확인해 주세요."}</p>
              </div>
            ) : camera.hint && (
              <div className={`absolute bottom-0 inset-x-0 px-2 py-1 text-[11px] text-white text-center ${CAMERA_HINT[camera.hint].className}`} aria-live="polite">
                {CAMERA_HINT[camera.hint].text}
              </div>
            )}
          </div>
          {camera.devices.length > 1 && (
            <label className="flex w-40 md:w-48 items-center gap-1.5 text-[11px] text-muted-foreground">
              <Camera className="w-3.5 h-3.5 shrink-0" />
              <span className="sr-only">사용할 카메라</span>
              <select
                value={camera.deviceId ?? ""}
                onChange={(e) => void camera.selectDevice(e.target.value)}
                className="min-w-0 flex-1 truncate rounded border bg-background px-1.5 py-1 text-[11px] text-foreground"
                aria-label="사용할 카메라"
              >
                {camera.devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>{cameraLabel(d, i)}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      {camera.error && phase !== "intro" && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><CameraOff className="w-3.5 h-3.5" />{camera.error}</p>
      )}

      <Card className="overflow-hidden">
        <CardContent className="p-6 md:p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className={`shrink-0 w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center ${phase === "asking" ? "ring-4 ring-primary/30 animate-pulse" : ""}`}>
              <Bot className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-primary mb-1">
                {phase === "intro" ? "AI 면접관" : isFollowUp ? `꼬리 질문 ${current?.depth}` : "면접관 질문"}
              </div>
              {phase === "intro" ? (
                <p className="text-base leading-relaxed text-muted-foreground">
                  {resuming
                    ? "이어서 진행할 준비가 되면 시작을 눌러 주세요. 답하지 않은 질문부터 이어서 묻습니다."
                    : "면접관이 질문을 소리 내어 읽으면, 말로 답한 뒤 '답변 완료'를 눌러 주세요. 답변에 따라 꼬리 질문이 이어집니다."}
                </p>
              ) : (
                <p className="text-lg md:text-xl font-semibold leading-relaxed">{current?.question}</p>
              )}
            </div>
          </div>

          {phase === "intro" && (
            <div className="space-y-4">
              <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-5">
                <li>마이크 권한이 필요합니다. 조용한 곳에서 진행해 주세요.</li>
                <li>한 답변은 최대 {MAX_ANSWER_SECONDS / 60}분까지 녹음되고, 시간이 지나면 자동으로 제출됩니다.</li>
                <li>점수와 피드백은 면접이 끝난 뒤 한꺼번에 보여 드립니다.</li>
              </ul>
              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div className="flex items-center gap-2 text-sm">
                  {voiceOn && voiceAvailable !== false ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  <span>질문 소리 내어 읽기</span>
                  {voiceAvailable === false && (
                    <span className="text-xs text-muted-foreground">(이 브라우저에 한국어 음성이 없어 글로만 보여 드립니다)</span>
                  )}
                </div>
                <Switch checked={voiceOn && voiceAvailable !== false} disabled={voiceAvailable === false} onCheckedChange={setVoiceOn} aria-label="질문 소리 내어 읽기" />
              </div>
              <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
                <div className="flex items-start gap-2 text-sm">
                  {cameraOn ? <Camera className="w-4 h-4 mt-0.5 shrink-0" /> : <CameraOff className="w-4 h-4 mt-0.5 shrink-0" />}
                  <div>
                    <div>카메라로 자세·시선 분석 <span className="text-xs text-muted-foreground">(선택)</span></div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      영상은 이 기기에서만 분석하고 서버로 보내거나 저장하지 않습니다. 처음 켤 때 얼굴 분석 기능(약 15MB)을 내려받습니다.
                    </p>
                  </div>
                </div>
                <Switch checked={cameraOn} onCheckedChange={setCameraOn} aria-label="카메라로 자세·시선 분석" />
              </div>
              <Button size="lg" className="w-full" onClick={() => void begin()}>
                <Mic className="w-5 h-5 mr-2" />{resuming ? "이어서 시작" : "면접 시작"}
              </Button>
            </div>
          )}

          {phase === "asking" && (
            <div className="flex flex-col items-center gap-3 py-2">
              <p className="text-sm text-muted-foreground">{voiceRef.current ? "면접관이 질문하고 있습니다…" : "질문을 읽고 답변을 준비하세요."}</p>
              <Button variant="outline" onClick={() => cancelSpeech()}>
                <Mic className="w-4 h-4 mr-2" />바로 답하기
              </Button>
            </div>
          )}

          {phase === "recording" && (
            <div className="flex flex-col items-center gap-4">
              <LiveWaveform stream={liveStream} height={56} className="w-full max-w-md" />
              <div className="font-mono text-sm text-muted-foreground" aria-live="polite">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-2 animate-pulse" />
                {formatTime(seconds)} / {formatTime(MAX_ANSWER_SECONDS)}
              </div>
              <Button size="lg" onClick={stopRecording} className="min-w-48">
                <Square className="w-4 h-4 mr-2" />답변 완료
              </Button>
            </div>
          )}

          {busy && (
            <div className="flex flex-col items-center gap-3 py-4 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm">{phase === "finishing" ? "면접 전체를 돌아보며 종합 평가를 만들고 있습니다…" : "답변을 듣고 다음 질문을 준비하고 있습니다…"}</p>
            </div>
          )}

          {phase === "error" && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {errorDuring === "finish" ? (
                  <Button onClick={finish}><RotateCcw className="w-4 h-4 mr-2" />종합 평가 다시 받기</Button>
                ) : (
                  <Button onClick={() => void retryAnswer()}><RotateCcw className="w-4 h-4 mr-2" />다시 답하기</Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {answered.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">지금까지의 대화</CardTitle>
            <p className="text-xs text-muted-foreground">음성을 받아 적은 내용입니다. 인식이 조금 틀려도 평가에는 내용 위주로 반영됩니다.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {answered.map(q => (
              <div key={q.id} className="space-y-1.5" style={{ paddingLeft: `${(q.depth ?? 0) * 16}px` }}>
                <p className="text-sm font-medium flex gap-1.5">
                  {(q.depth ?? 0) > 0 ? <CornerDownRight className="w-4 h-4 mt-0.5 shrink-0 text-primary" /> : <Bot className="w-4 h-4 mt-0.5 shrink-0 text-primary" />}
                  {q.question}
                </p>
                <p className="text-sm text-muted-foreground bg-slate-50 dark:bg-slate-900 rounded-md p-3 whitespace-pre-wrap">{q.answer}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {progress.answered > 0 && phase !== "finishing" && (
        <div className="flex justify-end">
          <Button variant="ghost" onClick={endInterview} disabled={busy}>면접 끝내고 평가 받기</Button>
        </div>
      )}
    </div>
  )
}
