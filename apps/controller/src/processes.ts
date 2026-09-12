import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { basename, dirname, resolve } from "node:path";
import { createWriteStream } from "node:fs";
import { randomUUID } from "node:crypto";

export async function command(
  executable: string,
  args: string[],
  options: {
    cwd: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
    allowedExitCodes?: number[];
  },
): Promise<string> {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const collect = (chunk: Buffer) => {
      output = (output + chunk.toString()).slice(-32_000);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    const timer = setTimeout(
      () => child.kill("SIGKILL"),
      options.timeoutMs ?? 120_000,
    );
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      if (code !== null && (options.allowedExitCodes ?? [0]).includes(code))
        resolveCommand(output);
      else
        reject(
          new Error(`${executable} failed (${signal ?? code}): ${output}`),
        );
    });
  });
}

export interface TargetProcess {
  child: ChildProcess;
  root: string;
  releaseId: string;
  url: string;
  containerName: string;
}

export async function stopTarget(target: TargetProcess | null): Promise<void> {
  if (!target) return;
  await command("docker", ["stop", "--time", "3", target.containerName], {
    cwd: target.root,
    timeoutMs: 8_000,
  }).catch(() => undefined);
  await command("docker", ["rm", "--force", target.containerName], {
    cwd: target.root,
    timeoutMs: 8_000,
  }).catch(() => undefined);
  const remainingState = (
    await command(
      "docker",
      [
        "container",
        "ls",
        "--all",
        "--filter",
        `name=^/${target.containerName}$`,
        "--format",
        "{{.State}}",
      ],
      { cwd: target.root, timeoutMs: 8_000 },
    )
  ).trim();
  if (
    remainingState &&
    !["created", "exited", "dead"].includes(remainingState)
  ) {
    throw new Error(
      `Cannot restart Fieldnote: the previous container is still ${remainingState}.`,
    );
  }
}

export async function startTarget(options: {
  root: string;
  database: string;
  port: number;
  releaseId: string;
  runId: string;
  shellOrigin: string;
  logPath: string;
}): Promise<TargetProcess> {
  const log = createWriteStream(options.logPath, { flags: "a" });
  const containerName = `cutaway-target-${options.runId}-${options.port}-${randomUUID()}`;
  const child = spawn(
    "docker",
    [
      "run",
      "--rm",
      "--name",
      containerName,
      "--init",
      "--read-only",
      "--cap-drop=ALL",
      "--user",
      `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
      "--security-opt=no-new-privileges",
      "--pids-limit=128",
      "--memory=512m",
      "--tmpfs",
      "/tmp:rw,nosuid,size=64m",
      "--publish",
      `127.0.0.1:${options.port}:4120`,
      "--mount",
      `type=bind,src=${resolve(options.root)},dst=/workspace,readonly`,
      "--mount",
      `type=bind,src=${resolve(`${options.root}.build`)},dst=/output,readonly`,
      "--mount",
      `type=bind,src=${dirname(resolve(options.database))},dst=/data`,
      "--env",
      "NODE_ENV=production",
      "--env",
      "PORT=4120",
      "--env",
      "HOST=0.0.0.0",
      "--env",
      `DB_PATH=/data/${basename(options.database)}`,
      "--env",
      "FIELDNOTE_DIST_PATH=/output",
      "--env",
      `RELEASE_ID=${options.releaseId}`,
      "--env",
      `RUN_ID=${options.runId}`,
      "--env",
      `SHELL_ORIGIN=${options.shellOrigin}`,
      "--entrypoint",
      "node",
      process.env.CUTAWAY_WORKER_IMAGE ?? "cutaway-codex-worker",
      "--import",
      "tsx",
      "src/server/index.ts",
    ],
    {
      cwd: options.root,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  child.once("exit", () => log.end());
  let launchError: Error | undefined;
  child.once("error", (error) => {
    launchError = error;
    log.end();
  });
  const target = {
    child,
    root: options.root,
    releaseId: options.releaseId,
    url: `http://127.0.0.1:${options.port}`,
    containerName,
  };
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (launchError) throw launchError;
    if (child.exitCode !== null)
      throw new Error(
        `Fieldnote exited before readiness; inspect ${options.logPath}`,
      );
    try {
      const response = await fetch(`${target.url}/health`, {
        signal: AbortSignal.timeout(500),
      });
      const body: unknown = await response.json();
      if (
        response.ok &&
        typeof body === "object" &&
        body !== null &&
        "revision" in body &&
        body.revision === options.releaseId &&
        "ready" in body &&
        body.ready === true
      )
        return target;
    } catch {
      /* The child is still starting. */
    }
    await delay(150);
  }
  await stopTarget(target);
  throw new Error(
    `Fieldnote did not become healthy; inspect ${options.logPath}`,
  );
}
