import { createInsertSchema } from "drizzle-zod";
import { date, integer, numeric, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { institutionsTable } from "./institutions";
import { z } from "zod/v4";

export const fdrsTable = pgTable("fdr_records", {
  id: varchar("id", { length: 64 }).primaryKey(),
  institutionId: varchar("institution_id", { length: 64 }).notNull().references(() => institutionsTable.id),
  bankName: varchar("bank_name", { length: 120 }).notNull(),
  branchName: varchar("branch_name", { length: 160 }).notNull(),
  referenceNumber: varchar("reference_number", { length: 100 }).notNull(),
  amount: numeric("amount", { precision: 16, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("INR"),
  issueDate: date("issue_date", { mode: "string" }).notNull(),
  maturityDate: date("maturity_date", { mode: "string" }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("submitted"),
  assignedOfficer: varchar("assigned_officer", { length: 160 }),
  riskLevel: varchar("risk_level", { length: 12 }).notNull().default("low"),
  riskReason: text("risk_reason"),
  nextAction: text("next_action"),
  duplicateOfId: varchar("duplicate_of_id", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertFdrSchema = createInsertSchema(fdrsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertFdr = z.infer<typeof insertFdrSchema>;
export type FdrRow = typeof fdrsTable.$inferSelect;
