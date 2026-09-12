export class CutawayHttpError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function authorizeOrigin(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("host") || url.host;
  const port = process.env.CUTAWAY_SHELL_PORT || "3100";
  if (!["localhost", "127.0.0.1"].some((name) => host === `${name}:${port}`)) {
    throw new CutawayHttpError(
      "Open Cutaway on its local application address.",
      403,
    );
  }
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (!["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      request.headers.get("origin") !== `${url.protocol}//${host}`)
  ) {
    throw new CutawayHttpError(
      "Use the controls from this app's own page.",
      403,
    );
  }
}

export function safeError(error: unknown) {
  if (error instanceof CutawayHttpError)
    return Response.json({ error: error.message }, { status: error.status });
  return Response.json(
    {
      error:
        "Cutaway could not complete this operation. Check the local services and account configuration.",
    },
    { status: 503 },
  );
}
