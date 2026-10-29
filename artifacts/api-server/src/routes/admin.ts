import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  GetSettingsResponse,
  ListDemoUsersResponse,
  UpdateDemoUserBody,
  UpdateDemoUserParams,
  UpdateDemoUserResponse,
  UpdateSettingsBody,
  UpdateSettingsResponse,
} from "@workspace/api-zod";
import { db, appSettingsTable, demoUsersTable } from "@workspace/db";
import { getDemoRole, getDemoSession, requireDemoRoles } from "../lib/demo-auth";
import { logActivity } from "../lib/fdr-data";

const router: IRouter = Router();

router.get("/admin/users", requireDemoRoles("administrator"), async (_req, res): Promise<void> => {
  const users = await db.select().from(demoUsersTable);
  res.json(ListDemoUsersResponse.parse(users));
});

router.patch(
  "/admin/users/:userId",
  requireDemoRoles("administrator"),
  async (req, res): Promise<void> => {
    const params = UpdateDemoUserParams.safeParse(req.params);
    const parsed = UpdateDemoUserBody.safeParse(req.body);
    if (!params.success || !parsed.success || Object.keys(parsed.data).length === 0) {
      res.status(400).json({ error: params.error?.message ?? parsed.error?.message ?? "Select a role or account state to update." });
      return;
    }
    const [existing] = await db
      .select()
      .from(demoUsersTable)
      .where(eq(demoUsersTable.id, params.data.userId))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Demo user not found." });
      return;
    }
    if (
      existing.role === "administrator" &&
      existing.active &&
      (parsed.data.active === false || (parsed.data.role && parsed.data.role !== "administrator"))
    ) {
      const admins = await db
        .select()
        .from(demoUsersTable)
        .where(and(eq(demoUsersTable.role, "administrator"), eq(demoUsersTable.active, true)));
      if (admins.length <= 1) {
        res.status(400).json({ error: "At least one active administrator must remain." });
        return;
      }
    }
    const [updated] = await db
      .update(demoUsersTable)
      .set(parsed.data)
      .where(eq(demoUsersTable.id, params.data.userId))
      .returning();
    const session = await getDemoSession(req);
    await logActivity({
      actor: session.fullName,
      role: getDemoRole(req),
      action: "Demo access updated",
      details: `Updated ${updated.fullName}'s demo role or active state.`,
    });
    res.json(UpdateDemoUserResponse.parse(updated));
  },
);

router.get("/admin/settings", requireDemoRoles("administrator"), async (_req, res): Promise<void> => {
  const [settings] = await db.select().from(appSettingsTable).limit(1);
  if (!settings) {
    res.status(404).json({ error: "Workflow settings have not been initialized." });
    return;
  }
  res.json(GetSettingsResponse.parse(settings));
});

router.patch(
  "/admin/settings",
  requireDemoRoles("administrator"),
  async (req, res): Promise<void> => {
    const parsed = UpdateSettingsBody.safeParse(req.body);
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      res.status(400).json({ error: parsed.error?.message ?? "Provide at least one setting to update." });
      return;
    }
    const [settings] = await db
      .insert(appSettingsTable)
      .values({ id: "default", ...parsed.data })
      .onConflictDoUpdate({ target: appSettingsTable.id, set: parsed.data })
      .returning();
    const session = await getDemoSession(req);
    await logActivity({
      actor: session.fullName,
      role: getDemoRole(req),
      action: "Workflow settings updated",
      details: "Updated FDR maturity and notification workflow settings.",
    });
    res.json(UpdateSettingsResponse.parse(settings));
  },
);

export default router;
