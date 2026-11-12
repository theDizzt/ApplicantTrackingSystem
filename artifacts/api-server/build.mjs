import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild, context as esbuildContext } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";
import { spawn } from "node:child_process";

// `node build.mjs --watch` (개발 모드): 소스가 바뀌면 다시 빌드하고 서버를 자동 재시작한다.
const watchMode = process.argv.includes("--watch");

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  const options = {
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    // Some packages may not be bundleable, so we externalize them, we can add more here as needed.
    // Some of the packages below may not be imported or installed, but we're adding them in case they are in the future.
    // Examples of unbundleable packages:
    // - uses native modules and loads them dynamically (e.g. sharp)
    // - use path traversal to read files (e.g. @google-cloud/secret-manager loads sibling .proto files)
    external: [
      "*.node",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@opentelemetry/*",
      "@google-cloud/*",
      "@google/*",
      "googleapis",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
    ],
    sourcemap: "linked",
    plugins: [
      // pino relies on workers to handle logging, instead of externalizing it we use a plugin to handle it
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    // Make sure packages that are cjs only (e.g. express) but are bundled continue to work in our esm output file
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  };

  if (!watchMode) {
    await esbuild(options);
    return;
  }

  // ── 개발 모드: 감시 빌드 + 서버 자동 재시작 ─────────────────────────────
  // node --watch는 pino 로그 워커(thread-stream)와 충돌해 서버가 바로 죽으므로,
  // 빌드가 성공할 때마다 여기서 서버 프로세스를 직접 껐다 켠다.
  let server = null;
  let restarting = Promise.resolve();

  const startServer = () => {
    const child = spawn(
      process.execPath,
      ["--enable-source-maps", path.join(distDir, "index.mjs")],
      { cwd: artifactDir, stdio: "inherit", env: process.env },
    );
    child.on("exit", (code, signal) => {
      if (server === child && !signal) {
        console.log(`[dev] API 서버가 종료됐습니다 (code ${code}). 소스를 고쳐 저장하면 다시 시작합니다.`);
        server = null;
      }
    });
    server = child;
  };

  const stopServer = () => new Promise((resolve) => {
    const child = server;
    server = null;
    if (!child || child.exitCode !== null) return resolve();
    child.once("exit", () => resolve());
    child.kill();
  });

  const ctx = await esbuildContext({
    ...options,
    plugins: [
      ...options.plugins,
      {
        name: "restart-api-server",
        setup(b) {
          b.onEnd((result) => {
            if (result.errors.length > 0) {
              console.log("[dev] 빌드 오류 — 이전 서버를 그대로 둡니다. 오류를 고치면 다시 시작합니다.");
              return;
            }
            restarting = restarting.then(async () => {
              if (server) console.log("[dev] 소스가 바뀌어 API 서버를 다시 시작합니다...");
              await stopServer();
              startServer();
            });
          });
        },
      },
    ],
  });
  await ctx.watch(); // 첫 빌드 후 서버를 띄우고, 이후 저장할 때마다 다시 빌드·재시작
  console.log("[dev] 소스 변경을 감시합니다. 저장하면 API 서버가 자동으로 다시 시작됩니다.");

  const shutdown = async () => {
    await stopServer();
    await ctx.dispose();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
