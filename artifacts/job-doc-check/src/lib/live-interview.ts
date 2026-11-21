// 실시간(음성) 면접 화면에서 쓰는 순수 함수와 브라우저 음성 출력(TTS) 도우미.

export interface LiveQuestion {
  id: number
  question: string
  order: number
  answer?: string | null
  parentQuestionId?: number | null
  depth?: number
}

/**
 * 다음에 물어볼 질문. 기본 질문을 순서대로 보되, 답한 기본 질문 아래에
 * 아직 답하지 않은 꼬리 질문이 있으면 그것을 먼저 묻는다. 모두 답했으면 null.
 */
export function nextLiveQuestion<T extends LiveQuestion>(questions: T[]): T | null {
  const bases = questions.filter(q => q.parentQuestionId == null).sort((a, b) => a.order - b.order)
  for (const base of bases) {
    let current: T | undefined = base
    const seen = new Set<number>()
    while (current && !seen.has(current.id)) {
      if (current.answer == null) return current
      seen.add(current.id)
      const parentId: number = current.id
      current = questions.find(q => q.parentQuestionId === parentId)
    }
  }
  return null
}

/** 진행률 표시용: 답한 기본 질문 수 / 전체 기본 질문 수 */
export function liveProgress(questions: LiveQuestion[]): { answered: number; total: number } {
  const bases = questions.filter(q => q.parentQuestionId == null)
  return { answered: bases.filter(q => q.answer != null).length, total: bases.length }
}

/** 소리 내어 읽기 좋게 문장 단위로 나눈다. (Chrome은 긴 문장을 읽다가 멈추는 경우가 있다) */
export function splitForSpeech(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.?!。？！])\s+/)
    .map(s => s.trim())
    .filter(Boolean)
}

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined"
}

function koreanVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  return voices.find(v => v.lang === "ko-KR") ?? voices.find(v => v.lang.toLowerCase().startsWith("ko")) ?? null
}

/** 브라우저에 한국어 음성이 있는지. 음성 목록은 늦게 채워지므로 잠깐 기다린다. */
export async function hasKoreanVoice(timeoutMs = 1500): Promise<boolean> {
  if (!speechSupported()) return false
  if (window.speechSynthesis.getVoices().length > 0) return koreanVoice() != null
  await new Promise<void>(resolve => {
    const timer = window.setTimeout(resolve, timeoutMs)
    window.speechSynthesis.addEventListener("voiceschanged", () => { window.clearTimeout(timer); resolve() }, { once: true })
  })
  return koreanVoice() != null
}

/**
 * 질문을 한국어로 읽는다. 다 읽거나 cancelSpeech()로 멈추면 끝난다.
 * onend가 오지 않는 브라우저 버그에 대비해 길이에 맞춘 시간이 지나면 끝난 것으로 본다.
 */
export function speak(text: string, rate = 1): Promise<void> {
  if (!speechSupported()) return Promise.resolve()
  const synth = window.speechSynthesis
  synth.cancel()
  const voice = koreanVoice()
  const parts = splitForSpeech(text)
  return new Promise<void>(resolve => {
    let index = 0
    let done = false
    const finish = () => {
      if (done) return
      done = true
      window.clearTimeout(guard)
      resolve()
    }
    const guard = window.setTimeout(finish, 4000 + text.length * 250 / rate)
    const speakNext = () => {
      if (done) return
      if (index >= parts.length) { finish(); return }
      const utterance = new SpeechSynthesisUtterance(parts[index++])
      utterance.lang = "ko-KR"
      utterance.rate = rate
      if (voice) utterance.voice = voice
      utterance.onend = speakNext
      utterance.onerror = finish
      synth.speak(utterance)
    }
    speakNext()
  })
}

export function cancelSpeech() {
  if (speechSupported()) window.speechSynthesis.cancel()
}
