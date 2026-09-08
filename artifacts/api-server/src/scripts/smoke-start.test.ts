import { execFile, spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const smokeScript = resolve(process.cwd(), "scripts/smoke-start.mjs");
const temporaryDirectories: string[] = [];

async function getAvailablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not allocate an ephemeral test port");
  }
  await new Promise<void>((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
  return address.port;
}

async function createServerFixture(
  statusCode: number,
  options: { ignoreSigterm?: boolean; spawnWorker?: boolean } = {},
) {
  const directory = await mkdtemp(join(tmpdir(), "smoke-start-"));
  temporaryDirectories.push(directory);
  const entry = join(directory, "server.mjs");
  const pidFile = join(directory, "server.pid");
  const workerPidFile = join(directory, "worker.pid");
  await writeFile(
    entry,
    `import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createServer } from "node:http";
writeFileSync(process.env.SMOKE_TEST_PID_FILE, String(process.pid));
${options.spawnWorker ? `const worker = spawn(process.execPath, ["-e", ${JSON.stringify(
  options.ignoreSigterm
    ? 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)'
    : 'setInterval(() => {}, 1000)',
)}], { stdio: "ignore" });
writeFileSync(process.env.SMOKE_TEST_WORKER_PID_FILE, String(worker.pid));` : ""}
const server = createServer((_request, response) => {
  response.writeHead(${statusCode}, { "content-type": "text/plain" });
  response.end(${statusCode} === 200 ? "healthy" : "not ready");
});
server.listen(Number(process.env.PORT), "127.0.0.1");
process.on("SIGTERM", () => ${
      options.ignoreSigterm
        ? "{}"
        : "server.close(() => process.exit(0))"
    });
`,
  );
  return { entry, pidFile, workerPidFile };
}

function expectProcessStopped(pid: number) {
  expect(() => process.kill(pid, 0)).toThrow(
    expect.objectContaining({ code: "ESRCH" }),
  );
}

async function waitForPidFile(path: string): Promise<number> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    try {
      return Number(await readFile(path, "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await new Promise((resolveWait) => setTimeout(resolveWait, 10));
    }
  }
  throw new Error(`Timed out waiting for PID file: ${path}`);
}

async function runInterruptedSmokeCheck(
  signal: "SIGTERM" | "SIGINT",
  duplicateSignal = false,
) {
  const fixture = await createServerFixture(503, { spawnWorker: true });
  const port = await getAvailablePort();
  const smokeProcess = spawn(process.execPath, [smokeScript], {
    env: {
      ...process.env,
      SMOKE_TEST_PORT: String(port),
      SMOKE_TEST_TIMEOUT_MS: "5000",
      SMOKE_TEST_FORCE_KILL_AFTER_MS: "50",
      SMOKE_TEST_SERVER_ENTRY: fixture.entry,
      SMOKE_TEST_PID_FILE: fixture.pidFile,
      SMOKE_TEST_WORKER_PID_FILE: fixture.workerPidFile,
    },
    stdio: "ignore",
  });
  const smokeProcessExited = new Promise<{
    code: number | null;
    signal: string | null;
  }>((resolveExit, reject) => {
    smokeProcess.once("error", reject);
    smokeProcess.once("exit", (code, exitSignal) =>
      resolveExit({ code, signal: exitSignal }),
    );
  });

  const [pid, workerPid] = await Promise.all([
    waitForPidFile(fixture.pidFile),
    waitForPidFile(fixture.workerPidFile),
  ]);
  smokeProcess.kill(signal);
  if (duplicateSignal) smokeProcess.kill(signal);

  const exit = await smokeProcessExited;

  return { ...exit, pid, workerPid };
}

async function runSmokeCheck(
  statusCode: number,
  timeoutMs: number,
  options: {
    ignoreSigterm?: boolean;
    forceKillAfterMs?: number;
    spawnWorker?: boolean;
  } = {},
): Promise<{
  pid: number;
  workerPid?: number;
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  const fixture = await createServerFixture(statusCode, options);
  const port = await getAvailablePort();

  try {
    const result = await execFileAsync(process.execPath, [smokeScript], {
      env: {
        ...process.env,
        SMOKE_TEST_PORT: String(port),
        SMOKE_TEST_TIMEOUT_MS: String(timeoutMs),
        ...(options.forceKillAfterMs === undefined
          ? {}
          : {
              SMOKE_TEST_FORCE_KILL_AFTER_MS: String(
                options.forceKillAfterMs,
              ),
            }),
        SMOKE_TEST_SERVER_ENTRY: fixture.entry,
        SMOKE_TEST_PID_FILE: fixture.pidFile,
        SMOKE_TEST_WORKER_PID_FILE: fixture.workerPidFile,
      },
      timeout: 5_000,
    });
    return {
      pid: Number(await readFile(fixture.pidFile, "utf8")),
      workerPid: options.spawnWorker
        ? Number(await readFile(fixture.workerPidFile, "utf8"))
        : undefined,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0,
    };
  } catch (error) {
    const result = error as {
      code: number;
      stdout: string;
      stderr: string;
    };
    return {
      pid: Number(await readFile(fixture.pidFile, "utf8")),
      workerPid: options.spawnWorker
        ? Number(await readFile(fixture.workerPidFile, "utf8"))
        : undefined,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.code,
    };
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("smoke-start process cleanup", () => {
  it("stops the child server after a successful health response", async () => {
    const result = await runSmokeCheck(200, 2_000);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("API server smoke check passed: 200 healthy");
    expectProcessStopped(result.pid);
  });

  it("stops the child server after the health check times out", async () => {
    const result = await runSmokeCheck(503, 400);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("API server did not become healthy within 400ms");
    expectProcessStopped(result.pid);
  });

  it("stops the full process tree after the health check times out", async () => {
    const result = await runSmokeCheck(503, 400, { spawnWorker: true });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("API server did not become healthy within 400ms");
    expectProcessStopped(result.pid);
    expectProcessStopped(result.workerPid!);
  });

  it("force kills a child server that ignores SIGTERM", async () => {
    const result = await runSmokeCheck(200, 2_000, {
      ignoreSigterm: true,
      forceKillAfterMs: 50,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("API server smoke check passed: 200 healthy");
    expectProcessStopped(result.pid);
  });

  it("stops the full process tree after a graceful shutdown", async () => {
    const result = await runSmokeCheck(200, 2_000, { spawnWorker: true });

    expect(result.exitCode).toBe(0);
    expectProcessStopped(result.pid);
    expectProcessStopped(result.workerPid!);
  });

  it("force kills the full process tree when it ignores SIGTERM", async () => {
    const result = await runSmokeCheck(200, 2_000, {
      ignoreSigterm: true,
      spawnWorker: true,
      forceKillAfterMs: 50,
    });

    expect(result.exitCode).toBe(0);
    expectProcessStopped(result.pid);
    expectProcessStopped(result.workerPid!);
  });

  it.each([
    ["SIGTERM", 143],
    ["SIGINT", 130],
  ] as const)(
    "stops the full process tree when smoke-start receives %s",
    async (signal, expectedExitCode) => {
      const result = await runInterruptedSmokeCheck(signal);

      expect(result).toMatchObject({ code: expectedExitCode, signal: null });
      expectProcessStopped(result.pid);
      expectProcessStopped(result.workerPid);
    },
  );

  it("safely handles duplicate shutdown signals", async () => {
    const result = await runInterruptedSmokeCheck("SIGTERM", true);

    expect(result).toMatchObject({ code: 143, signal: null });
    expectProcessStopped(result.pid);
    expectProcessStopped(result.workerPid);
  });
});
