import { Router, type IRouter } from "express";
import { and, eq, ilike, or } from "drizzle-orm";
import {
  CreateInstitutionBody,
  CreateInstitutionResponse,
  GetInstitutionParams,
  GetInstitutionResponse,
  ListInstitutionsResponse,
  ListInstitutionsQueryParams,
  UpdateInstitutionBody,
  UpdateInstitutionParams,
  UpdateInstitutionResponse,
} from "@workspace/api-zod";
import { db, fdrsTable, institutionsTable } from "@workspace/db";
import { getDemoRole, getDemoSession, requireDemoRoles, setDemoInstitutionCookie } from "../lib/demo-auth";
import { getInstitutionRecords, logActivity, mapFdrRecords, mapInstitution } from "../lib/fdr-data";

const router: IRouter = Router();

router.get("/institutions", async (req, res): Promise<void> => {
  const query = ListInstitutionsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const session = await getDemoSession(req);
  const filters = [];
  if (session.role === "institution_user" && session.institutionId) {
    filters.push(eq(institutionsTable.id, session.institutionId));
  }
  if (query.data.q?.trim()) {
    const term = `%${query.data.q.trim()}%`;
    filters.push(
      or(
        ilike(institutionsTable.name, term),
        ilike(institutionsTable.identifier, term),
        ilike(institutionsTable.state, term),
        ilike(institutionsTable.region, term),
      )!,
    );
  }
  const institutions = filters.length
    ? await db.select().from(institutionsTable).where(and(...filters))
    : await db.select().from(institutionsTable);
  const allFdrs = await db.select().from(fdrsTable);
  const items = institutions
    .map((institution) => mapInstitution(institution, allFdrs))
    .sort((left, right) => left.name.localeCompare(right.name));
  const start = (query.data.page - 1) * query.data.pageSize;
  res.json(
    ListInstitutionsResponse.parse({
      items: items.slice(start, start + query.data.pageSize),
      total: items.length,
      page: query.data.page,
      pageSize: query.data.pageSize,
    }),
  );
});

router.post(
  "/institutions",
  requireDemoRoles("institution_user", "administrator"),
  async (req, res): Promise<void> => {
    const parsed = CreateInstitutionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [duplicate] = await db
      .select({ id: institutionsTable.id })
      .from(institutionsTable)
      .where(eq(institutionsTable.identifier, parsed.data.identifier))
      .limit(1);
    if (duplicate) {
      res.status(409).json({ error: "That institution identifier is already registered." });
      return;
    }

    const id = crypto.randomUUID();
    const [created] = await db
      .insert(institutionsTable)
      .values({ ...parsed.data, id })
      .returning();
    const role = getDemoRole(req);
    const session = await getDemoSession(req);
    if (role === "institution_user") {
      setDemoInstitutionCookie(res, created.id);
      if (req.signedCookies) req.signedCookies.demoInstitutionId = created.id;
    }
    await logActivity({
      actor: session.fullName,
      role,
      action: "Institution registered",
      details: `${created.name} was added to the institution directory.`,
      institutionId: created.id,
      institutionName: created.name,
    });

    const allFdrs = await db.select().from(fdrsTable);
    res.status(201).json(CreateInstitutionResponse.parse(mapInstitution(created, allFdrs)));
  },
);

router.get("/institutions/:institutionId", async (req, res): Promise<void> => {
  const params = GetInstitutionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const session = await getDemoSession(req);
  if (session.role === "institution_user" && session.institutionId !== params.data.institutionId) {
    res.status(403).json({ error: "Institution users can only view their own institution profile." });
    return;
  }

  const [institution] = await db
    .select()
    .from(institutionsTable)
    .where(eq(institutionsTable.id, params.data.institutionId))
    .limit(1);
  if (!institution) {
    res.status(404).json({ error: "Institution not found." });
    return;
  }

  const records = await getInstitutionRecords(institution.id);
  const details = await mapFdrRecords(records);
  const issues = records
    .filter((record) => record.riskReason || record.status === "correction_required")
    .map((record) => `${record.id}: ${record.riskReason ?? "Correction requested"}`);
  res.json(GetInstitutionResponse.parse({
    institution: mapInstitution(institution, records),
    records: details,
    outstandingIssues: issues,
  }));
});

router.patch(
  "/institutions/:institutionId",
  requireDemoRoles("administrator"),
  async (req, res): Promise<void> => {
    const params = UpdateInstitutionParams.safeParse(req.params);
    const parsed = UpdateInstitutionBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: params.error?.message ?? parsed.error?.message ?? "Invalid request." });
      return;
    }
    const [updated] = await db
      .update(institutionsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(institutionsTable.id, params.data.institutionId))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Institution not found." });
      return;
    }

    const [records, session] = await Promise.all([
      getInstitutionRecords(updated.id),
      getDemoSession(req),
    ]);
    await logActivity({
      actor: session.fullName,
      role: "administrator",
      action: "Institution profile updated",
      details: `Updated the institution profile for ${updated.name}.`,
      institutionId: updated.id,
      institutionName: updated.name,
    });
    res.json(UpdateInstitutionResponse.parse(mapInstitution(updated, records)));
  },
);

export default router;
