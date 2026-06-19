import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const statsTable = pgTable("stats", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(), // page_view | whatsapp_click | account_click
  accountId: integer("account_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Stat = typeof statsTable.$inferSelect;
