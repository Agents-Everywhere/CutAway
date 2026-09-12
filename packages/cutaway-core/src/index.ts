/** Core demo starting contracts. Implement only the boundaries used by the app. */
export type RunId = string;
export type Digest = string;
export type EvidenceId = string;
export type TargetId = "fieldnote";
export type Stage =
  | "idle"
  | "reproducing"
  | "reproduced"
  | "editing"
  | "verifying"
  | "ready"
  | "previewing"
  | "awaiting-approval"
  | "applying"
  | "applied"
  | "blocked"
  | "failed"
  | "resetting";
export type Surface = "current" | "preview";
export interface TargetContext {
  protocol: 1;
  runId: RunId;
  targetId: TargetId;
  targetRevision: Digest;
  route: string; // validated local relative route
  eventId: string;
  selected: {
    id: "booking.capacity" | "booking.submit" | "booking.reservations";
    label: string;
    sourceKey: string;
    rect: { x: number; y: number; width: number; height: number };
  } | null;
  surface: Surface;
}
export type FrameMessage =
  | { protocol: 1; type: "hello"; runId: RunId; revision: Digest }
  | { protocol: 1; type: "open"; runId: RunId }
  | { protocol: 1; type: "context"; context: TargetContext }
  | {
      protocol: 1;
      type: "restored";
      runId: RunId;
      revision: Digest;
      eventId: string;
    };
export type HostMessage =
  | { protocol: 1; type: "select"; runId: RunId; enabled: boolean }
  | {
      protocol: 1;
      type: "restore";
      runId: RunId;
      route: string;
      eventId: string;
      selectedId: string | null;
    };
export interface ExperimentRequest {
  requestId: string;
  runId: RunId;
  revision: Digest;
  eventId: string;
  participants: 2;
  surface: Surface;
}
export interface ReservationOutcome {
  actor: string;
  requestId: string;
  status: number;
  reservationId: string | null;
  result: "confirmed" | "sold-out" | "error";
}
export interface ExperimentEvidence {
  id: EvidenceId;
  runId: RunId;
  revision: Digest;
  startedAt: string;
  completedAt: string;
  eventId: string;
  availableBefore: number;
  requests: ReservationOutcome[];
  rowsBefore: number;
  rowsAfter: number;
  successfulResponses: number;
  newReservations: number;
  existingRecordsPreserved: boolean;
  invariant: "passed" | "violated" | "not-evaluated";
  artifacts: string[]; // controller-resolved relative artifact IDs, not arbitrary paths
}
export interface RepairRequest {
  requestId: string;
  runId: RunId;
  context: TargetContext;
  instruction: string;
  evidenceId: EvidenceId;
}
export interface Verification {
  id: string;
  runId: RunId;
  candidateDigest: Digest;
  artifactDigest: Digest;
  passed: boolean;
  checks: Array<{
    id: string;
    passed: boolean;
    detail: string;
    evidenceId: string | null;
  }>;
}
export interface Candidate {
  runId: RunId;
  digest: Digest;
  artifactDigest: Digest;
  baseReleaseId: Digest;
  verificationId: string;
  changedPaths: string[];
  summary: string;
  previewUrl: string; // allowlisted controller-owned local URL
}
export interface ApprovalIntent {
  id: string;
  runId: RunId;
  candidateDigest: Digest;
  artifactDigest: Digest;
  verificationId: string;
  baseReleaseId: Digest;
  workOrderReport: null | { taskId: string; reportTemplateDigest: Digest };
}
export interface ApplyRequest {
  requestId: string;
  runId: RunId;
  approvalIntentId: string; // issued server-side for the displayed candidate
  decision: "approve" | "decline";
}
export interface DeploymentReceipt {
  runId: RunId;
  releaseId: Digest;
  previousReleaseId: Digest;
  appliedAt: string;
  healthy: boolean;
  contextRestored: boolean;
  existingRecordsPreserved: boolean;
  scope: "local-demo";
}
export interface WorkOrder {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  url: string | null; // provider supplied and allowlisted, never invented
}
export interface WorkOrderReceipt {
  taskId: string;
  runId: RunId;
  candidateDigest: Digest;
  reportMarker: string;
  saved: boolean;
  readBackAt: string | null;
  url: string | null;
}
export interface TaskSnapshot {
  runId: RunId;
  stage: Stage;
  sequence: number;
  context: TargetContext | null;
  evidenceIds: EvidenceId[];
  evidence: ExperimentEvidence | null;
  verification: Verification | null;
  workOrder: WorkOrder | null;
  candidate: Candidate | null;
  deployment: DeploymentReceipt | null;
  workOrderReceipt: WorkOrderReceipt | null;
  error: { code: string; message: string } | null;
}
/** Optional streaming transport; snapshot polling is sufficient for the demo. */
export type EventPayload =
  | { type: "state"; snapshot: TaskSnapshot }
  | {
      type: "activity";
      kind: "reading" | "running-command" | "editing" | "checking";
      text: string;
    }
  | { type: "evidence"; evidence: ExperimentEvidence }
  | { type: "candidate"; candidate: Candidate; verification: Verification }
  | {
      type: "deployment";
      phase:
        | "draining"
        | "stopping"
        | "starting"
        | "checking"
        | "restoring"
        | "complete";
    }
  | { type: "workorder"; receipt: WorkOrderReceipt };
export interface TaskEvent {
  runId: RunId;
  sequence: number;
  timestamp: string;
  payload: EventPayload;
}
export interface Accepted {
  runId: RunId;
  requestId: string;
  status: "accepted";
}
export interface ApiError {
  code: string;
  message: string;
  runId?: RunId;
}
export interface CodingWorkerInput {
  runId: RunId;
  instruction: string;
  context: TargetContext;
  evidence: ExperimentEvidence;
}
export interface CodingWorkerResult {
  runId: RunId;
  status: "edited" | "blocked";
  summary: string;
  changedPaths: string[];
  threadId: string | null;
}
