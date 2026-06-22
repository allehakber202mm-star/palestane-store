import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const feedbackPostsTable = pgTable("feedback_posts", {
  id: serial("id").primaryKey(),
  telegramMessageId: integer("telegram_message_id").notNull().unique(),
  text: text("text"),
  imageUrl: text("image_url"),
  postedAt: timestamp("posted_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type FeedbackPost = typeof feedbackPostsTable.$inferSelect;
