import { randomUUID } from "node:crypto";
import {
  CopilotRuntime,
  createCopilotHonoHandler,
} from "@copilotkit/runtime/v2";
import { makeAgent } from "agent-core";
import { MOBILE_FINANCE_PROMPT } from "agent-core/mobile-finance-prompt";
import { withOperatorAuthorization } from "@/lib/server/cutaway/operator-auth";

const runtime = new CopilotRuntime({
  agents: () => ({
    default: makeAgent(randomUUID(), {
      workplace: false,
      prompt: MOBILE_FINANCE_PROMPT,
    }),
  }),
});

const app = createCopilotHonoHandler({
  runtime,
  basePath: "/api/mobile-copilotkit",
});

const handler = withOperatorAuthorization((request: Request) =>
  app.fetch(request),
);
export const GET = handler;
export const POST = handler;
export const OPTIONS = handler;
