import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const siteVisitsTable = pgTable("site_visits", {
  id:        serial("id").primaryKey(),
  visitorId: text("visitor_id").notNull(),
  sessionId: text("session_id").notNull(),
  page:      text("page").notNull(),
  userAgent: text("user_agent"),
  referrer:  text("referrer"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SiteVisit = typeof siteVisitsTable.$inferSelect;
