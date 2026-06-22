import { Router } from "express";
import { db, feedbackPostsTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const router = Router();

function formatPost(r: typeof feedbackPostsTable.$inferSelect) {
  return {
    id: r.id,
    telegramMessageId: r.telegramMessageId,
    text: r.text ?? null,
    imageUrl: r.imageUrl ?? null,
    postedAt: r.postedAt instanceof Date ? r.postedAt.toISOString() : String(r.postedAt),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
  };
}

router.get("/", async (_req, res) => {
  const rows = await db
    .select()
    .from(feedbackPostsTable)
    .orderBy(desc(feedbackPostsTable.postedAt));
  res.json(rows.map(formatPost));
});

export default router;
