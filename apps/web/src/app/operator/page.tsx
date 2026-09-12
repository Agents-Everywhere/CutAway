import { cookies } from "next/headers";
import {
  operatorAuth,
  operatorCookieName,
} from "@/lib/server/cutaway/operator-auth";
import "./operator.css";

export default async function OperatorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const operator = await operatorAuth
    .isOperator((await cookies()).get(operatorCookieName)?.value)
    .catch(() => false);
  const error = (await searchParams).error;
  return (
    <main className="operator-page">
      <a className="operator-brand" href="/">
        f. <span>fieldnote</span>
      </a>
      <section className="operator-card">
        <p className="operator-eyebrow">FIELDNOTE STUDIO · STAFF ACCESS</p>
        <h1>{operator ? "You’re signed in." : "Operator sign in"}</h1>
        <p>
          Cutaway is available to studio operators. Customers use the booking
          site without repair controls.
        </p>
        {operator ? (
          <>
            <a className="operator-primary" href="/">
              Open Fieldnote with Cutaway
            </a>
            <form action="/api/operator/session" method="post">
              <input type="hidden" name="action" value="logout" />
              <button className="operator-secondary" type="submit">
                Sign out
              </button>
            </form>
          </>
        ) : (
          <form action="/api/operator/session" method="post">
            <label htmlFor="password">Operator password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
            />
            {error && (
              <p className="operator-error" role="alert">
                {error === "setup"
                  ? "Operator access is not configured yet."
                  : "Sign-in failed. Check your password and try again."}
              </p>
            )}
            <button className="operator-primary" type="submit">
              Sign in to Fieldnote
            </button>
          </form>
        )}
        <a className="operator-back" href="/">
          Back to bookings
        </a>
      </section>
    </main>
  );
}
