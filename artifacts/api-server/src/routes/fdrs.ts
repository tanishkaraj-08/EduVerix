import { Router, type IRouter } from "express";
import { and, desc, eq, gte, ilike, inArray, lt, lte, notInArray, or } from "drizzle-orm";
import {
  ActOnFdrBody,
  ActOnFdrParams,
  ActOnFdrResponse,
  AddEvidenceBody,
  AddEvidenceParams,
  AddEvidenceResponse,
  CreateFdrBody,
  CreateFdrResponse,
  GetFdrParams,
  GetFdrResponse,
  ListFdrsQueryParams,
  ListFdrsResponse,
} from "@workspace/api-zod";
import type { FdrRecord } from "@workspace/api-zod";
import { db, appSettingsTable, evidenceTable, fdrsTable, institutionsTable } from "@workspace/db";
import { getDemoRole, getDemoSession, requireDemoRoles, type DemoRole } from "../lib/demo-auth";
import { getFdrDetail, logActivity, mapFdrRecords } from "../lib/fdr-data";

const router: IRouter = Router();
const staffRoles: DemoRole[] = ["regulation_officer", "supervisor", "administrator"];
const institutionActions = new Set(["submit", "request_renewal", "request_release"]);
const allowedEvidenceTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const stateForAction: Record<string, string> = {
  submit: "submitted",
  start_review: "under_review",
  verify: "verified",
  reject: "rejected",
  request_correction: "correction_required",
  request_renewal: "renewal_pending",
  request_release: "release_requested",
  mark_released: "released",
  close: "closed",
};
const nextActionForStatus: Record<string, string> = {
  draft: "Complete and submit the FDR record",
  submitted: "Review submitted evidence",
  under_review: "Complete officer verification",
  correction_required: "Institution to provide requested corrections",
  verified: "Monitor maturity date",
  rejected: "Institution to review the decision",
  renewal_pending: "Review replacement FDR evidence",
  release_requested: "Review release request",
  released: "Close the completed release case",
  closed: "No further action required",
};

