import { CutawayHttpError, safeError } from "@/lib/server/cutaway/http";
import { operatorAuth } from "@/lib/server/cutaway/operator-auth";
import { controllerFetch } from "@/lib/server/cutaway/controller";
import {
  readWorkOrder,
  saveWorkOrderReport,
} from "@/lib/server/cutaway/workorder";
import { voiceToken } from "@/lib/server/cutaway/voice-token";

export const runtime = "nodejs";
const mutations = new Set([
  "experiments",
  "repairs",
  "approval-intents",
  "apply",
  "reset",
  "restored",
]);
async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    await operatorAuth.authorize(request);
    const path = (await context.params).path.join("/");
    let response: Response;
    if (request.method === "GET" && path === "workorder")
      response = await readWorkOrder();
    else if (request.method === "POST" && path === "report")
      response = await saveWorkOrderReport(request);
    else if (request.method === "POST" && path === "voice-token")
      response = await voiceToken();
    else if (request.method === "GET" && path === "state")
      response = await controllerFetch(path);
    else if (request.method === "POST" && mutations.has(path)) {
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        throw new CutawayHttpError("Expected a JSON action.");
      response = await controllerFetch(path, await request.json());
    } else throw new CutawayHttpError("Unknown Cutaway action.", 404);
    const headers = new Headers(response.headers);
    headers.set("cache-control", "no-store");
    return new Response(response.body, { status: response.status, headers });
  } catch (error) {
    return safeError(error);
  }
}
export const GET = handle;
export const POST = handle;
