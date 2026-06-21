import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const reviewImagesTable = pgTable("review_images", {
  id: serial("id").primaryKey(),
  imageUrl: text("image_url").notNull(),
  caption: text("caption"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReviewImageSchema = createInsertSchema(reviewImagesTable).omit({ id: true, createdAt: true });

export type ReviewImage = typeof reviewImagesTable.$inferSelect;
