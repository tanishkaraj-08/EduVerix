import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { fdrsTable } from "./fdrs";
import { z } from "zod/v4";

export const evidenceTable = pgTable("fdr_evidence", {
  id: varchar("id", { length: 64 }).primaryKey(),
  recordId: varchar("record_id", { length: 64 }).notNull().references(() => fdrsTable.id, { onDelete: "cascade" }),
  evidenceType: varchar("evidence_type", { length: 32 }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  contentType: varchar("content_type", { length: 120 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("simulated_upload"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  previousVersionId: varchar("previous_version_id", { length: 64 }),
});

export const insertEvidenceSchema = createInsertSchema(evidenceTable).omit({ uploadedAt: true });
export type InsertEvidence = z.infer<typeof insertEvidenceSchema>;
export type EvidenceRow = typeof evidenceTable.$inferSelect;
