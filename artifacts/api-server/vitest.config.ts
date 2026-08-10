import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 30_000,
    // 여러 테스트 파일이 가짜 Ollama를 고정 포트 11434에 바인딩하므로
    // (resolveOllamaRoot가 이 포트만 인정) 파일 단위 병렬 실행을 끈다.
    fileParallelism: false,
  },
});
