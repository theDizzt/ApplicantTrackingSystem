import { execFile } from "node:child_process";
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
  options: { ignoreSigterm?: boolean } = {},
) {
  const directory = await mkdtemp(join(tmpdir(), "smoke-start-"));
  temporaryDirectories.push(directory);
  const entry = join(directory, "server.mjs");
  const pidFile = join(directory, "server.pid");
  await writeFile(
    entry,
    `import { writeFileSync } from "node:fs";
import { createServer } from "node:http";
writeFileSync(process.env.SMOKE_TEST_PID_FILE, String(process.pid));
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
  return { entry, pidFile };
}

function expectProcessStopped(pid: number) {
  expect(() => process.kill(pid, 0)).toThrow(
    expect.objectContaining({ code: "ESRCH" }),
  );
}

async function runSmokeCheck(
  statusCode: number,
  timeoutMs: number,
  options: { ignoreSigterm?: boolean; forceKillAfterMs?: number } = {},
): Promise<{ pid: number; stdout: string; stderr: string; exitCode: number }> {
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
      },
      timeout: 5_000,
    });
    return {
      pid: Number(await readFile(fixture.pidFile, "utf8")),
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

  it("force kills a child server that ignores SIGTERM", async () => {
    const result = await runSmokeCheck(200, 2_000, {
      ignoreSigterm: true,
      forceKillAfterMs: 50,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("API server smoke check passed: 200 healthy");
    expectProcessStopped(result.pid);
  });
});