import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

export const siteVisitsTable = pgTable("site_visits", {
  id:        serial("id").primaryKey(),
  visitorId: text("visitor_id").notNull(),
  sessionId: text("session_id").notNull(),
  page:      text("page").notNull(),
  userAgent: text("user_agent"),
  referrer:  text("referrer"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("site_visits_created_at_idx").on(t.createdAt),
  index("site_visits_visitor_id_page_idx").on(t.visitorId, t.page),
]);

export type SiteVisit = typeof siteVisitsTable.$inferSelect;
