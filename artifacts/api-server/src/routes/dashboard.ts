import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { GetDashboardResponse, ListActivityQueryParams, ListActivityResponse } from "@workspace/api-zod";
import { db, activityTable, appSettingsTable, fdrsTable, institutionsTable } from "@workspace/db";
import { getDemoSession } from "../lib/demo-auth";
import { mapActivity } from "../lib/fdr-data";

const router: IRouter = Router();
const statuses = [
  "draft",
  "submitted",
  "under_review",
  "correction_required",
  "verified",
  "rejected",
  "renewal_pending",
  "release_requested",
  "released",
  "closed",
] as const;

router.get("/dashboard", async (req, res): Promise<void> => {
  const session = await getDemoSession(req);
  const [allInstitutions, allRecords, settingsRows] = await Promise.all([
    db.select().from(institutionsTable),
    db.select().from(fdrsTable),
    db.select().from(appSettingsTable).limit(1),
  ]);
  const institutionIds =
    session.role === "institution_user" && session.institutionId
      ? new Set([session.institutionId])
      : new Set(allInstitutions.map((institution) => institution.id));
  const institutions = allInstitutions.filter((institution) => institutionIds.has(institution.id));
  const records = allRecords.filter((record) => institutionIds.has(record.institutionId));
  const settings = settingsRows[0] ?? {
    maturityWarningDays: 60,
  };
  const today = new Date().toISOString().slice(0, 10);
  const warningLimit = new Date();
  warningLimit.setUTCDate(warningLimit.getUTCDate() + settings.maturityWarningDays);
  const warningDate = warningLimit.toISOString().slice(0, 10);
  const activeRecords = records.filter((record) => !["released", "closed"].includes(record.status));
  const pendingVerification = records.filter((record) =>
    ["submitted", "under_review", "correction_required"].includes(record.status),
  );
  const approachingMaturity = activeRecords.filter(
    (record) => record.maturityDate >= today && record.maturityDate <= warningDate,
  );
  const matured = activeRecords.filter((record) => record.maturityDate < today);
  const renewals = records.filter((record) => record.status === "renewal_pending");
  const releases = records.filter((record) => record.status === "release_requested");
  const urgent = activeRecords.filter(
    (record) =>
      record.riskLevel === "high" ||
      record.maturityDate < today ||
      (record.maturityDate <= warningDate && record.maturityDate >= today),
  );
  const metrics = [
    { key: "institutions", label: "Registered institutions", value: institutions.length, filter: "institutions" },
    { key: "fdrs", label: "Total FDR records", value: records.length, filter: "all" },
    { key: "pending", label: "Pending verification", value: pendingVerification.length, filter: "pending" },
    { key: "verified", label: "Verified FDRs", value: records.filter((record) => record.status === "verified").length, filter: "verified" },
    { key: "maturing", label: "Approaching maturity", value: approachingMaturity.length, filter: "maturing" },
    { key: "overdue", label: "Matured or overdue", value: matured.length, filter: "overdue" },
    { key: "renewals", label: "Renewals pending", value: renewals.length, filter: "renewal_pending" },
    { key: "releases", label: "Release requests", value: releases.length, filter: "release_requested" },
    { key: "urgent", label: "Urgent attention", value: urgent.length, filter: "urgent" },
  ];

  const statusBreakdown = statuses.map((status) => ({
    status,
    count: records.filter((record) => record.status === status).length,
  }));
  const maturityTrend = Array.from({ length: 6 }, (_, index) => {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    monthStart.setUTCMonth(monthStart.getUTCMonth() + index);
    const key = monthStart.toISOString().slice(0, 7);
    return {
      month: monthStart.toLocaleString("en-IN", { month: "short", timeZone: "UTC" }),
      upcoming: activeRecords.filter(
        (record) => record.maturityDate >= today && record.maturityDate.startsWith(key),
      ).length,
      matured: records.filter(
        (record) =>
          record.maturityDate.startsWith(key) &&
          record.maturityDate < today &&
          !["released", "closed"].includes(record.status),
      ).length,
    };
  });
  const regionCounts = new Map<string, number>();
  for (const institution of institutions) {
    regionCounts.set(
      institution.region,
      (regionCounts.get(institution.region) ?? 0) +
        records.filter((record) => record.institutionId === institution.id).length,
    );
  }
  const institutionSubmissions = Array.from(regionCounts, ([region, count]) => ({ region, count }));
  const workload = new Map<string, { pending: number; overdue: number }>();
  for (const record of records) {
    if (!record.assignedOfficer || !["submitted", "under_review", "renewal_pending", "release_requested"].includes(record.status)) continue;
    const current = workload.get(record.assignedOfficer) ?? { pending: 0, overdue: 0 };
    current.pending += 1;
    if (record.maturityDate < today) current.overdue += 1;
    workload.set(record.assignedOfficer, current);
  }
  const caseWorkload = Array.from(workload, ([officer, counts]) => ({ officer, ...counts }));

  const activityFilters =
    session.role === "institution_user" && session.institutionId
      ? eq(activityTable.institutionId, session.institutionId)
      : undefined;
  const activityRows = activityFilters
    ? await db.select().from(activityTable).where(activityFilters).orderBy(desc(activityTable.createdAt)).limit(8)
    : await db.select().from(activityTable).orderBy(desc(activityTable.createdAt)).limit(8);
  res.json(
    GetDashboardResponse.parse({
      metrics,
      statusBreakdown,
      maturityTrend,
      institutionSubmissions,
      caseWorkload,
      recentActivity: activityRows.map(mapActivity),
    }),
  );
});

router.get("/activity", async (req, res): Promise<void> => {
  const query = ListActivityQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const session = await getDemoSession(req);
  const rows =
    session.role === "institution_user" && session.institutionId
      ? await db
          .select()
          .from(activityTable)
          .where(eq(activityTable.institutionId, session.institutionId))
          .orderBy(desc(activityTable.createdAt))
          .limit(query.data.limit)
      : await db.select().from(activityTable).orderBy(desc(activityTable.createdAt)).limit(query.data.limit);
  res.json(ListActivityResponse.parse(rows.map(mapActivity)));
});

export default router;
