import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";

export const accountVisitsTable = pgTable("account_visits", {
  id:           serial("id").primaryKey(),
  accountId:    integer("account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  accountTitle: text("account_title").notNull(),
  visitorId:    text("visitor_id").notNull(),
  visitedAt:    timestamp("visited_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("account_visits_account_id_idx").on(t.accountId),
  index("account_visits_visitor_id_account_id_idx").on(t.visitorId, t.accountId),
]);

export type AccountVisit = typeof accountVisitsTable.$inferSelect;
