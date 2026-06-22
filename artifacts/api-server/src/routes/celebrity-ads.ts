import { Router } from "express";
import { db, celebrityAdsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

function fmt(r: typeof celebrityAdsTable.$inferSelect) {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? null,
    videoUrl: r.videoUrl,
    thumbnailUrl: r.thumbnailUrl ?? null,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
  };
}

router.get("/", async (_req, res) => {
  const rows = await db.select().from(celebrityAdsTable).orderBy(desc(celebrityAdsTable.createdAt));
  res.json(rows.map(fmt));
});

router.post("/admin/celebrity-ads", requireAuth, async (req, res) => {
  const { title, description, videoUrl, thumbnailUrl } = req.body as {
    title: string; description?: string | null; videoUrl: string; thumbnailUrl?: string | null;
  };
  if (!title || !videoUrl) {
    res.status(400).json({ error: "title and videoUrl are required" });
    return;
  }
  const [row] = await db.insert(celebrityAdsTable).values({
    title, description: description ?? null, videoUrl, thumbnailUrl: thumbnailUrl ?? null,
  }).returning();
  res.status(201).json(fmt(row));
});

router.patch("/admin/celebrity-ads/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  const { title, description, videoUrl, thumbnailUrl } = req.body as {
    title?: string; description?: string | null; videoUrl?: string; thumbnailUrl?: string | null;
  };
  const updates: Partial<typeof celebrityAdsTable.$inferInsert & { updatedAt: Date }> = { updatedAt: new Date() };
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description ?? null;
  if (videoUrl !== undefined) updates.videoUrl = videoUrl;
  if (thumbnailUrl !== undefined) updates.thumbnailUrl = thumbnailUrl ?? null;
  const [row] = await db.update(celebrityAdsTable).set(updates).where(eq(celebrityAdsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "not found" }); return; }
  res.json(fmt(row));
});

router.delete("/admin/celebrity-ads/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  await db.delete(celebrityAdsTable).where(eq(celebrityAdsTable.id, id));
  res.json({ success: true });
});

export default router;
