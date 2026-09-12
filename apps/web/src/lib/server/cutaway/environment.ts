import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { repositoryRoot } from "./controller";

const keys = [
  "OPENAI_API_KEY",
  "OPENROUTER_API_KEY",
  "OPENROUTER_KEY",
  "MODEL",
  "MODEL_PROVIDER",
  "OPENROUTER_REASONING_EFFORT",
  "AMBIGUOUS_API_KEY",
  "CUTAWAY_OPERATOR_PASSWORD",
];

/** Pick up credentials added during local setup without restarting an active repair. */
export async function loadLocalEnvironment() {
  const path = resolve(repositoryRoot(), ".env");
  const source = await readFile(path, "utf8").catch(() => "");
  const values = parseEnv(source);
  for (const key of keys)
    if (values[key] !== undefined) process.env[key] = values[key];
}
