import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const celebrityAdsTable = pgTable("celebrity_ads", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  videoUrl: text("video_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type CelebrityAd = typeof celebrityAdsTable.$inferSelect;
