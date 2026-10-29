import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const institutionsTable = pgTable("fdr_institutions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  identifier: varchar("identifier", { length: 30 }).notNull().unique(),
  name: varchar("name", { length: 180 }).notNull(),
  state: varchar("state", { length: 80 }).notNull(),
  region: varchar("region", { length: 80 }).notNull(),
  contactName: varchar("contact_name", { length: 120 }).notNull(),
  contactEmail: varchar("contact_email", { length: 180 }).notNull(),
  phone: varchar("phone", { length: 30 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertInstitutionSchema = createInsertSchema(institutionsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertInstitution = z.infer<typeof insertInstitutionSchema>;
export type InstitutionRow = typeof institutionsTable.$inferSelect;
