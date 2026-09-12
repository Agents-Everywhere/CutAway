import type { ExperimentEvidence, Verification } from "cutaway-core";

export function EvidenceCard({
  evidence,
  compact = false,
  label = "Observed result",
}: {
  evidence: ExperimentEvidence | null;
  compact?: boolean;
  label?: string;
}) {
  if (!evidence)
    return <p className="ca-pending">Waiting for a measured booking result.</p>;
  const violated = evidence.invariant === "violated";
  return (
    <section
      className={`ca-result ${violated ? "ca-result--warning" : ""}`}
      aria-label="Observed booking evidence"
    >
      <div className="ca-card-heading">
        <span className="ca-eyebrow">{label}</span>
        <span className={`ca-chip ${violated ? "ca-chip--amber" : ""}`}>
          {violated
            ? "Overbooked"
            : evidence.invariant === "passed"
              ? "Capacity respected"
              : "Needs review"}
        </span>
      </div>
      <div className="ca-evidence-count">
        <strong>{evidence.successfulResponses}</strong>
        <span>
          confirmations
          <br />
          for <b>{evidence.availableBefore}</b> available{" "}
          {evidence.availableBefore === 1 ? "place" : "places"}
        </span>
      </div>
      {!compact && (
        <div className="ca-outcomes">
          {evidence.requests.map((outcome) => (
            <div key={outcome.requestId}>
              <span>{outcome.actor}</span>
              <span className={outcome.result === "sold-out" ? "ca-muted" : ""}>
                {outcome.result === "confirmed"
                  ? "Confirmed"
                  : outcome.result === "sold-out"
                    ? "Sold out"
                    : "Error"}
                <small>HTTP {outcome.status}</small>
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="ca-footnote">
        {evidence.newReservations} new database{" "}
        {evidence.newReservations === 1 ? "row" : "rows"} ·{" "}
        {evidence.existingRecordsPreserved
          ? "Existing booking preserved"
          : "Existing booking requires review"}
      </p>
    </section>
  );
}

export function VerificationCard({
  verification,
}: {
  verification: Verification | null;
}) {
  if (!verification)
    return <p className="ca-pending">Independent checks have not completed.</p>;
  return (
    <div className="ca-verification">
      <div className="ca-card-heading">
        <span className="ca-eyebrow">Independent checks</span>
        <span className="ca-chip">
          {verification.checks.filter((check) => check.passed).length}/
          {verification.checks.length} passed
        </span>
      </div>
      <ul>
        {verification.checks.map((check) => (
          <li key={check.id}>
            <span
              className={check.passed ? "ca-check" : "ca-check ca-check--fail"}
              aria-label={check.passed ? "Passed" : "Failed"}
            >
              {check.passed ? "✓" : "!"}
            </span>
            <span>{check.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
