import { authorizeOrigin, CutawayHttpError } from "@/lib/server/cutaway/http";
import {
  operatorAuth,
  operatorCookie,
} from "@/lib/server/cutaway/operator-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    authorizeOrigin(request);
    const form = await request.formData();
    const logout = form.get("action") === "logout";
    if (logout) await operatorAuth.authorize(request);
    const session = logout
      ? ""
      : await operatorAuth.login(form.get("password"));
    return new Response(null, {
      status: 303,
      headers: {
        Location: "/",
        "Set-Cookie": operatorCookie(session, request),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return new Response(null, {
      status: 303,
      headers: {
        Location: `/operator?error=${error instanceof CutawayHttpError && error.status === 503 ? "setup" : "invalid"}`,
        "Cache-Control": "no-store",
      },
    });
  }
}
