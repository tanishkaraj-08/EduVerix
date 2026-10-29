import { desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  activityTable,
  evidenceTable,
  fdrsTable,
  institutionsTable,
  type ActivityRow,
  type FdrRow,
  type InstitutionRow,
} from "@workspace/db";
import type { ActivityEvent, Evidence, FdrDetail, FdrRecord, Institution } from "@workspace/api-zod";

export const pendingStatuses = new Set([
  "submitted",
  "under_review",
  "correction_required",
  "renewal_pending",
  "release_requested",
]);

export function mapInstitution(row: InstitutionRow, records: FdrRow[] = []): Institution {
  return {
    ...row,
    fdrCount: records.filter((record) => record.institutionId === row.id).length,
    openIssues: records.filter(
      (record) =>
        record.institutionId === row.id &&
        (record.riskLevel === "high" || record.status === "correction_required"),
    ).length,
  };
}

export function mapActivity(row: ActivityRow): ActivityEvent {
  return {
    id: row.id,
    actor: row.actor,
    role: row.role as ActivityEvent["role"],
    action: row.action,
    details: row.details,
    recordId: row.recordId,
    institutionName: row.institutionName,
    createdAt: row.createdAt,
  };
}

export function mapFdrRecord(
  row: FdrRow,
  institution: InstitutionRow,
  evidenceCount: number,
): FdrRecord {
  return {
    id: row.id,
    institutionId: row.institutionId,
    institutionIdentifier: institution.identifier,
    institutionName: institution.name,
    bankName: row.bankName,
    branchName: row.branchName,
    referenceNumber: row.referenceNumber,
    amount: Number(row.amount),
    currency: row.currency,
    issueDate: new Date(`${row.issueDate}T12:00:00.000Z`),
    maturityDate: new Date(`${row.maturityDate}T12:00:00.000Z`),
    lastUpdated: row.updatedAt,
    status: row.status as FdrRecord["status"],
    assignedOfficer: row.assignedOfficer,
    riskLevel: row.riskLevel as FdrRecord["riskLevel"],
    riskReason: row.riskReason,
    nextAction: row.nextAction,
    evidenceCount,
    duplicateOfId: row.duplicateOfId,
    createdAt: row.createdAt,
  };
}

export async function mapFdrRecords(rows: FdrRow[]) {
  const [institutions, evidence] = await Promise.all([
    db.select().from(institutionsTable),
    db.select({ recordId: evidenceTable.recordId }).from(evidenceTable),
  ]);
  const institutionById = new Map(institutions.map((institution) => [institution.id, institution]));
  const evidenceCounts = new Map<string, number>();
  for (const item of evidence) {
    evidenceCounts.set(item.recordId, (evidenceCounts.get(item.recordId) ?? 0) + 1);
  }
  return rows.flatMap((row) => {
    const institution = institutionById.get(row.institutionId);
    return institution
      ? [mapFdrRecord(row, institution, evidenceCounts.get(row.id) ?? 0)]
      : [];
  });
}

export async function getFdrDetail(recordId: string) {
  const [record] = await db.select().from(fdrsTable).where(eq(fdrsTable.id, recordId)).limit(1);
  if (!record) return null;

  const [institutionRows, evidenceRows, historyRows] = await Promise.all([
    db.select().from(institutionsTable).where(eq(institutionsTable.id, record.institutionId)).limit(1),
    db.select().from(evidenceTable).where(eq(evidenceTable.recordId, record.id)).orderBy(desc(evidenceTable.uploadedAt)),
    db.select().from(activityTable).where(eq(activityTable.recordId, record.id)).orderBy(desc(activityTable.createdAt)),
  ]);
  const institution = institutionRows[0];
  if (!institution) return null;

  return {
    record: mapFdrRecord(record, institution, evidenceRows.length),
    institution: mapInstitution(institution, [record]),
    evidence: evidenceRows.map(
      (item) =>
        ({
          ...item,
          evidenceType: item.evidenceType as Evidence["evidenceType"],
          status: item.status as Evidence["status"],
        }) satisfies Evidence,
    ),
    history: historyRows.map(mapActivity),
  } satisfies FdrDetail;
}

export async function logActivity(input: {
  actor: string;
  role: string;
  action: string;
  details: string;
  recordId?: string | null;
  institutionId?: string | null;
  institutionName?: string | null;
}): Promise<void> {
  await db.insert(activityTable).values({
    id: crypto.randomUUID(),
    actor: input.actor,
    role: input.role,
    action: input.action,
    details: input.details,
    recordId: input.recordId ?? null,
    institutionId: input.institutionId ?? null,
    institutionName: input.institutionName ?? null,
  });
}

export async function getInstitutionRecords(institutionId: string): Promise<FdrRow[]> {
  return db.select().from(fdrsTable).where(eq(fdrsTable.institutionId, institutionId));
}
