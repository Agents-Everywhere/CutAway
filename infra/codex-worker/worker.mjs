import { readFile } from "node:fs/promises";
import { Codex } from "@openai/codex-sdk";

const input = JSON.parse(await readFile("/run/cutaway/input.json", "utf8"));
const instructions = await readFile("/run/cutaway/repair.md", "utf8");
const provider = process.env.MODEL_PROVIDER ?? "openrouter";
const model = process.env.CODEX_MODEL;
if (!model)
  throw new Error("Set CODEX_MODEL to a model supported by your provider.");
const env = Object.fromEntries(
  Object.entries(process.env).filter((entry) => typeof entry[1] === "string"),
);
const codex = new Codex({
  env,
  ...(provider === "openrouter"
    ? {
        config: {
          model_provider: "openrouter",
          model_providers: {
            openrouter: {
              name: "OpenRouter",
              base_url: "https://openrouter.ai/api/v1",
              env_key: "OPENROUTER_API_KEY",
              wire_api: "responses",
            },
          },
        },
      }
    : { apiKey: process.env.OPENAI_API_KEY }),
});
const thread = codex.startThread({
  model,
  workingDirectory: "/workspace",
  skipGitRepoCheck: true,
  sandboxMode: "workspace-write",
  approvalPolicy: "never",
  networkAccessEnabled: false,
  webSearchMode: "disabled",
  modelReasoningEffort: process.env.CODEX_REASONING_EFFORT ?? "max",
});
const { events } = await thread.runStreamed(
  `${instructions}\n\nREQUEST DATA:\n${JSON.stringify(input, null, 2)}`,
);
let summary = "";
for await (const event of events) {
  if (event.type === "turn.failed") throw new Error(event.error.message);
  if (event.type === "error") throw new Error(event.message);
  if (event.type === "item.started") {
    process.stdout.write(
      `${JSON.stringify({ type: "activity", kind: event.item.type })}\n`,
    );
  }
  if (event.type === "item.completed" && event.item.type === "agent_message")
    summary = event.item.text;
}
process.stdout.write(
  `${JSON.stringify({ type: "result", summary, threadId: thread.id })}\n`,
);
