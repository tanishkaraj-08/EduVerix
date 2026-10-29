import type { Request, Response, RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { db, demoUsersTable } from "@workspace/db";
import { GetSessionResponse } from "@workspace/api-zod";

const demoRoles = [
  "institution_user",
  "regulation_officer",
  "supervisor",
  "administrator",
] as const;
export type DemoRole = (typeof demoRoles)[number];

const defaultRole: DemoRole = "regulation_officer";
const fallbackProfiles: Record<DemoRole, { fullName: string; email: string; institutionId: string | null }> = {
  institution_user: {
    fullName: "Ananya Kapoor",
    email: "ananya.kapoor@northvalley-demo.edu",
    institutionId: "inst-demo-01",
  },
  regulation_officer: {
    fullName: "Rohan Mehta",
    email: "rohan.mehta@fdrsentinel-demo.gov.in",
    institutionId: null,
  },
  supervisor: {
    fullName: "Nisha Menon",
    email: "nisha.menon@fdrsentinel-demo.gov.in",
    institutionId: null,
  },
  administrator: {
    fullName: "Arjun Rao",
    email: "arjun.rao@fdrsentinel-demo.gov.in",
    institutionId: null,
  },
};

export function getDemoRole(req: Request): DemoRole {
  const role = req.signedCookies?.demoRole;
  return typeof role === "string" && demoRoles.includes(role as DemoRole)
    ? (role as DemoRole)
    : defaultRole;
}

export async function getDemoSession(req: Request) {
  const role = getDemoRole(req);
  const activeUsers = await db
    .select()
    .from(demoUsersTable)
    .where(eq(demoUsersTable.role, role));
  const demoUser = activeUsers.find((user) => user.active);
  const fallback = fallbackProfiles[role];
  const institutionId =
    role === "institution_user"
      ? (typeof req.signedCookies?.demoInstitutionId === "string"
          ? req.signedCookies.demoInstitutionId
          : fallback.institutionId)
      : null;

  return GetSessionResponse.parse({
    role,
    fullName: demoUser?.fullName ?? fallback.fullName,
    email: demoUser?.email ?? fallback.email,
    institutionId,
    demoMode: true,
  });
}

const demoCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  signed: true,
  maxAge: 1000 * 60 * 60 * 12,
  path: "/",
};

export function setDemoRoleCookie(res: Response, role: DemoRole): void {
  res.cookie("demoRole", role, demoCookieOptions);
  if (role !== "institution_user") {
    res.clearCookie("demoInstitutionId", { path: "/" });
  }
}

export function setDemoInstitutionCookie(res: Response, institutionId: string): void {
  res.cookie("demoInstitutionId", institutionId, demoCookieOptions);
}

export function requireDemoRoles(...allowedRoles: DemoRole[]): RequestHandler {
  return (req, res, next) => {
    if (!allowedRoles.includes(getDemoRole(req))) {
      res.status(403).json({ error: "This action is not available for the active demo role." });
      return;
    }
    next();
  };
}
