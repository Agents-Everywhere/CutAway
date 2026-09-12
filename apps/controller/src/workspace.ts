import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { command } from "./processes.js";

const ignored = new Set(["node_modules", "dist", ".git"]);

export async function sourceFiles(
  root: string,
  directory = root,
): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isSymbolicLink())
      throw new Error(
        `Symlinks are not allowed in target source: ${relative(root, absolute)}`,
      );
    if (directory === root && ignored.has(entry.name)) {
      if (entry.isDirectory()) await sourceFiles(root, absolute);
      continue;
    }
    if (entry.isDirectory()) files.push(...(await sourceFiles(root, absolute)));
    else if (entry.isFile())
      files.push(relative(root, absolute).split(sep).join("/"));
  }
  return files.sort();
}

export async function digestFiles(
  root: string,
  files: string[],
): Promise<string> {
  const hash = createHash("sha256");
  for (const file of [...files].sort()) {
    const stat = await lstat(join(root, file));
    if (!stat.isFile()) throw new Error(`Expected regular file: ${file}`);
    hash
      .update(file)
      .update("\0")
      .update(await readFile(join(root, file)))
      .update("\0");
  }
  return hash.digest("hex");
}

export async function sourceDigest(root: string): Promise<string> {
  return digestFiles(root, await sourceFiles(root));
}

export async function artifactDigest(root: string): Promise<string> {
  const dist = buildDirectory(root);
  return digestFiles(dist, await sourceFiles(dist));
}

export function buildDirectory(root: string): string {
  return `${root}.build`;
}

export async function copySource(
  source: string,
  destination: string,
): Promise<void> {
  await mkdir(destination, { recursive: true });
  for (const file of await sourceFiles(source)) {
    await mkdir(dirname(join(destination, file)), { recursive: true });
    await cp(join(source, file), join(destination, file), { recursive: false });
  }
}

export async function buildTarget(
  root: string,
  repository: string,
): Promise<void> {
  await sourceFiles(root); // Reject worker-created symlinks before any build tool runs.
  const modules = await lstat(join(root, "node_modules")).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw error;
    },
  );
  if (modules)
    throw new Error(
      "The candidate must use the image's installed dependencies.",
    );
  const output = buildDirectory(root);
  await mkdir(output, { recursive: true });
  if (!(await lstat(output)).isDirectory())
    throw new Error("Build output must be an owned directory.");
  const name = `cutaway-build-${createHash("sha256").update(root).digest("hex").slice(0, 20)}`;
  try {
    await command(
      "docker",
      [
        "run",
        "--rm",
        "--name",
        name,
        "--init",
        "--read-only",
        "--cap-drop=ALL",
        "--user",
        `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
        "--security-opt=no-new-privileges",
        "--network=none",
        "--memory=2g",
        "--pids-limit=128",
        "--tmpfs",
        "/tmp:rw,nosuid,size=256m",
        "--mount",
        `type=bind,src=${root},dst=/workspace,readonly`,
        "--mount",
        `type=bind,src=${output},dst=/output`,
        "--entrypoint",
        "sh",
        process.env.CUTAWAY_WORKER_IMAGE ?? "cutaway-codex-worker",
        "-c",
        "tsc --noEmit && vite build --configLoader runner --outDir /output --emptyOutDir",
      ],
      { cwd: repository },
    );
    await sourceFiles(output);
  } finally {
    await command("docker", ["rm", "--force", name], {
      cwd: repository,
      timeoutMs: 10_000,
    }).catch(() => undefined);
  }
}

export function allowedEdit(path: string): boolean {
  return (
    (path.startsWith("src/client/") && path !== "src/client/connector.ts") ||
    /^src\/server\/(?:reservations|booking[\w-]*|availability[\w-]*)\.ts$/.test(
      path,
    )
  );
}

export async function changedSource(
  base: string,
  candidate: string,
): Promise<string[]> {
  const before = new Set(await sourceFiles(base));
  const after = new Set(await sourceFiles(candidate));
  const changed: string[] = [];
  for (const path of new Set([...before, ...after])) {
    if (
      !before.has(path) ||
      !after.has(path) ||
      !(await readFile(join(base, path))).equals(
        await readFile(join(candidate, path)),
      )
    ) {
      if (!allowedEdit(path))
        throw new Error(`Worker changed protected source: ${path}`);
      changed.push(path);
    }
  }
  if (!changed.length)
    throw new Error("The coding worker did not change target source.");
  return changed.sort();
}
