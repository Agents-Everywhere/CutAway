import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const config = resolve(root, ".cutaway/config");
await mkdir(config, { recursive: true });
const tokenPath = resolve(config, "controller-token");
let token: string;
try {
  token = (await readFile(tokenPath, "utf8")).trim();
} catch {
  token = randomBytes(32).toString("hex");
  await writeFile(tokenPath, token, { mode: 0o600 });
}
const env = {
  ...process.env,
  CUTAWAY_ROOT: root,
  CUTAWAY_CONTROLLER_TOKEN: token,
};
const children: ChildProcess[] = [];
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
}
function launch(args: string[], cwd = root) {
  const child = spawn(process.execPath, args, { cwd, env, stdio: "inherit" });
  children.push(child);
  child.on("error", (error) => {
    console.error(error.message);
    stop();
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    if (!stopping) {
      process.exitCode = code || 1;
      stop();
    }
  });
  return child;
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
launch(["--import", "tsx", "apps/controller/src/server.ts"]);
launch(
  [
    resolve(root, "node_modules/next/dist/bin/next"),
    "dev",
    "--turbopack",
    "-p",
    "3100",
    "-H",
    "127.0.0.1",
  ],
  resolve(root, "apps/web"),
);
console.log("Cutaway: http://127.0.0.1:3100");
