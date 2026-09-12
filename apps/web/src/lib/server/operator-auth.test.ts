import assert from "node:assert/strict";
import test from "node:test";
import {
  createOperatorAuth,
  operatorCookie,
  operatorCookieName,
} from "./cutaway/operator-auth";
import { CutawayHttpError } from "./cutaway/http";

const password = "test-operator-password";
const secret = "test-controller-secret";
const origin = "http://localhost:3100";

function request(path: string, method: string, cookie?: string, headers = {}) {
  return new Request(`${origin}${path}`, {
    method,
    headers: {
      origin,
      ...(cookie ? { cookie: `${operatorCookieName}=${cookie}` } : {}),
      ...headers,
    },
  });
}

function status(expected: number) {
  return (error: unknown) =>
    error instanceof CutawayHttpError && error.status === expected;
}

test("unauthenticated readers and callers cannot use operator services", async () => {
  const cutaway = await import("../../app/api/cutaway/[...path]/route");
  for (const [path, method] of [
    ["state", "GET"],
    ["workorder", "GET"],
    ["repairs", "POST"],
    ["apply", "POST"],
    ["report", "POST"],
    ["voice-token", "POST"],
  ] as const) {
    const response = await cutaway[method](
      request(`/api/cutaway/${path}`, method),
      {
        params: Promise.resolve({ path: [path] }),
      },
    );
    assert.equal(response.status, 401, `${method} ${path}`);
  }
  const routes = [
    [
      "copilotkit/agent/default/run",
      await import("../../app/api/copilotkit/[[...path]]/route"),
    ],
    [
      "mobile-copilotkit/agent/default/run",
      await import("../../app/api/mobile-copilotkit/[[...path]]/route"),
    ],
    ["realtime-token", await import("../../app/api/realtime-token/route")],
    ["search", await import("../../app/api/search/route")],
    ["followups", await import("../../app/api/followups/route")],
  ] as const;
  for (const [path, route] of routes) {
    const response = await route.POST(
      request(`/api/${path}`, "POST"),
      undefined,
    );
    assert.equal(response.status, 401, `POST ${path}`);
    if ("GET" in route)
      assert.equal(
        (await route.GET(request(`/api/${path}`, "GET"), undefined)).status,
        401,
        `GET ${path}`,
      );
  }
});

test("only a correct password issues a session that authorizes reads and actions", async () => {
  const auth = createOperatorAuth(async () => ({ password, secret }));
  await assert.rejects(auth.login("incorrect"), status(401));
  await assert.rejects(auth.login(null), status(401));
  const cookie = await auth.login(password);
  await auth.authorize(request("/api/cutaway/state", "GET", cookie));
  await auth.authorize(request("/api/cutaway/repairs", "POST", cookie));
  const header = operatorCookie(cookie, request("/", "GET"));
  assert.match(header, /HttpOnly; SameSite=Strict; Path=\/; Max-Age=28800/);
  assert.doesNotMatch(header, new RegExp(password));
  assert.match(operatorCookie("", request("/", "GET")), /Max-Age=0/);
});

test("modified, expired, and legacy cookies do not authorize operators", async () => {
  let seconds = 100_000;
  const auth = createOperatorAuth(
    async () => ({ password, secret }),
    () => seconds,
  );
  const cookie = await auth.login(password);
  const [expires, nonce, signature] = cookie.split(".");
  for (const invalid of [
    `${Number(expires) + 1}.${nonce}.${signature}`,
    `${expires}.${nonce}.${signature.slice(0, -1)}!`,
    "0".repeat(64),
    "",
  ])
    assert.equal(await auth.isOperator(invalid), false);
  seconds += 8 * 60 * 60;
  assert.equal(await auth.isOperator(cookie), false);
});

test("password changes revoke existing sessions and missing configuration fails closed", async () => {
  let credentials = { password, secret };
  const auth = createOperatorAuth(async () => credentials);
  const cookie = await auth.login(password);
  credentials = { password: "new-password", secret };
  assert.equal(await auth.isOperator(cookie), false);
  credentials = { password: "", secret };
  await assert.rejects(auth.login(""), status(503));
  await assert.rejects(auth.isOperator(cookie), status(503));
});

test("valid sessions cannot bypass the trusted-origin and CSRF checks", async () => {
  const auth = createOperatorAuth(async () => ({ password, secret }));
  const cookie = await auth.login(password);
  for (const headers of [
    { origin: "https://attacker.example" },
    { origin: "" },
    { host: "attacker.example", origin: "http://attacker.example" },
    { "sec-fetch-site": "cross-site" },
  ])
    await assert.rejects(
      auth.authorize(request("/api/cutaway/apply", "POST", cookie, headers)),
      status(403),
    );
  await assert.rejects(
    auth.authorize(
      request("/api/cutaway/state", "GET", cookie, {
        "sec-fetch-site": "cross-site",
      }),
    ),
    status(403),
  );
});
