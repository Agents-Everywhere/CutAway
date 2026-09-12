import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export function repositoryRoot() {
  return (
    process.env.CUTAWAY_ROOT ||
    resolve(process.cwd(), process.cwd().endsWith("/apps/web") ? "../.." : ".")
  );
}

export async function controllerToken() {
  return (
    process.env.CUTAWAY_CONTROLLER_TOKEN ||
    (
      await readFile(
        resolve(repositoryRoot(), ".cutaway/config/controller-token"),
        "utf8",
      )
    ).trim()
  );
}

export async function controllerFetch(path: string, body?: unknown) {
  const port = Number(process.env.CUTAWAY_CONTROLLER_PORT || 4310);
  return fetch(`http://127.0.0.1:${port}/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cutaway-controller-token": await controllerToken(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
}
