import { z } from "zod";
import type { TaskSnapshot, WorkOrder, WorkOrderReceipt } from "cutaway-core";
import { configuredWorkplace, type Workplace } from "../workplace";
import { controllerFetch } from "./controller";
import { CutawayHttpError } from "./http";

type Dependencies = {
  controller: typeof controllerFetch;
  connect: () => { workplace: Workplace; close(): Promise<void> };
};

export function createWorkOrderService({ controller, connect }: Dependencies) {
  async function usingWorkplace<T>(
    action: (workplace: Workplace) => Promise<T>,
  ) {
    const connection = connect();
    try {
      return await action(connection.workplace);
    } finally {
      await connection
        .close()
        .catch(() => console.warn("Ambiguous connection cleanup failed."));
    }
  }

  async function snapshot(): Promise<TaskSnapshot> {
    const response = await controller("state");
    if (!response.ok)
      throw new CutawayHttpError("The repair controller is unavailable.", 503);
    return response.json();
  }

  async function appliedSnapshot() {
    const state = await snapshot();
    if (
      state.stage !== "applied" ||
      !state.deployment?.healthy ||
      !state.deployment.contextRestored ||
      !state.deployment.existingRecordsPreserved ||
      !state.verification?.passed ||
      !state.candidate ||
      state.verification.candidateDigest !== state.deployment.releaseId ||
      state.candidate.digest !== state.deployment.releaseId
    ) {
      throw new CutawayHttpError(
        "Apply the verified repair and return to the app before saving its report.",
        409,
      );
    }
    return state;
  }

  async function readWorkOrder() {
    const state = await snapshot();
    if (!state.workOrder) return Response.json(null);
    const workOrder = await usingWorkplace(async (workplace) => ({
      ...(await workplace.get(state.workOrder!.id)),
      workspaceId: state.workOrder!.workspaceId,
    }));
    return Response.json(workOrder);
  }

  async function saveWorkOrderReport(request: Request) {
    const input = z
      .object({ runId: z.string().min(1), candidateDigest: z.string().min(1) })
      .parse(await request.json());
    const state = await appliedSnapshot();
    const currentRepair = (current: TaskSnapshot) => {
      if (
        input.runId !== current.runId ||
        input.candidateDigest !== current.deployment?.releaseId
      ) {
        throw new CutawayHttpError(
          "This report belongs to a different repair. Refresh the page.",
          409,
        );
      }
    };
    currentRepair(state);
    const marker = `Cutaway repair ${state.runId}/${input.candidateDigest}`;
    const report = [
      marker,
      "Fieldnote repair handoff · synthetic workshop records.",
      `Page: ${state.context?.route ?? "/workshops/pottery-saturday"}`,
      ...(state.evidence
        ? [
            `Observed: ${state.evidence.successfulResponses} successful booking responses for ${state.evidence.availableBefore} available place(s).`,
          ]
        : []),
      `Repair: ${state.candidate!.summary}`,
      `Changed source: ${state.candidate!.changedPaths.join(", ")}`,
      ...state.verification!.checks.map(
        (check) => `${check.passed ? "PASS" : "FAIL"}: ${check.detail}`,
      ),
      `Applied release: ${state.deployment!.releaseId}`,
      "Existing reservations preserved; operator returned to the workshop.",
      "Next: review the repair and monitor workshop bookings.",
    ].join("\n");
    const workOrder = await usingWorkplace(async (workplace) => {
      const identity = await workplace.identity();
      const existing = state.workOrder
        ? await workplace.get(state.workOrder.id)
        : (await workplace.list(marker)).find((record) =>
            record.description.includes(marker),
          );
      const created =
        existing ??
        (await workplace.create(
          "Fieldnote: booking repair applied — review and monitor",
          report,
          async () => currentRepair(await appliedSnapshot()),
        ));
      const readBack = await workplace.get(created.id);
      if (!readBack.description.includes(report)) {
        throw new CutawayHttpError(
          "The repair report has not been confirmed by Ambiguous.",
          502,
        );
      }
      return {
        ...readBack,
        workspaceId: identity.workspaceId,
      } satisfies WorkOrder;
    });
    currentRepair(await appliedSnapshot());
    const receipt: WorkOrderReceipt = {
      taskId: workOrder.id,
      runId: state.runId,
      candidateDigest: input.candidateDigest,
      reportMarker: marker,
      saved: true,
      readBackAt: new Date().toISOString(),
      url: workOrder.url,
    };
    const response = await controller("report-receipt", { workOrder, receipt });
    if (!response.ok)
      throw new CutawayHttpError(
        "Report saved remotely; retry Save report to confirm it in the app.",
        502,
      );
    return Response.json(receipt);
  }

  return { readWorkOrder, saveWorkOrderReport };
}

export const { readWorkOrder, saveWorkOrderReport } = createWorkOrderService({
  controller: controllerFetch,
  connect: configuredWorkplace,
});
