-- 면접 기능 확장 열 (스키마 lib/db/src/schema/interviews.ts 와 같게 유지)
-- 이전에는 drizzle-kit push로만 반영되어, push를 다시 하지 않은 DB에서는 면접 조회·생성이
-- "column does not exist"로 실패했다. 서버 시작 시 migrate가 자동으로 적용한다.
-- 빈 DB(CI 등)에서는 테이블이 아직 없을 수 있으므로 IF EXISTS로 건너뛴다. 재실행해도 안전하다.

-- 실시간 음성 면접: text = 글로 답하기, live = 음성으로 한 문제씩
ALTER TABLE IF EXISTS interview_sessions ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'text';
-- 면접 난이도: easy / normal / hard
ALTER TABLE IF EXISTS interview_sessions ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'normal';

-- 꼬리 질문 말투: pressure / neutral / positive (기본 질문은 NULL)
ALTER TABLE IF EXISTS interview_questions ADD COLUMN IF NOT EXISTS tone text;
-- 실시간 면접 답변 녹음 길이(초)
ALTER TABLE IF EXISTS interview_questions ADD COLUMN IF NOT EXISTS answer_seconds real;
-- 실시간 면접 카메라 자세·시선 요약(JSON 문자열)
ALTER TABLE IF EXISTS interview_questions ADD COLUMN IF NOT EXISTS camera_metrics text;
