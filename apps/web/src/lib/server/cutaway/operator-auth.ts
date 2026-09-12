import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { controllerToken } from "./controller";
import { loadLocalEnvironment } from "./environment";
import { authorizeOrigin, CutawayHttpError, safeError } from "./http";

export const operatorCookieName = "cutaway-operator";
const sessionSeconds = 8 * 60 * 60;
type Credentials = { password: string; secret: string };

function equal(left: string, right: string) {
  return timingSafeEqual(
    createHash("sha256").update(left).digest(),
    createHash("sha256").update(right).digest(),
  );
}

function sign(payload: string, credentials: Credentials) {
  return createHmac("sha256", credentials.secret)
    .update(`cutaway-operator:${credentials.password}:${payload}`)
    .digest("base64url");
}

export function createOperatorAuth(
  credentials: () => Promise<Credentials>,
  now = () => Math.floor(Date.now() / 1000),
) {
  async function configured() {
    const value = await credentials();
    if (!value.password || !value.secret)
      throw new CutawayHttpError("Operator access is not configured.", 503);
    return value;
  }

  async function isOperator(cookie: string | undefined) {
    if (!cookie) return false;
    const value = await configured();
    const match = /^(\d+)\.([a-zA-Z0-9_-]{32})\.([a-zA-Z0-9_-]{43})$/.exec(
      cookie,
    );
    if (!match) return false;
    const expires = Number(match[1]);
    return (
      expires > now() &&
      expires <= now() + sessionSeconds &&
      equal(match[3], sign(`${match[1]}.${match[2]}`, value))
    );
  }

  async function login(password: unknown) {
    const value = await configured();
    if (
      typeof password !== "string" ||
      password.length > 1024 ||
      !equal(password, value.password)
    )
      throw new CutawayHttpError("Incorrect operator password.", 401);
    const payload = `${now() + sessionSeconds}.${randomBytes(24).toString("base64url")}`;
    return `${payload}.${sign(payload, value)}`;
  }

  async function authorize(request: Request) {
    authorizeOrigin(request);
    const cookie = request.headers
      .get("cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${operatorCookieName}=`))
      ?.slice(operatorCookieName.length + 1);
    if (!(await isOperator(cookie)))
      throw new CutawayHttpError("Sign in as an operator to use Cutaway.", 401);
  }

  return { login, isOperator, authorize };
}

export const operatorAuth = createOperatorAuth(async () => {
  await loadLocalEnvironment();
  return {
    password: process.env.CUTAWAY_OPERATOR_PASSWORD || "",
    secret: await controllerToken(),
  };
});

export function operatorCookie(value: string, request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${operatorCookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${value ? sessionSeconds : 0}${secure}`;
}

export function withOperatorAuthorization<Context>(
  handler: (request: Request, context: Context) => Response | Promise<Response>,
) {
  return async (request: Request, context: Context) => {
    try {
      await operatorAuth.authorize(request);
      const response = await handler(request, context);
      const headers = new Headers(response.headers);
      headers.set("cache-control", "no-store");
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      return safeError(error);
    }
  };
}
