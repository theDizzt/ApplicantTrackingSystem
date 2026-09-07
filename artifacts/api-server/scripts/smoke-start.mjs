import { spawn } from "node:child_process";

const port = process.env.SMOKE_TEST_PORT ?? "43123";
const timeoutMs = Number(process.env.SMOKE_TEST_TIMEOUT_MS ?? "15000");
const healthUrl = `http://127.0.0.1:${port}/api/healthz`;

const server = spawn(process.execPath, ["--enable-source-maps", "./dist/index.mjs"], {
  cwd: new URL("..", import.meta.url),
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: port,
  },
  stdio: "inherit",
});

let serverExit;
const serverExited = new Promise((resolve) => {
  server.once("exit", (code, signal) => {
    serverExit = { code, signal };
    resolve(serverExit);
  });
});

async function waitForHealthyServer() {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    if (serverExit) {
      throw new Error(
        `API server exited before becoming healthy (code=${serverExit.code}, signal=${serverExit.signal})`,
      );
    }

    try {
      const response = await fetch(healthUrl);
      const body = await response.text();

      if (response.ok) {
        console.log(`API server smoke check passed: ${response.status} ${body}`);
        return;
      }

      lastError = new Error(`Health check returned ${response.status}: ${body}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    `API server did not become healthy within ${timeoutMs}ms: ${lastError?.message ?? "no response"}`,
  );
}

async function stopServer() {
  if (serverExit) return;

  server.kill("SIGTERM");
  const forcedStop = setTimeout(() => {
    if (!serverExit) server.kill("SIGKILL");
  }, 5_000);
  forcedStop.unref();

  await serverExited;
  clearTimeout(forcedStop);
}

try {
  await waitForHealthyServer();
} finally {
  await stopServer();
}