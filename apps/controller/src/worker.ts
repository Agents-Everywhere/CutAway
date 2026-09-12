import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { CodingWorkerInput } from "cutaway-core";
import { command } from "./processes.js";

const resultSchema = z.object({
  type: z.literal("result"),
  summary: z.string().max(16_000),
  threadId: z.string().nullable(),
});

export async function runCodingWorker(options: {
  repository: string;
  candidateRoot: string;
  scratchRoot: string;
  input: CodingWorkerInput;
}): Promise<{ summary: string; threadId: string | null }> {
  const provider = process.env.MODEL_PROVIDER ?? "openrouter";
  if (!["openrouter", "openai"].includes(provider))
    throw new Error(`Unsupported coding provider: ${provider}`);
  const keyName =
    provider === "openrouter" ? "OPENROUTER_API_KEY" : "OPENAI_API_KEY";
  if (!process.env[keyName])
    throw new Error(
      `Configure ${keyName} in the ignored root .env before requesting a repair.`,
    );
  if (!process.env.CODEX_MODEL)
    throw new Error(
      "Configure CODEX_MODEL in the ignored root .env before requesting a repair.",
    );
  await mkdir(options.scratchRoot, { recursive: true });
  const inputPath = join(options.scratchRoot, "input.json");
  await writeFile(inputPath, JSON.stringify(options.input, null, 2));
  const promptPath = join(options.repository, "runtime-prompts/repair.md");
  await readFile(promptPath); // Fail before starting Docker if the runtime prompt is absent.
  const name = `cutaway-worker-${options.input.runId}`;
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    MODEL_PROVIDER: provider,
    CODEX_MODEL: process.env.CODEX_MODEL,
    CODEX_REASONING_EFFORT: process.env.CODEX_REASONING_EFFORT ?? "max",
    [keyName]: process.env[keyName],
  };
  try {
    const output = await command(
      "docker",
      [
        "run",
        "--rm",
        "--name",
        name,
        "--init",
        "--read-only",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        // Docker Desktop's default seccomp blocks the SDK's nested user namespace.
        // The SDK still applies its own workspace-write filesystem/network sandbox.
        "--security-opt=seccomp=unconfined",
        "--pids-limit=256",
        "--memory=2g",
        "--cpus=2",
        "--tmpfs",
        "/tmp:rw,nosuid,size=512m",
        "--tmpfs",
        "/home/node:rw,nosuid,uid=1000,gid=1000,size=128m",
        "--mount",
        `type=bind,src=${options.candidateRoot},dst=/workspace`,
        "--mount",
        `type=bind,src=${inputPath},dst=/run/cutaway/input.json,readonly`,
        "--mount",
        `type=bind,src=${promptPath},dst=/run/cutaway/repair.md,readonly`,
        "-e",
        "MODEL_PROVIDER",
        "-e",
        "CODEX_MODEL",
        "-e",
        "CODEX_REASONING_EFFORT",
        "-e",
        keyName,
        process.env.CUTAWAY_WORKER_IMAGE ?? "cutaway-codex-worker",
      ],
      { cwd: options.repository, env, timeoutMs: 8 * 60_000 },
    );
    await writeFile(join(options.scratchRoot, "worker-events.jsonl"), output);
    for (const line of output.trim().split("\n").reverse()) {
      let data: unknown;
      try {
        data = JSON.parse(line);
      } catch {
        continue;
      }
      const parsed = resultSchema.safeParse(data);
      if (parsed.success) return parsed.data;
    }
    throw new Error("The coding worker ended without a final result.");
  } finally {
    // Also stops a container if the Docker client was killed by the time limit.
    await command("docker", ["rm", "--force", name], {
      cwd: options.repository,
      env,
      timeoutMs: 10_000,
    }).catch(() => undefined);
  }
}
