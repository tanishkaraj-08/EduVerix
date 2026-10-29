import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, pgTable, varchar } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const appSettingsTable = pgTable("fdr_app_settings", {
  id: varchar("id", { length: 32 }).primaryKey(),
  maturityWarningDays: integer("maturity_warning_days").notNull().default(60),
  requireBankConfirmation: boolean("require_bank_confirmation").notNull().default(true),
  notifyOnMaturity: boolean("notify_on_maturity").notNull().default(true),
});

export const insertAppSettingsSchema = createInsertSchema(appSettingsTable);
export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;
export type AppSettingsRow = typeof appSettingsTable.$inferSelect;
