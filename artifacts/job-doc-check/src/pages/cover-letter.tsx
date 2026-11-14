import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mic, Square, UploadCloud, Copy, RefreshCw, AlertCircle, CheckCircle2, Loader2, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  getGetResumeQueryKey,
  getListResumesQueryKey,
  useGenerateCoverLetter,
  useGenerateGuidedPrompts,
  useListResumes,
  useUpdateResume,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { trackEvent } from '@/lib/analytics';
import { LiveWaveform } from '@/components/audio/live-waveform';
import { AudioPlayer } from '@/components/audio/audio-player';

const getSupportedMimeType = () => {
  const types = ['audio/webm', 'audio/mp4', 'audio/ogg'];
  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
};

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};
const MAX_RECORDING_SECONDS = 10 * 60;

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function coverLetterToHtml(value: string) {
  const html: string[] = [];
  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${paragraph.map(escapeHtml).join('<br>')}</p>`);
    paragraph = [];
  };

  for (const line of value.split(/\r?\n/)) {
    const text = line.trim();
    if (text.startsWith('## ')) {
      flushParagraph();
      html.push(`<h2>${escapeHtml(text.slice(3))}</h2>`);
    } else if (!text) {
      flushParagraph();
    } else {
      paragraph.push(text);
    }
  }
  flushParagraph();
  return html.join('');
}

export default function CoverLetterPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { data: resumes, isLoading: resumesLoading } = useListResumes();
  const updateResume = useUpdateResume();
  const generateCoverLetterMutation = useGenerateCoverLetter();
  const generateGuidedPrompts = useGenerateGuidedPrompts();
  
  const [recording, setRecording] = useState(false);
  const [acquiringMic, setAcquiringMic] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioFile, setAudioFile] = useState<{ blob: Blob | File; url: string; name: string; downloadName?: string } | null>(null);
  // 녹음 중인 마이크 스트림 (실시간 파형 표시용)
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const [audioSource, setAudioSource] = useState<'recording' | 'file' | null>(null);
  
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [transcript, setTranscript] = useState('');
  const [coverLetter, setCoverLetter] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedResumeId, setSelectedResumeId] = useState('');

  const [guidedResumeId, setGuidedResumeId] = useState('');
  const [guidedPrompts, setGuidedPrompts] = useState<string[]>([]);
  const [usedFallbackPrompts, setUsedFallbackPrompts] = useState(false);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    const url = audioFile?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [audioFile?.url]);

  useEffect(() => {
    if (resumes?.length && !resumes.some(resume => String(resume.id) === selectedResumeId)) {
      setSelectedResumeId(String(resumes[0].id));
    }
  }, [resumes, selectedResumeId]);

  useEffect(() => {
    if (resumes?.length && !resumes.some(resume => String(resume.id) === guidedResumeId)) {
      setGuidedResumeId(String(resumes[0].id));
    }
  }, [resumes, guidedResumeId]);

  const fetchGuidedPrompts = async () => {
    if (!guidedResumeId) return;
    setSelectedResumeId(guidedResumeId);
    setErrorMessage('');
    
    try {
      const result = await generateGuidedPrompts.mutateAsync({
        data: { resumeId: Number(guidedResumeId) },
      });
      setGuidedPrompts(result.prompts);
      setUsedFallbackPrompts(result.usedFallback);
      setCurrentPromptIndex(0);
    } catch (err: unknown) {
      toast({
        title: "가이드 질문 생성 실패",
        description: err instanceof Error ? err.message : "질문을 불러오는데 실패했습니다.",
        variant: "destructive"
      });
    }
  };

  const startRecording = async () => {
    if (acquiringMic || recording) return;
    setAcquiringMic(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      setLiveStream(stream);
      
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        const ext = type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : 'webm';
        const name = `recording.${ext}`;
        const url = URL.createObjectURL(blob);
        const stamp = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const downloadName = `음성자소서_녹음_${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}.${ext}`;
        
        setAudioFile({ blob, url, name, downloadName });
        setLiveStream(null);
        setAudioSource('recording');
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
        mediaRecorderRef.current = null;
      };
      recorder.onerror = () => {
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        setLiveStream(null);
        mediaRecorderRef.current = null;
        setRecording(false);
        setStatus('error');
        setErrorMessage('녹음 장치 오류가 발생했습니다. 마이크 연결을 확인한 후 다시 시도해주세요.');
        trackEvent('voice_recording_failed', {
          reason: 'recorder_error',
        });
      };
      stream.getAudioTracks().forEach(track => {
        track.onended = () => {
          if (recorder.state !== 'inactive') recorder.stop();
          if (timerRef.current) window.clearInterval(timerRef.current);
          timerRef.current = null;
          setRecording(false);
          setLiveStream(null);
        };
      });
      
      recorder.start();
      trackEvent('voice_recording_started');
      setRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => {
          if (prev + 1 >= MAX_RECORDING_SECONDS) {
            if (recorder.state !== 'inactive') recorder.stop();
            if (timerRef.current) window.clearInterval(timerRef.current);
            timerRef.current = null;
            setRecording(false);
            return MAX_RECORDING_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
      
    } catch (err: unknown) {
      const reason = err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'permission_denied'
        : err instanceof DOMException && err.name === 'NotFoundError'
          ? 'device_not_found'
          : 'microphone_unavailable';
      trackEvent('voice_recording_failed', { reason });
      if (mountedRef.current) {
        toast({
          title: "마이크 접근 오류",
          description: "마이크 권한을 허용해주세요.",
          variant: "destructive"
        });
      }
    } finally {
      if (mountedRef.current) setAcquiringMic(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "파일 크기 초과",
        description: "50MB 이하의 오디오 파일만 업로드 가능합니다.",
        variant: "destructive"
      });
      return;
    }
    
    if (audioFile?.url) {
      URL.revokeObjectURL(audioFile.url);
    }
    
    const url = URL.createObjectURL(file);
    setAudioFile({ blob: file, url, name: file.name });
    setAudioSource('file');
    trackEvent('voice_file_selected');
  };

  const resetAll = () => {
    if (audioFile?.url) {
      URL.revokeObjectURL(audioFile.url);
    }
    setAudioFile(null);
    setAudioSource(null);
    setTranscript('');
    setCoverLetter('');
    setStatus('idle');
    setErrorMessage('');
    setRecordingTime(0);
    setCurrentPromptIndex(0);
  };

  const generateCoverLetter = async () => {
    if (!audioFile) return;
    
    setStatus('processing');
    setErrorMessage('');
    
    try {
      const audio = audioFile.blob instanceof File
        ? audioFile.blob
        : new File([audioFile.blob], audioFile.name, { type: audioFile.blob.type });
      const result = await generateCoverLetterMutation.mutateAsync({
        data: { audio },
      });

      setTranscript(result.transcript);
      setCoverLetter(result.coverLetter);
      setStatus('success');
      trackEvent('cover_letter_generated', {
        source: audioSource ?? 'unknown',
      });
      
    } catch (err: unknown) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : "자기소개서 생성 중 오류가 발생했습니다.");
      trackEvent('cover_letter_generation_failed', {
        source: audioSource ?? 'unknown',
      });
    }
  };

  const copyToClipboard = async () => {
    if (!coverLetter) return;
    try {
      await navigator.clipboard.writeText(coverLetter);
      toast({
        title: "복사 완료",
        description: "자기소개서가 클립보드에 복사되었습니다.",
      });
    } catch (err) {
      toast({
        title: "복사 실패",
        description: "클립보드 복사에 실패했습니다.",
        variant: "destructive"
      });
    }
  };

  const applyToResume = () => {
    const resumeId = Number(selectedResumeId);
    if (!resumeId || !coverLetter) return;

    updateResume.mutate(
      { id: resumeId, data: { coverLetter: coverLetterToHtml(coverLetter) } },
      {
        onSuccess: updated => {
          queryClient.setQueryData(getGetResumeQueryKey(resumeId), updated);
          queryClient.invalidateQueries({ queryKey: getListResumesQueryKey() });
          toast({
            title: "이력서 반영 완료",
            description: "생성된 자기소개서가 선택한 이력서에 저장되었습니다.",
          });
          trackEvent('cover_letter_applied_to_resume');
          setLocation(`/resumes/${resumeId}`);
        },
        onError: () => {
          toast({
            title: "이력서 반영 실패",
            description: "자기소개서를 저장하지 못했습니다. 잠시 후 다시 시도해주세요.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">음성 자기소개서 작성</h1>
        <p className="text-muted-foreground mt-1">
          자신의 경험과 강점을 편안하게 이야기해주세요. AI가 전문적인 자기소개서로 완성해 드립니다.
        </p>
      </div>
      
      {status === 'idle' || status === 'error' ? (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>오디오 입력</CardTitle>
            <CardDescription>
              마이크를 사용해 직접 녹음하거나 오디오 파일을 업로드하세요. (최대 50MB)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status === 'error' && (
              <div className="mb-6 p-4 rounded-lg bg-destructive/10 text-destructive flex items-start gap-3 border border-destructive/20" data-testid="error-message">
                <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-sm">오류가 발생했습니다</div>
                  <div className="text-sm mt-1 opacity-90">{errorMessage}</div>
                </div>
              </div>
            )}
            
            {!audioFile ? (
              <Tabs defaultValue="record" className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-lg mx-auto mb-8 bg-slate-100/50">
                  <TabsTrigger value="record" data-testid="tab-record" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">음성 녹음</TabsTrigger>
                  <TabsTrigger value="upload" data-testid="tab-upload" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">파일 업로드</TabsTrigger>
                  <TabsTrigger value="guided" data-testid="tab-guided" className="data-[state=active]:bg-white data-[state=active]:shadow-sm"><span className="sm:hidden">가이드 녹음</span><span className="hidden sm:inline">음성 가이드 녹음</span></TabsTrigger>
                </TabsList>
                
                <TabsContent value="guided" className="flex flex-col border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors p-6 sm:p-8">
                  {guidedPrompts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6 text-primary">
                        <Mic className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">맞춤형 질문으로 시작하기</h3>
                      <p className="text-sm text-slate-500 mb-8 text-center max-w-sm">
                        선택하신 이력서를 바탕으로 대답하기 쉬운 질문을 만들어 드립니다. 질문에 답하면서 자연스럽게 자기소개서를 완성해보세요.
                      </p>
                      
                      <div className="w-full max-w-sm space-y-4">
                        <Select value={guidedResumeId} onValueChange={setGuidedResumeId} disabled={resumesLoading || !resumes?.length}>
                          <SelectTrigger className="bg-white" data-testid="select-guided-resume">
                            <SelectValue placeholder={resumesLoading ? "이력서를 불러오는 중..." : "이력서를 선택하세요"} />
                          </SelectTrigger>
                          <SelectContent>
                            {resumes?.map(resume => (
                              <SelectItem key={resume.id} value={String(resume.id)}>
                                {resume.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <Button 
                          className="w-full shadow-sm" 
                          size="lg" 
                          onClick={fetchGuidedPrompts}
                          disabled={!guidedResumeId || generateGuidedPrompts.isPending || !resumes?.length}
                          data-testid="button-fetch-prompts"
                        >
                          {generateGuidedPrompts.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
                          가이드 질문 생성
                        </Button>
                        {!resumes?.length && !resumesLoading && (
                          <p className="text-xs text-center text-slate-500 mt-2">
                            먼저 이력서를 등록해주세요.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between mb-6">
                        <span className="text-sm font-medium text-slate-500 bg-white px-3 py-1 rounded-full border shadow-sm">
                          질문 {currentPromptIndex + 1} / {guidedPrompts.length}
                        </span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-slate-500 hover:text-slate-700"
                          onClick={() => {
                            setGuidedPrompts([]);
                            setUsedFallbackPrompts(false);
                          }}
                          disabled={recording}
                          data-testid="button-reset-prompts"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          질문 다시 생성
                        </Button>
                      </div>

                      {usedFallbackPrompts && (
                        <div
                          className="mb-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                          data-testid="guided-prompts-fallback-notice"
                          role="status"
                        >
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>맞춤 질문을 만들지 못해 기본 질문으로 안내하고 있습니다. 그대로 녹음을 계속하셔도 됩니다.</span>
                        </div>
                      )}
                      
                      <div className="bg-white p-6 sm:p-8 rounded-xl border shadow-sm mb-8 min-h-[160px] flex items-center justify-center text-center">
                        <p className="text-lg sm:text-xl font-medium text-slate-800 leading-relaxed">
                          {guidedPrompts[currentPromptIndex]}
                        </p>
                      </div>
                      
                      <div className="flex items-center justify-between mb-8">
                        <Button 
                          variant="outline" 
                          onClick={() => setCurrentPromptIndex(p => Math.max(0, p - 1))}
                          disabled={currentPromptIndex === 0}
                          className="bg-white"
                          data-testid="button-prev-prompt"
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" />
                          이전 질문
                        </Button>
                        <div className="flex space-x-1">
                          {guidedPrompts.map((_, idx) => (
                            <div 
                              key={idx} 
                              className={`w-2 h-2 rounded-full transition-colors ${idx === currentPromptIndex ? 'bg-primary' : 'bg-slate-200'}`}
                            />
                          ))}
                        </div>
                        <Button 
                          variant="outline" 
                          onClick={() => setCurrentPromptIndex(p => Math.min(guidedPrompts.length - 1, p + 1))}
                          disabled={currentPromptIndex === guidedPrompts.length - 1}
                          className="bg-white"
                          data-testid="button-next-prompt"
                        >
                          다음 질문
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>

                      <div className="flex flex-col items-center pt-6 border-t border-slate-200/60">
                        <div className="text-4xl font-mono font-light mb-4 text-slate-700 tracking-wider">
                          {formatTime(recordingTime)}
                        </div>
                        {recording && <LiveWaveform stream={liveStream} height={56} className="max-w-md mb-4" />}
                        
                        {!recording ? (
                          <Button 
                            size="lg" 
                            className="rounded-full w-20 h-20 bg-primary hover:bg-primary/90 hover:scale-105 transition-all duration-300 shadow-lg"
                            onClick={startRecording}
                            disabled={acquiringMic}
                            data-testid="button-start-guided-recording"
                          >
                            {acquiringMic ? <Loader2 className="w-8 h-8 animate-spin" /> : <Mic className="w-8 h-8" />}
                          </Button>
                        ) : (
                          <Button 
                            size="lg" 
                            variant="destructive"
                            className="rounded-full w-20 h-20 animate-pulse hover:animate-none hover:scale-105 transition-all duration-300 shadow-lg"
                            onClick={stopRecording}
                            data-testid="button-stop-guided-recording"
                          >
                            <Square className="w-6 h-6 fill-current" />
                          </Button>
                        )}
                        <div className="mt-6 text-sm text-slate-500 font-medium">
                          {!recording ? "마이크 버튼을 눌러 답변 녹음을 시작하세요" : "녹음 중입니다. 질문을 넘기며 계속 답변할 수 있습니다."}
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="record" className="flex flex-col items-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <div className="text-5xl font-mono font-light mb-6 text-slate-700 tracking-wider" data-testid="text-timer">
                    {formatTime(recordingTime)}
                  </div>
                  {recording && <LiveWaveform stream={liveStream} className="max-w-md px-6 mb-4" />}
                  
                  {!recording ? (
                    <Button 
                      size="lg" 
                      className="rounded-full w-24 h-24 bg-primary hover:bg-primary/90 hover:scale-105 transition-all duration-300 shadow-lg"
                      onClick={startRecording}
                      disabled={acquiringMic}
                      data-testid="button-start-recording"
                    >
                      {acquiringMic ? <Loader2 className="w-10 h-10 animate-spin" /> : <Mic className="w-10 h-10" />}
                    </Button>
                  ) : (
                    <Button 
                      size="lg" 
                      variant="destructive"
                      className="rounded-full w-24 h-24 animate-pulse hover:animate-none hover:scale-105 transition-all duration-300 shadow-lg"
                      onClick={stopRecording}
                      data-testid="button-stop-recording"
                    >
                      <Square className="w-8 h-8 fill-current" />
                    </Button>
                  )}
                  
                  <div className="mt-8 text-sm text-slate-500 font-medium">
                    {!recording ? "마이크 버튼을 눌러 녹음을 시작하세요" : "녹음 중입니다. 최대 10분까지 녹음할 수 있습니다."}
                  </div>
                </TabsContent>
                
                <TabsContent value="upload" className="py-16 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 text-primary">
                    <UploadCloud className="w-10 h-10" />
                  </div>
                  <div className="text-base font-semibold text-slate-800 mb-2">오디오 파일을 선택하세요</div>
                  <div className="text-sm text-slate-500 mb-8">지원 형식: mp3, wav, m4a, ogg 등 (최대 50MB)</div>
                  
                  <Button asChild size="lg" className="px-8 shadow-sm font-semibold" data-testid="button-upload-file">
                    <label className="cursor-pointer">
                      파일 찾아보기
                      <input type="file" className="hidden" accept="audio/*" onChange={handleFileUpload} data-testid="input-file" />
                    </label>
                  </Button>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="flex flex-col items-center py-12 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-6 text-success ring-4 ring-success/5">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">오디오가 준비되었습니다</h3>
                <p className="text-sm text-slate-500 mb-8 max-w-md text-center truncate px-4">{audioFile.name}</p>
                
                <div className="w-full max-w-md px-4 mb-10">
                  <AudioPlayer
                    src={audioFile.url}
                    blob={audioFile.blob}
                    downloadName={audioFile.downloadName ?? audioFile.name}
                  />
                </div>
                
                <div className="flex gap-4 w-full max-w-md px-4">
                  <Button 
                    variant="outline" 
                    className="flex-1 font-medium" 
                    onClick={resetAll}
                    data-testid="button-reset-audio"
                  >
                    다시 선택
                  </Button>
                  <Button 
                    className="flex-1 font-medium shadow-sm" 
                    onClick={generateCoverLetter}
                    data-testid="button-generate"
                  >
                    자기소개서 생성
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : status === 'processing' ? (
        <Card className="flex flex-col items-center justify-center py-32 border-slate-200 shadow-sm">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse"></div>
            <Loader2 className="w-16 h-16 text-primary animate-spin relative z-10" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-4 tracking-tight">AI가 자기소개서를 작성하고 있습니다</h3>
          <p className="text-slate-500 text-center max-w-md leading-relaxed text-sm">
            입력하신 음성 내용을 텍스트로 변환하고<br />
            전문적인 문장과 논리적인 3단 구조로 다듬는 중입니다.<br />
            잠시만 기다려주세요.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-slate-200 shadow-sm flex flex-col">
              <CardHeader className="border-b bg-slate-50/50 pb-4">
                <CardTitle className="text-base font-semibold">음성 인식 결과</CardTitle>
                <CardDescription className="text-xs">오디오에서 추출된 원문 텍스트입니다.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div 
                  className="p-5 text-sm text-slate-700 h-[300px] lg:h-[500px] overflow-y-auto whitespace-pre-wrap leading-relaxed"
                  data-testid="text-transcript"
                >
                  {transcript || "인식된 텍스트가 없습니다."}
                </div>
              </CardContent>
              <div className="p-4 border-t bg-slate-50/50 mt-auto">
                <Button 
                  variant="outline" 
                  className="w-full justify-center bg-white" 
                  onClick={resetAll}
                  data-testid="button-start-over"
                >
                  <RefreshCw className="w-4 h-4 mr-2 text-slate-500" />
                  처음부터 다시 작성하기
                </Button>
              </div>
            </Card>
          </div>
          
          <div className="lg:col-span-8">
            <Card className="border-slate-200 shadow-sm flex flex-col h-full">
              <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50 pb-4 py-4">
                <div>
                  <CardTitle className="text-lg font-semibold">완성된 자기소개서</CardTitle>
                  <CardDescription className="text-xs mt-1">이력서에 바로 활용할 수 있는 다듬어진 내용입니다.</CardDescription>
                </div>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={copyToClipboard}
                  data-testid="button-copy"
                  className="shadow-sm font-medium shrink-0 ml-4"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  복사하기
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div 
                  className="p-8 text-slate-800 text-[15px] lg:h-[568px] h-[400px] leading-loose whitespace-pre-wrap overflow-y-auto selection:bg-primary/20"
                  data-testid="text-cover-letter"
                >
                  {coverLetter || "생성된 자기소개서가 없습니다."}
                </div>
              </CardContent>
              <div className="border-t bg-slate-50/50 p-5 space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Select value={selectedResumeId} onValueChange={setSelectedResumeId} disabled={resumesLoading || !resumes?.length}>
                    <SelectTrigger className="flex-1 bg-white" data-testid="select-resume">
                      <SelectValue placeholder={resumesLoading ? "이력서를 불러오는 중..." : "반영할 이력서를 선택하세요"} />
                    </SelectTrigger>
                    <SelectContent>
                      {resumes?.map(resume => (
                        <SelectItem key={resume.id} value={String(resume.id)}>
                          {resume.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={applyToResume}
                    disabled={!selectedResumeId || updateResume.isPending}
                    data-testid="button-apply-to-resume"
                    className="sm:min-w-44"
                  >
                    {updateResume.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    이력서에 반영하기
                  </Button>
                </div>
                <p className="text-xs text-slate-500">
                  {resumes?.length
                    ? "선택한 이력서에 기존 자기소개서가 있으면 새 내용으로 교체됩니다."
                    : "먼저 내 이력서 메뉴에서 이력서를 등록해주세요."}
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
