import { pgTable, text, serial, timestamp, integer, boolean, numeric, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  platform: text("platform").notNull(), // tiktok | instagram | facebook | tiktok_monetized
  followers: integer("followers").notNull().default(0),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  description: text("description"),
  imageUrl: text("image_url"),
  username: text("username"),
  accountUrl: text("account_url"),
  status: text("status").notNull().default("available"), // available | sold
  featured: boolean("featured").notNull().default(false),
  clickCount: integer("click_count").notNull().default(0),
  visitCount: integer("visit_count").notNull().default(0),
  earningsStatus: text("earnings_status"),    // active | inactive | null
  eligibleCountry: text("eligible_country"),
  activationDate: text("activation_date"),
  earningsNotes: text("earnings_notes"),
  avgEarningsPer10k: numeric("avg_earnings_per_10k"),
  followersUpdatedAt: timestamp("followers_updated_at", { withTimezone: true }),
  telegramMessageId: integer("telegram_message_id"),
  originalDescription: text("original_description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  uniqueIndex("accounts_account_url_unique")
    .on(t.accountUrl)
    .where(sql`${t.accountUrl} IS NOT NULL`),
  index("accounts_telegram_message_id_idx")
    .on(t.telegramMessageId)
    .where(sql`${t.telegramMessageId} IS NOT NULL`),
  index("accounts_status_idx").on(t.status),
  index("accounts_platform_idx").on(t.platform),
  index("accounts_platform_status_idx").on(t.platform, t.status),
]);

export const insertAccountSchema = createInsertSchema(accountsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accountsTable.$inferSelect;
