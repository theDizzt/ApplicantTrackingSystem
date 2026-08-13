with open('artifacts/job-doc-check/src/pages/resume-detail.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

start_idx = text.index('  // ── 편집 폼 ──────────────────────────────────────────────────────────────')
end_idx = text.index('      {/* ── PDF 다운로드: 템플릿 선택 + 인쇄 뷰 ────────────────────────── */}')

# Replace the part
new_content = """
  // ── 렌더링 ──────────────────────────────────────────────────────────────
  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* 기본 정보 */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2 text-slate-800">
              <Info className="w-4 h-4 text-blue-600" />
              기본 정보
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 제목 */}
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>제목 / 이름</FormLabel>
                <FormControl>
                  <Input placeholder="예: 프론트엔드 개발자 이력서" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* 희망 연봉 */}
            <FormField control={form.control} name="desiredSalary" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1.5">
                  <Banknote className="w-4 h-4 text-emerald-600" />
                  희망 연봉 (만원)
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type="number" min={0} step={100}
                      placeholder="예: 4500  (미기재 시 비워두세요)"
                      className="pr-14"
                      {...field}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none">
                      만원
                    </span>
                  </div>
                </FormControl>
                <p className="text-xs text-slate-400">AI 서류 심사 시 예상 연봉과 비교·분석됩니다.</p>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        {/* 이력서 내용 */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2 text-slate-800">
              <FileText className="w-4 h-4 text-blue-600" />
              이력서 내용
            </CardTitle>
            <div className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded-md">
              {htmlToText(form.watch("content") || "").length}자
            </div>
          </CardHeader>
          <CardContent>
            <Controller
              control={form.control}
              name="content"
              render={({ field }) => (
                <RichTextEditor
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder="경력, 학력, 기술 스택 등을 입력하세요. 제목(H2/H3), 목록, 굵게 등 서식을 자유롭게 사용하세요."
                  minHeight="24rem"
                />
              )}
            />
          </CardContent>
        </Card>

        {/* 자기소개서 */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2 text-slate-800">
              <PenLine className="w-4 h-4 text-blue-600" />
              자기소개서
            </CardTitle>
            <div className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded-md">
              {htmlToText(form.watch("coverLetter") || "").length}자
            </div>
          </CardHeader>
          <CardContent>
            <Controller
              control={form.control}
              name="coverLetter"
              render={({ field }) => (
                <RichTextEditor
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  placeholder="자기소개서 내용을 입력하세요. 지원동기, 성장과정, 장단점 등을 서식과 함께 작성해보세요."
                  minHeight="18rem"
                />
              )}
            />
          </CardContent>
        </Card>

        <button id="hidden-submit-btn" type="submit" className="hidden" />
      </form>
    </Form>
  )

  return (
    <>
      <div className="animate-in fade-in duration-500 pb-20">
        {/* 상단 고정 액션 바 */}
        <div className="sticky top-0 z-50 -mx-4 px-4 sm:-mx-6 sm:px-6 py-4 bg-white/85 backdrop-blur-md border-b border-slate-200 flex items-center justify-between gap-4 mb-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/resumes")} className="shrink-0 -ml-2 text-slate-500 hover:text-slate-900">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate text-slate-900">
              {isNew ? "새 이력서 등록" : "이력서 수정"}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button type="button" variant="outline" onClick={() => setLocation("/resumes")} className="hidden sm:inline-flex border-slate-200 text-slate-700 hover:bg-slate-50">
              취소
            </Button>
            <Button 
              type="button" 
              disabled={isPending || isChecking} 
              onClick={() => document.getElementById('hidden-submit-btn')?.click()}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              {isChecking ? (
                <><SpellCheck className="w-4 h-4 sm:mr-2 animate-pulse" /><span className="hidden sm:inline">오탈자 검사 중…</span></>
              ) : isPending ? (
                <><Loader2 className="w-4 h-4 sm:mr-2 animate-spin" /><span className="hidden sm:inline">저장 중…</span></>
              ) : (
                <><Save className="w-4 h-4 sm:mr-2" /><span className="hidden sm:inline">저장</span></>
              )}
            </Button>
          </div>
        </div>

        <div className={`grid gap-6 items-start ${!isNew ? "lg:grid-cols-[1fr_300px]" : "max-w-4xl"}`}>
          {/* Main Form Area */}
          <div className="space-y-8 min-w-0">
            {isNew ? (
              <Tabs defaultValue="upload">
                <TabsList className="mb-6 w-full max-w-sm grid grid-cols-2">
                  <TabsTrigger value="upload">파일 업로드</TabsTrigger>
                  <TabsTrigger value="manual">직접 입력</TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="space-y-5">
                  <div
                    className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-all bg-white"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                  >
                    <Upload className="w-12 h-12 text-blue-500/50 mx-auto mb-4" />
                    <p className="text-base font-semibold text-slate-800">PDF 또는 DOCX 파일을 업로드하세요</p>
                    <p className="text-sm text-slate-500 mt-1">클릭하거나 여기에 드래그하세요</p>
                    <p className="text-xs text-slate-400 mt-2">최대 10MB · PDF, DOC, DOCX 지원</p>
                    <p className="text-xs text-slate-400 mt-1">스캔·이미지 PDF도 AI OCR로 지원합니다 (처리에 다소 시간이 걸릴 수 있습니다)</p>
                    {selectedFile && (
                      <p className="mt-4 text-sm font-semibold text-blue-600 bg-blue-50 py-1.5 px-3 rounded-full inline-block">{selectedFile.name}</p>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx"
                    className="hidden" onChange={handleFileSelect} />

                  <Card className="border-slate-200 shadow-sm">
                    <CardContent className="pt-6 space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-800">제목 (선택)</label>
                        <Input
                          placeholder="비워두면 파일명이 자동 사용됩니다"
                          value={uploadTitle}
                          onChange={(e) => setUploadTitle(e.target.value)}
                        />
                      </div>

                      {isUploading && (
                        <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 flex items-center gap-3 text-sm text-blue-700">
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                          <span>파일을 분석하는 중입니다. 자기소개서를 자동으로 분리하고 표를 변환합니다…</span>
                        </div>
                      )}

                      <div className="flex justify-end gap-3 pt-2">
                        <Button onClick={handleUpload} disabled={isUploading || !selectedFile} className="w-full sm:w-auto gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                          {isUploading ? (
                            <><Loader2 className="w-4 h-4 animate-spin" />분석 중…</>
                          ) : (
                            <><Upload className="w-4 h-4" />업로드 및 분석</>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="manual">{formContent}</TabsContent>
              </Tabs>
            ) : formContent}
          </div>

          {/* Sidebar Area (Only if !isNew) */}
          {!isNew && (
            <div className="space-y-4">
              {/* AI 요약 카드 */}
              {career?.result?.resumeSummary && (
                <Card className="border-indigo-100 bg-indigo-50/60 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold text-indigo-800 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      AI 요약
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {career.result.resumeSummary}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* 문서 정보 카드 */}
              <Card className="border-slate-200 shadow-sm bg-white">
                <CardHeader className="pb-3 border-b border-slate-100/60 mb-3">
                  <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <BarChart className="w-4 h-4 text-slate-500" />
                    문서 정보
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3.5">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">이력서 분량</span>
                    <span className="font-medium text-slate-700">{htmlToText(form.watch("content") || "").length}자</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">자소서 분량</span>
                    <span className="font-medium text-slate-700">{htmlToText(form.watch("coverLetter") || "").length}자</span>
                  </div>
                  
                  {resume?.updatedAt && (
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-sm">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5" />최근 저장
                      </span>
                      <span className="text-slate-600 text-[11px] font-medium">
                        {new Date(resume.updatedAt).toLocaleString("ko-KR", { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-sm">
                    <span className="text-slate-500 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5" />커리어 분석
                    </span>
                    <span className="text-xs font-medium">
                      {career?.inProgress ? <span className="text-indigo-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />분석 중</span>
                        : career?.error ? <span className="text-red-600">오류 발생</span>
                        : career?.result ? <span className="text-emerald-600">완료됨</span>
                        : <span className="text-slate-400">대기 중</span>}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* 액션 카드 */}
              <Card className="border-slate-200 shadow-sm bg-white">
                <CardHeader className="pb-3 border-b border-slate-100/60 mb-3">
                  <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-slate-500" />
                    추가 작업
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDownloadPdf}
                    className="w-full gap-2 text-blue-700 border-blue-200 hover:bg-blue-50 shadow-sm"
                    disabled={(htmlToText(form.watch("content") || "").length === 0 && htmlToText(form.watch("coverLetter") || "").length === 0)}
                  >
                    <FileDown className="w-4 h-4" />
                    이력서 PDF 다운로드
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
"""

text = text[:start_idx] + new_content + "\n" + text[end_idx:]

with open('artifacts/job-doc-check/src/pages/resume-detail.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
