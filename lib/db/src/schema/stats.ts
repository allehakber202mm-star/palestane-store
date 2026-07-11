import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";

export const statsTable = pgTable("stats", {
  id:        serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  accountId: integer("account_id"),
  sessionId: text("session_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("stats_account_id_idx").on(t.accountId),
  index("stats_event_type_idx").on(t.eventType),
  index("stats_created_at_idx").on(t.createdAt),
  index("stats_account_id_event_type_idx").on(t.accountId, t.eventType),
]);

export type Stat = typeof statsTable.$inferSelect;
