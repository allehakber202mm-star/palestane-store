import { Router } from "express";
import { db, reviewImagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/", async (_req, res) => {
  const rows = await db.select().from(reviewImagesTable).orderBy(reviewImagesTable.createdAt);
  res.json(rows);
});

router.post("/admin/reviews", requireAuth, async (req, res) => {
  const { imageUrl, caption } = req.body;
  if (!imageUrl) {
    res.status(400).json({ error: "imageUrl is required" });
    return;
  }
  const [row] = await db.insert(reviewImagesTable).values({ imageUrl, caption: caption || null }).returning();
  res.status(201).json(row);
});

router.delete("/admin/reviews/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(reviewImagesTable).where(eq(reviewImagesTable.id, id));
  res.json({ success: true });
});

export default router;