function dateOnly(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

router.get("/fdrs", async (req, res): Promise<void> => {
  const query = ListFdrsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const session = await getDemoSession(req);
  const filters = [];
  if (session.role === "institution_user") {
    if (!session.institutionId) {
      res.json(ListFdrsResponse.parse({ items: [], total: 0, page: query.data.page, pageSize: query.data.pageSize }));
      return;
    }
    filters.push(eq(fdrsTable.institutionId, session.institutionId));
  }
  if (query.data.institutionId) {
    filters.push(eq(fdrsTable.institutionId, query.data.institutionId));
  }
  if (query.data.status) filters.push(eq(fdrsTable.status, query.data.status));
  if (query.data.attention) {
    const today = new Date().toISOString().slice(0, 10);
    const settings = await db.select().from(appSettingsTable).limit(1);
    const warningLimit = new Date();
    warningLimit.setUTCDate(warningLimit.getUTCDate() + (settings[0]?.maturityWarningDays ?? 60));
    const warningDate = warningLimit.toISOString().slice(0, 10);
    const active = notInArray(fdrsTable.status, ["released", "closed"]);
    if (query.data.attention === "pending") {
      filters.push(inArray(fdrsTable.status, ["submitted", "under_review", "correction_required"]));
    } else if (query.data.attention === "maturing") {
      filters.push(and(gte(fdrsTable.maturityDate, today), lte(fdrsTable.maturityDate, warningDate), active)!);
    } else if (query.data.attention === "overdue") {
      filters.push(and(lt(fdrsTable.maturityDate, today), active)!);
    } else {
      filters.push(
        or(
          eq(fdrsTable.riskLevel, "high"),
          and(lte(fdrsTable.maturityDate, warningDate), active)!,
        )!,
      );
    }
  }
  if (query.data.q?.trim()) {
    const term = `%${query.data.q.trim()}%`;
    filters.push(
      or(
        ilike(fdrsTable.id, term),
        ilike(fdrsTable.referenceNumber, term),
        ilike(fdrsTable.bankName, term),
        ilike(fdrsTable.branchName, term),
      )!,
    );
  }
  const rows = filters.length
    ? await db.select().from(fdrsTable).where(and(...filters)).orderBy(desc(fdrsTable.updatedAt))
    : await db.select().from(fdrsTable).orderBy(desc(fdrsTable.updatedAt));
  const items = await mapFdrRecords(rows);
  const sortBy = query.data.sortBy ?? "maturityDate";
  const direction = query.data.sortOrder === "desc" ? -1 : 1;
  const sortedItems = [...items].sort((left, right) => {
    let comparison = 0;
    if (sortBy === "amount") comparison = left.amount - right.amount;
    else if (sortBy === "maturityDate") {
      const leftDate = left.maturityDate instanceof Date
        ? left.maturityDate.getTime()
        : Date.parse(String(left.maturityDate));
      const rightDate = right.maturityDate instanceof Date
        ? right.maturityDate.getTime()
        : Date.parse(String(right.maturityDate));
      comparison = leftDate - rightDate;
    } else {
      const leftValue = String(left[sortBy as keyof FdrRecord] ?? "");
      const rightValue = String(right[sortBy as keyof FdrRecord] ?? "");
      comparison = leftValue.localeCompare(rightValue, "en", { numeric: true, sensitivity: "base" });
    }
    return comparison * direction;
  });
  const start = (query.data.page - 1) * query.data.pageSize;
  res.json(
    ListFdrsResponse.parse({
      items: sortedItems.slice(start, start + query.data.pageSize),
      total: sortedItems.length,
      page: query.data.page,
      pageSize: query.data.pageSize,
    }),
  );
});

router.post(
  "/fdrs",
  requireDemoRoles("institution_user", "administrator"),
  async (req, res): Promise<void> => {
    const parsed = CreateFdrBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const session = await getDemoSession(req);
    const role = getDemoRole(req);
    const issueDate = dateOnly(parsed.data.issueDate);
    const maturityDate = dateOnly(parsed.data.maturityDate);
    if (issueDate >= maturityDate || issueDate > new Date().toISOString().slice(0, 10)) {
      res.status(400).json({ error: "Issue date must be on or before today and earlier than the maturity date." });
      return;
    }
    const institutionId =
      role === "institution_user" ? session.institutionId : parsed.data.institutionId;
    if (!institutionId) {
      res.status(400).json({ error: "Register or select an institution before submitting an FDR." });
      return;
    }
    const [institution] = await db
      .select()
      .from(institutionsTable)
      .where(eq(institutionsTable.id, institutionId))
      .limit(1);
    if (!institution) {
      res.status(404).json({ error: "Institution not found." });
      return;
    }

    const existingRecords = await db.select().from(fdrsTable);
    const duplicate = existingRecords.find(
      (record) =>
        record.bankName.trim().toLowerCase() === parsed.data.bankName.trim().toLowerCase() &&
        record.referenceNumber.trim().toLowerCase() === parsed.data.referenceNumber.trim().toLowerCase(),
    );
    const id = `FDR-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const duplicateReason = duplicate
      ? `Potential duplicate reference — supervisor review required (matches ${duplicate.id}).`
      : null;
    await db.insert(fdrsTable).values({
      id,
      institutionId,
      bankName: parsed.data.bankName.trim(),
      branchName: parsed.data.branchName.trim(),
      referenceNumber: parsed.data.referenceNumber.trim(),
      amount: Number(parsed.data.amount).toFixed(2),
      currency: parsed.data.currency ?? "INR",
      issueDate,
      maturityDate,
      status: "submitted",
      assignedOfficer: "Rohan Mehta",
      riskLevel: duplicate ? "high" : "medium",
      riskReason: duplicateReason,
      nextAction: duplicate ? "Investigate potential duplicate reference" : "Review submitted evidence",
      duplicateOfId: duplicate?.id ?? null,
    });
    await logActivity({
      actor: session.fullName,
      role,
      action: duplicate ? "FDR submitted — duplicate flagged" : "FDR submitted",
      details: duplicate
        ? `Submitted ${id}; it is flagged as a potential duplicate of ${duplicate.id}.`
        : `Submitted ${id} for officer verification.`,
      recordId: id,
      institutionId,
      institutionName: institution.name,
    });

    const detail = await getFdrDetail(id);
    if (!detail) {
      res.status(500).json({ error: "The FDR was saved but its detail could not be loaded." });
      return;
    }
    res.status(201).json(CreateFdrResponse.parse(detail));
  },
);

router.get("/fdrs/:recordId", async (req, res): Promise<void> => {
  const params = GetFdrParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const detail = await getFdrDetail(params.data.recordId);
  if (!detail) {
    res.status(404).json({ error: "FDR record not found." });
    return;
  }
  const session = await getDemoSession(req);
  if (session.role === "institution_user" && detail.record.institutionId !== session.institutionId) {
    res.status(403).json({ error: "Institution users can only view their own FDR records." });
    return;
  }
  res.json(GetFdrResponse.parse(detail));
});

router.post("/fdrs/:recordId/actions", async (req, res): Promise<void> => {
  const params = ActOnFdrParams.safeParse(req.params);
  const parsed = ActOnFdrBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: params.error?.message ?? parsed.error?.message ?? "Invalid request." });
    return;
  }

  const detail = await getFdrDetail(params.data.recordId);
  if (!detail) {
    res.status(404).json({ error: "FDR record not found." });
    return;
  }
  const role = getDemoRole(req);
  const session = await getDemoSession(req);
  if (role === "institution_user") {
    if (detail.record.institutionId !== session.institutionId || !institutionActions.has(parsed.data.action)) {
      res.status(403).json({ error: "This action is not available for the active institution account." });
      return;
    }
  } else if (!staffRoles.includes(role)) {
    res.status(403).json({ error: "This action is not available for the active demo role." });
    return;
  }

  const { action, reason, note, missingEvidence, assignedOfficer } = parsed.data;
  if ((action === "reject" || action === "request_correction") && !reason?.trim()) {
    res.status(400).json({ error: "A reason is required for rejection and correction requests." });
    return;
  }
  if (action === "add_note" && !note?.trim()) {
    res.status(400).json({ error: "Add a review note before saving." });
    return;
  }
  if (action === "assign" && !assignedOfficer?.trim()) {
    res.status(400).json({ error: "Choose an officer to assign this record." });
    return;
  }
  if (action === "assign" && role !== "supervisor" && role !== "administrator") {
    res.status(403).json({ error: "Only supervisors and administrators can assign cases." });
    return;
  }

  const currentStatus = detail.record.status;
  const validTransitions: Record<string, string[]> = {
    submit: ["draft", "correction_required", "rejected"],
    start_review: ["submitted", "renewal_pending", "release_requested"],
    verify: ["under_review"],
    reject: ["under_review"],
    request_correction: ["submitted", "under_review"],
    request_renewal: ["verified"],
    request_release: ["verified"],
    mark_released: ["release_requested"],
    close: ["released", "rejected"],
  };
  const allowedCurrent = validTransitions[action];
  if (allowedCurrent && !allowedCurrent.includes(currentStatus)) {
    res.status(400).json({ error: `Cannot ${action.replaceAll("_", " ")} a record in ${currentStatus.replaceAll("_", " ")} status.` });
    return;
  }

  const nextStatus = stateForAction[action];
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (nextStatus) {
    updateData.status = nextStatus;
    updateData.nextAction = nextActionForStatus[nextStatus];
  }
  if (action === "assign") {
    updateData.assignedOfficer = assignedOfficer?.trim();
    updateData.nextAction = nextActionForStatus[currentStatus];
  }
  await db.update(fdrsTable).set(updateData).where(eq(fdrsTable.id, detail.record.id));

  const actionLabel = action.replaceAll("_", " ");
  const detailParts = [
    `${session.fullName} ${actionLabel} ${detail.record.id}.`,
    reason?.trim() ? `Reason: ${reason.trim()}` : "",
    note?.trim() ? `Note: ${note.trim()}` : "",
    missingEvidence?.length ? `Missing evidence: ${missingEvidence.join(", ")}.` : "",
    action === "assign" ? `Assigned to ${assignedOfficer}.` : "",
  ].filter(Boolean);
  await logActivity({
    actor: session.fullName,
    role,
    action: actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1),
    details: detailParts.join(" "),
    recordId: detail.record.id,
    institutionId: detail.record.institutionId,
    institutionName: detail.institution.name,
  });

  const updated = await getFdrDetail(detail.record.id);
  if (!updated) {
    res.status(500).json({ error: "The action was recorded but the FDR could not be reloaded." });
    return;
  }
  res.json(ActOnFdrResponse.parse(updated));
});

router.post(
  "/fdrs/:recordId/evidence",
  requireDemoRoles("institution_user", "administrator"),
  async (req, res): Promise<void> => {
    const params = AddEvidenceParams.safeParse(req.params);
    const parsed = AddEvidenceBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: params.error?.message ?? parsed.error?.message ?? "Invalid request." });
      return;
    }
    const detail = await getFdrDetail(params.data.recordId);
    if (!detail) {
      res.status(404).json({ error: "FDR record not found." });
      return;
    }
    const session = await getDemoSession(req);
    const role = getDemoRole(req);
    if (role === "institution_user" && detail.record.institutionId !== session.institutionId) {
      res.status(403).json({ error: "Institution users can only add evidence to their own FDR records." });
      return;
    }
    if (!allowedEvidenceTypes.has(parsed.data.contentType.toLowerCase())) {
      res.status(400).json({ error: "Only PDF, PNG and JPEG evidence metadata is accepted." });
      return;
    }
    if (parsed.data.sizeBytes > 15 * 1024 * 1024) {
      res.status(400).json({ error: "Evidence must be 15 MB or smaller." });
      return;
    }
    const [previous] = await db
      .select()
      .from(evidenceTable)
      .where(and(eq(evidenceTable.recordId, detail.record.id), eq(evidenceTable.evidenceType, parsed.data.evidenceType)))
      .orderBy(desc(evidenceTable.uploadedAt))
      .limit(1);
    const [created] = await db
      .insert(evidenceTable)
      .values({
        id: crypto.randomUUID(),
        recordId: detail.record.id,
        evidenceType: parsed.data.evidenceType,
        fileName: parsed.data.fileName,
        contentType: parsed.data.contentType,
        sizeBytes: parsed.data.sizeBytes,
        status: "simulated_upload",
        previousVersionId: previous?.id ?? null,
      })
      .returning();
    await logActivity({
      actor: session.fullName,
      role,
      action: "Evidence metadata added",
      details: `${created.fileName} was recorded as simulated evidence metadata. File bytes were not stored.`,
      recordId: detail.record.id,
      institutionId: detail.record.institutionId,
      institutionName: detail.institution.name,
    });
    res.status(201).json(AddEvidenceResponse.parse(created));
  },
);

export default router;
