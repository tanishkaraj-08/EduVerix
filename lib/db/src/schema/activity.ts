import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const activityTable = pgTable("fdr_activity", {
  id: varchar("id", { length: 64 }).primaryKey(),
  actor: varchar("actor", { length: 160 }).notNull(),
  role: varchar("role", { length: 32 }).notNull(),
  action: varchar("action", { length: 80 }).notNull(),
  details: text("details").notNull(),
  recordId: varchar("record_id", { length: 64 }),
  institutionId: varchar("institution_id", { length: 64 }),
  institutionName: varchar("institution_name", { length: 180 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertActivitySchema = createInsertSchema(activityTable).omit({ createdAt: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type ActivityRow = typeof activityTable.$inferSelect;
