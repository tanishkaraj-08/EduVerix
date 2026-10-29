import { createInsertSchema } from "drizzle-zod";
import { boolean, pgTable, varchar } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const demoUsersTable = pgTable("fdr_demo_users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  fullName: varchar("full_name", { length: 160 }).notNull(),
  email: varchar("email", { length: 180 }).notNull().unique(),
  role: varchar("role", { length: 32 }).notNull(),
  active: boolean("active").notNull().default(true),
});

export const insertDemoUserSchema = createInsertSchema(demoUsersTable);
export type InsertDemoUser = z.infer<typeof insertDemoUserSchema>;
export type DemoUserRow = typeof demoUsersTable.$inferSelect;
