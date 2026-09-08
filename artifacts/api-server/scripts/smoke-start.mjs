import { spawn } from "node:child_process";

const port = process.env.SMOKE_TEST_PORT ?? "43123";
const timeoutMs = Number(process.env.SMOKE_TEST_TIMEOUT_MS ?? "15000");
const forceKillAfterMs = Number(
  process.env.SMOKE_TEST_FORCE_KILL_AFTER_MS ?? "5000",
);
const healthUrl = `http://127.0.0.1:${port}/api/healthz`;
const serverEntry = process.env.SMOKE_TEST_SERVER_ENTRY ?? "./dist/index.mjs";

const server = spawn(process.execPath, ["--enable-source-maps", serverEntry], {
  cwd: new URL("..", import.meta.url),
  detached: true,
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: port,
  },
  stdio: "inherit",
});

let serverExit;
let stopServerPromise;
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
  if (serverExit) return serverExited;
  if (stopServerPromise) return stopServerPromise;

  stopServerPromise = (async () => {
    signalServerTree("SIGTERM");
    const forcedStop = setTimeout(() => {
      if (!serverExit) signalServerTree("SIGKILL");
    }, forceKillAfterMs);
    forcedStop.unref();

    try {
      await serverExited;
    } finally {
      clearTimeout(forcedStop);
    }
  })();

  return stopServerPromise;
}

function signalServerTree(signal) {
  if (server.pid === undefined) return;

  try {
    process.kill(-server.pid, signal);
  } catch (error) {
    if (error?.code !== "ESRCH") throw error;
  }
}

for (const [signal, exitCode] of [
  ["SIGTERM", 143],
  ["SIGINT", 130],
]) {
  process.on(signal, () => {
    void stopServer().then(
      () => process.exit(exitCode),
      (error) => {
        console.error(`Failed to stop API server after ${signal}:`, error);
        process.exit(1);
      },
    );
  });
}

try {
  await waitForHealthyServer();
} finally {
  await stopServer();
}