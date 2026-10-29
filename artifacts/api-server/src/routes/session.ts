import { Router, type IRouter } from "express";
import { SwitchDemoRoleBody, SwitchDemoRoleResponse } from "@workspace/api-zod";
import { db, demoUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  getDemoSession,
  setDemoRoleCookie,
  type DemoRole,
} from "../lib/demo-auth";

const router: IRouter = Router();

router.get("/session", async (req, res): Promise<void> => {
  res.json(await getDemoSession(req));
});

router.post("/session/demo-role", async (req, res): Promise<void> => {
  const parsed = SwitchDemoRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const users = await db.select().from(demoUsersTable).where(eq(demoUsersTable.role, parsed.data.role));
  const user = users.find((candidate) => candidate.active);
  if (!user) {
    res.status(409).json({ error: "No active demo account is available for that role." });
    return;
  }

  setDemoRoleCookie(res, parsed.data.role as DemoRole);
  if (req.signedCookies) {
    req.signedCookies.demoRole = parsed.data.role;
    if (parsed.data.role === "institution_user") {
      req.signedCookies.demoInstitutionId = "inst-demo-01";
    }
  }

  res.json(SwitchDemoRoleResponse.parse(await getDemoSession(req)));
});

export default router;
