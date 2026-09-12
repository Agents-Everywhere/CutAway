import { createReadStream, existsSync, statSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { getEvent, listReservations, openDatabase } from "./database.js";
import { reserveSeat, type ReservationInput } from "./reservations.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const dist = process.env.FIELDNOTE_DIST_PATH ?? resolve(root, "dist");
const port = Number(process.env.PORT ?? 4120);
const revision = process.env.RELEASE_ID ?? "fieldnote-baseline";
const db = openDatabase(
  process.env.DB_PATH ?? resolve(root, ".data/fieldnote.sqlite"),
);

function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(value));
}

async function readBooking(
  req: IncomingMessage,
  eventId: string,
): Promise<ReservationInput | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 16_384) return null;
    chunks.push(buffer);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (
    typeof input.customerName !== "string" ||
    !input.customerName.trim() ||
    input.customerName.length > 120 ||
    typeof input.customerEmail !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.customerEmail) ||
    input.customerEmail.length > 254 ||
    typeof input.requestId !== "string" ||
    !input.requestId.trim() ||
    input.requestId.length > 120
  )
    return null;
  return {
    eventId,
    customerName: input.customerName.trim(),
    customerEmail: input.customerEmail.trim(),
    requestId: input.requestId,
  };
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  if (req.method === "GET" && path === "/health") {
    json(res, 200, { revision, ready: true });
    return;
  }
  if (req.method === "GET" && path === "/api/config") {
    json(res, 200, {
      revision,
      runId: process.env.RUN_ID ?? "standalone",
      shellOrigin: process.env.SHELL_ORIGIN ?? "http://localhost:3100",
    });
    return;
  }
  const match = /^\/api\/events\/([a-z0-9-]+)(\/reservations)?$/.exec(path);
  if (match) {
    const eventId = match[1];
    const event = getEvent(db, eventId);
    if (!event) {
      json(res, 404, { code: "NOT_FOUND", message: "Workshop not found." });
    } else if (req.method === "GET") {
      json(
        res,
        200,
        match[2] ? { reservations: listReservations(db, eventId) } : event,
      );
    } else if (req.method === "POST" && match[2]) {
      const input = await readBooking(req, eventId);
      if (!input) {
        json(res, 400, {
          code: "INVALID_REQUEST",
          message: "Provide a name, email and request ID.",
        });
        return;
      }
      const result = await reserveSeat(db, input);
      json(
        res,
        result.status,
        result.status === 201
          ? { reservation: result.reservation }
          : { code: result.code, message: result.message },
      );
    } else {
      json(res, 405, {
        code: "METHOD_NOT_ALLOWED",
        message: "Method not allowed.",
      });
    }
    return;
  }
  if (path.startsWith("/api/")) {
    json(res, 404, { code: "NOT_FOUND", message: "Endpoint not found." });
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    json(res, 405, {
      code: "METHOD_NOT_ALLOWED",
      message: "Method not allowed.",
    });
    return;
  }
  const requestedFile = resolve(dist, `.${path}`);
  if (requestedFile !== dist && !requestedFile.startsWith(`${dist}${sep}`)) {
    json(res, 400, { code: "INVALID_PATH", message: "Invalid asset path." });
    return;
  }
  const file =
    existsSync(requestedFile) && statSync(requestedFile).isFile()
      ? requestedFile
      : resolve(dist, "index.html");
  if (!existsSync(file)) {
    json(res, 503, {
      code: "BUILD_REQUIRED",
      message: "Run npm run build in examples/fieldnote first.",
    });
    return;
  }
  const contentTypes: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript",
    ".css": "text/css",
    ".svg": "image/svg+xml",
  };
  res.writeHead(200, {
    "Content-Type": contentTypes[extname(file)] ?? "application/octet-stream",
    "Cache-Control": "no-cache",
  });
  if (req.method === "HEAD") res.end();
  else createReadStream(file).pipe(res);
}

const server = createServer((req, res) => {
  void handle(req, res).catch((error: unknown) => {
    console.error(
      "Fieldnote request failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    if (!res.headersSent)
      json(res, 500, {
        code: "SERVER_ERROR",
        message: "The booking could not be completed.",
      });
    else res.end();
  });
});
server.listen(port, process.env.HOST ?? "127.0.0.1", () => {
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing server address");
  console.log(
    `FIELDNOTE_READY ${JSON.stringify({ port: address.port, revision })}`,
  );
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
