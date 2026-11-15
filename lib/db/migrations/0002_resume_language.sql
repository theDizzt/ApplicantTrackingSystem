-- 이력서 언어(ko | en | mixed). NULL = 아직 판정 안 됨(기존 데이터).
-- 빈 DB(CI 등)에서는 resumes 테이블이 아직 없을 수 있으므로 IF EXISTS로 건너뛴다.
ALTER TABLE IF EXISTS resumes ADD COLUMN IF NOT EXISTS language text;
