import { pgTable, serial, text, jsonb, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const savedProblemsTable = pgTable("saved_problems", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sector: text("sector").notNull(),
  objectiveType: text("objective_type").notNull(),
  status: text("status"),
  optimalValue: numeric("optimal_value"),
  problemData: jsonb("problem_data").notNull(),
  result: jsonb("result"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSavedProblemSchema = createInsertSchema(savedProblemsTable).omit({ id: true, createdAt: true });
export type InsertSavedProblem = z.infer<typeof insertSavedProblemSchema>;
export type SavedProblem = typeof savedProblemsTable.$inferSelect;
