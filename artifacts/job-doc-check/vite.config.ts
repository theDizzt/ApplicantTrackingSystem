import fs from 'fs';
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ── 개발 서버 HTTPS (선택) ──────────────────────────────────────────────────
// DEV_HTTPS_CERT / DEV_HTTPS_KEY에 인증서 파일(mkcert 등으로 만든 PEM)을 지정하면
// 개발 서버가 https://로 뜬다. 휴대폰 등 다른 기기에서 접속할 때 브라우저가
// 마이크(음성 녹음)를 허용하려면 HTTPS가 필요하다. 상대 경로는 저장소 루트 기준.
// 자세한 방법: docs/HTTPS.md
function loadDevHttps(): { cert: Buffer; key: Buffer } | undefined {
  const certPath = process.env.DEV_HTTPS_CERT?.trim();
  const keyPath = process.env.DEV_HTTPS_KEY?.trim();
  if (!certPath && !keyPath) return undefined;
  if (!certPath || !keyPath) {
    throw new Error('DEV_HTTPS_CERT와 DEV_HTTPS_KEY는 함께 설정해야 합니다. (docs/HTTPS.md 참고)');
  }
  const repoRoot = path.resolve(import.meta.dirname, '..', '..');
  const resolve = (p: string) => (path.isAbsolute(p) ? p : path.resolve(repoRoot, p));
  const files = { cert: resolve(certPath), key: resolve(keyPath) };
  for (const [name, file] of Object.entries(files)) {
    if (!fs.existsSync(file)) {
      throw new Error(`개발용 HTTPS ${name} 파일을 찾을 수 없습니다: ${file} (docs/HTTPS.md 참고)`);
    }
  }
  return { cert: fs.readFileSync(files.cert), key: fs.readFileSync(files.key) };
}

const devHttps = loadDevHttps();

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    ...(devHttps ? { https: devHttps } : {}),
    fs: {
      strict: true,
    },
    // 로컬(맥북 등) 개발용: API_PROXY_TARGET이 설정되면 /api 요청을 API 서버로 전달.
    // Replit 환경에서는 이 변수가 없으므로 동작에 영향 없음.
    ...(process.env.API_PROXY_TARGET
      ? { proxy: { '/api': { target: process.env.API_PROXY_TARGET, changeOrigin: true } } }
      : {}),
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
    ...(devHttps ? { https: devHttps } : {}),
  },
});
