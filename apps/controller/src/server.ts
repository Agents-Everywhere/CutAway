import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { ControllerError, CutawayController } from "./controller.js";

const repository = fileURLToPath(new URL("../../../", import.meta.url));
const token = process.env.CUTAWAY_CONTROLLER_TOKEN;
if (!token || token.length < 24)
  throw new Error(
    "Set CUTAWAY_CONTROLLER_TOKEN to a random value of at least 24 characters.",
  );
const expectedToken = Buffer.from(token);
const controller = new CutawayController(repository);

const text = z.string().min(1).max(500);
const contextSchema = z.object({
  protocol: z.literal(1),
  runId: text,
  targetId: z.literal("fieldnote"),
  targetRevision: text,
  route: z
    .string()
    .max(500)
    .regex(/^\/(?!\/)/),
  eventId: z.literal("pottery-saturday"),
  surface: z.enum(["current", "preview"]),
  selected: z
    .object({
      id: z.enum([
        "booking.capacity",
        "booking.submit",
        "booking.reservations",
      ]),
      label: text,
      sourceKey: text,
      rect: z.object({
        x: z.number().finite(),
        y: z.number().finite(),
        width: z.number().nonnegative(),
        height: z.number().nonnegative(),
      }),
    })
    .nullable(),
});
const workOrderSchema = z.object({
  id: text,
  workspaceId: text,
  title: text,
  description: z.string().max(40_000),
  url: z.string().url().nullable(),
});
const receiptSchema = z.object({
  taskId: text,
  runId: text,
  candidateDigest: text,
  reportMarker: text,
  saved: z.boolean(),
  readBackAt: z.string().nullable(),
  url: z.string().url().nullable(),
});

async function body(request: IncomingMessage): Promise<unknown> {
  let content = "";
  for await (const chunk of request) {
    content += String(chunk);
    if (Buffer.byteLength(content) > 64_000)
      throw new ControllerError(
        "BODY_TOO_LARGE",
        "The request is too large.",
        413,
      );
  }
  try {
    return JSON.parse(content || "{}");
  } catch {
    throw new ControllerError("INVALID_JSON", "Send a JSON request body.", 400);
  }
}

function send(response: ServerResponse, status: number, data: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(data));
}

async function handle(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const supplied = request.headers["x-cutaway-controller-token"];
  if (
    typeof supplied !== "string" ||
    Buffer.byteLength(supplied) !== expectedToken.length ||
    !timingSafeEqual(Buffer.from(supplied), expectedToken)
  ) {
    send(response, 401, {
      code: "UNAUTHORIZED",
      message: "A trusted shell connection is required.",
    });
    return;
  }
  const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
  if (request.method === "GET" && path === "/state") {
    send(response, 200, controller.state);
    return;
  }
  if (request.method !== "POST") {
    send(response, 404, {
      code: "NOT_FOUND",
      message: "Unknown controller action.",
    });
    return;
  }
  const payload = await body(request);
  switch (path) {
    case "/experiments": {
      const input = z
        .object({
          eventId: text,
          participants: z.literal(2),
          surface: z.enum(["current", "preview"]),
        })
        .parse(payload);
      send(response, 202, controller.experiment(input));
      return;
    }
    case "/repairs": {
      const input = z
        .object({
          instruction: z.string().min(1).max(8_000),
          context: contextSchema,
          evidenceId: text,
        })
        .parse(payload);
      send(response, 202, controller.repair(input));
      return;
    }
    case "/approval-intents": {
      const input = z
        .object({
          candidateDigest: text,
          saveReport: z.boolean().default(false),
        })
        .parse(payload);
      send(
        response,
        200,
        controller.approval(input.candidateDigest, input.saveReport),
      );
      return;
    }
    case "/apply": {
      const input = z
        .object({
          approvalIntentId: text,
          decision: z.enum(["approve", "decline"]),
        })
        .parse(payload);
      send(
        response,
        202,
        controller.apply(input.approvalIntentId, input.decision),
      );
      return;
    }
    case "/restored": {
      const input = z
        .object({ runId: text, revision: text, eventId: text })
        .parse(payload);
      send(
        response,
        200,
        controller.restored(input.runId, input.revision, input.eventId),
      );
      return;
    }
    case "/report-receipt": {
      const input = z
        .object({ receipt: receiptSchema, workOrder: workOrderSchema })
        .parse(payload);
      send(
        response,
        200,
        controller.reportReceipt(input.receipt, input.workOrder),
      );
      return;
    }
    case "/reset": {
      send(response, 200, await controller.reset());
      return;
    }
    default:
      send(response, 404, {
        code: "NOT_FOUND",
        message: "Unknown controller action.",
      });
  }
}

const server = createServer((request, response) => {
  void handle(request, response).catch((error: unknown) => {
    if (error instanceof z.ZodError) {
      send(response, 400, {
        code: "INVALID_REQUEST",
        message: error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; "),
      });
    } else if (error instanceof ControllerError) {
      send(response, error.status, {
        code: error.code,
        message: error.message,
      });
    } else {
      console.error(
        "Controller request failed:",
        error instanceof Error ? error.message : "Unknown failure",
      );
      send(response, 500, {
        code: "CONTROLLER_ERROR",
        message: "The controller could not complete this action.",
      });
    }
  });
});

await controller.initialize();
server.listen(4310, "127.0.0.1", () =>
  console.log("Cutaway controller: http://127.0.0.1:4310"),
);
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close();
    void controller.close().finally(() => process.exit(0));
  });
}
