import { db } from "@workspace/db";
import {
  activityTable,
  appSettingsTable,
  demoUsersTable,
  evidenceTable,
  fdrsTable,
  institutionsTable,
} from "@workspace/db";

function dateOffset(offsetDays: number): string {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export async function seedDemoData(): Promise<void> {
  const existingInstitutions = await db.select({ id: institutionsTable.id }).from(institutionsTable).limit(1);
  if (existingInstitutions.length === 0) {
    await db.insert(institutionsTable).values([
      {
        id: "inst-demo-01",
        identifier: "AICTE-DEMO-1042",
        name: "North Valley Institute of Technology",
        state: "Maharashtra",
        region: "West",
        contactName: "Ananya Kapoor",
        contactEmail: "ananya.kapoor@northvalley-demo.edu",
        phone: "+91 22 5550 1042",
      },
      {
        id: "inst-demo-02",
        identifier: "AICTE-DEMO-2088",
        name: "Bengal Institute of Engineering",
        state: "West Bengal",
        region: "East",
        contactName: "Sourav Chatterjee",
        contactEmail: "sourav.chatterjee@bengal-demo.edu",
        phone: "+91 33 5550 2088",
      },
      {
        id: "inst-demo-03",
        identifier: "AICTE-DEMO-3017",
        name: "Deccan Institute of Applied Sciences",
        state: "Telangana",
        region: "South",
        contactName: "Kavya Reddy",
        contactEmail: "kavya.reddy@deccan-demo.edu",
        phone: "+91 40 5550 3017",
      },
    ]);
  }

  const existingFdrs = await db.select({ id: fdrsTable.id }).from(fdrsTable).limit(1);
  if (existingFdrs.length === 0) {
    await db.insert(fdrsTable).values([
      {
        id: "FDR-2026-0001",
        institutionId: "inst-demo-01",
        bankName: "State Bank of India",
        branchName: "Fort, Mumbai",
        referenceNumber: "SBI-FDR-845210",
        amount: "12500000.00",
        currency: "INR",
        issueDate: dateOffset(-320),
        maturityDate: dateOffset(45),
        status: "verified",
        assignedOfficer: "Rohan Mehta",
        riskLevel: "low",
        riskReason: null,
        nextAction: "Monitor maturity date",
      },
      {
        id: "FDR-2026-0002",
        institutionId: "inst-demo-02",
        bankName: "Bank of Baroda",
        branchName: "Salt Lake, Kolkata",
        referenceNumber: "BOB-FDR-219840",
        amount: "8500000.00",
        currency: "INR",
        issueDate: dateOffset(-235),
        maturityDate: dateOffset(18),
        status: "submitted",
        assignedOfficer: "Rohan Mehta",
        riskLevel: "medium",
        riskReason: "Bank confirmation is pending",
        nextAction: "Review submitted evidence",
      },
      {
        id: "FDR-2026-0003",
        institutionId: "inst-demo-03",
        bankName: "Canara Bank",
        branchName: "Banjara Hills, Hyderabad",
        referenceNumber: "CB-FDR-703351",
        amount: "6400000.00",
        currency: "INR",
        issueDate: dateOffset(-410),
        maturityDate: dateOffset(-12),
        status: "correction_required",
        assignedOfficer: "Rohan Mehta",
        riskLevel: "high",
        riskReason: "Matured record is missing a bank confirmation",
        nextAction: "Institution to replace missing evidence",
      },
      {
        id: "FDR-2026-0004",
        institutionId: "inst-demo-01",
        bankName: "State Bank of India",
        branchName: "Fort, Mumbai",
        referenceNumber: "SBI-FDR-845210",
        amount: "12500000.00",
        currency: "INR",
        issueDate: dateOffset(-320),
        maturityDate: dateOffset(45),
        status: "under_review",
        assignedOfficer: "Rohan Mehta",
        riskLevel: "high",
        riskReason: "Potential duplicate reference — supervisor review required",
        nextAction: "Compare with FDR-2026-0001",
        duplicateOfId: "FDR-2026-0001",
      },
      {
        id: "FDR-2026-0005",
        institutionId: "inst-demo-02",
        bankName: "Punjab National Bank",
        branchName: "Park Street, Kolkata",
        referenceNumber: "PNB-FDR-550761",
        amount: "9200000.00",
        currency: "INR",
        issueDate: dateOffset(-340),
        maturityDate: dateOffset(22),
        status: "renewal_pending",
        assignedOfficer: "Rohan Mehta",
        riskLevel: "medium",
        riskReason: "Renewal documentation is awaiting review",
        nextAction: "Review replacement FDR evidence",
      },
      {
        id: "FDR-2026-0006",
        institutionId: "inst-demo-03",
        bankName: "Union Bank of India",
        branchName: "Hitech City, Hyderabad",
        referenceNumber: "UBI-FDR-992026",
        amount: "4800000.00",
        currency: "INR",
        issueDate: dateOffset(-380),
        maturityDate: dateOffset(-3),
        status: "release_requested",
        assignedOfficer: "Rohan Mehta",
        riskLevel: "medium",
        riskReason: "Release request is awaiting officer decision",
        nextAction: "Review release request",
      },
    ]);
  }

  const existingEvidence = await db.select({ id: evidenceTable.id }).from(evidenceTable).limit(1);
  if (existingEvidence.length === 0) {
    await db.insert(evidenceTable).values([
      {
        id: "evidence-demo-01",
        recordId: "FDR-2026-0001",
        evidenceType: "fdr_receipt",
        fileName: "sample-sbi-fdr-receipt.pdf",
        contentType: "application/pdf",
        sizeBytes: 248000,
        status: "sample_evidence",
      },
      {
        id: "evidence-demo-02",
        recordId: "FDR-2026-0002",
        evidenceType: "fdr_receipt",
        fileName: "sample-bank-of-baroda-receipt.pdf",
        contentType: "application/pdf",
        sizeBytes: 192000,
        status: "sample_evidence",
      },
      {
        id: "evidence-demo-03",
        recordId: "FDR-2026-0003",
        evidenceType: "authorization_letter",
        fileName: "sample-authorization-letter.pdf",
        contentType: "application/pdf",
        sizeBytes: 164000,
        status: "sample_evidence",
      },
    ]);
  }

  const existingUsers = await db.select({ id: demoUsersTable.id }).from(demoUsersTable).limit(1);
  if (existingUsers.length === 0) {
    await db.insert(demoUsersTable).values([
      {
        id: "demo-user-institution",
        fullName: "Ananya Kapoor",
        email: "ananya.kapoor@northvalley-demo.edu",
        role: "institution_user",
      },
      {
        id: "demo-user-officer",
        fullName: "Rohan Mehta",
        email: "rohan.mehta@fdrsentinel-demo.gov.in",
        role: "regulation_officer",
      },
      {
        id: "demo-user-supervisor",
        fullName: "Nisha Menon",
        email: "nisha.menon@fdrsentinel-demo.gov.in",
        role: "supervisor",
      },
      {
        id: "demo-user-admin",
        fullName: "Arjun Rao",
        email: "arjun.rao@fdrsentinel-demo.gov.in",
        role: "administrator",
      },
    ]);
  }

  const existingSettings = await db.select({ id: appSettingsTable.id }).from(appSettingsTable).limit(1);
  if (existingSettings.length === 0) {
    await db.insert(appSettingsTable).values({
      id: "default",
      maturityWarningDays: 60,
      requireBankConfirmation: true,
      notifyOnMaturity: true,
    });
  }

  const existingActivity = await db.select({ id: activityTable.id }).from(activityTable).limit(1);
  if (existingActivity.length === 0) {
    await db.insert(activityTable).values([
      {
        id: "activity-demo-01",
        actor: "Rohan Mehta",
        role: "regulation_officer",
        action: "FDR verified",
        details: "Verified deposit details and supporting evidence for FDR-2026-0001.",
        recordId: "FDR-2026-0001",
        institutionId: "inst-demo-01",
        institutionName: "North Valley Institute of Technology",
        createdAt: new Date(Date.now() - 1000 * 60 * 38),
      },
      {
        id: "activity-demo-02",
        actor: "Sourav Chatterjee",
        role: "institution_user",
        action: "FDR submitted",
        details: "Submitted a fixed deposit receipt for review.",
        recordId: "FDR-2026-0002",
        institutionId: "inst-demo-02",
        institutionName: "Bengal Institute of Engineering",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
      },
      {
        id: "activity-demo-03",
        actor: "Nisha Menon",
        role: "supervisor",
        action: "Duplicate flagged",
        details: "Potential duplicate reference linked for supervisor review.",
        recordId: "FDR-2026-0004",
        institutionId: "inst-demo-01",
        institutionName: "North Valley Institute of Technology",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8),
      },
    ]);
  }
}
