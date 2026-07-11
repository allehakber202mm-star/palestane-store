import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";

export const accountVisitsTable = pgTable("account_visits", {
  id:           serial("id").primaryKey(),
  accountId:    integer("account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  accountTitle: text("account_title").notNull(),
  visitorId:    text("visitor_id").notNull(),
  visitedAt:    timestamp("visited_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AccountVisit = typeof accountVisitsTable.$inferSelect;
