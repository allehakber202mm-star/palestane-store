import { Router } from "express";
import { db, accountsTable, statsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";

const router = Router();

router.get("/dashboard", async (_req, res) => {
  const [totals] = await db
    .select({
      total: sql<number>`count(*)`,
      sold: sql<number>`count(*) filter (where ${accountsTable.status} = 'sold')`,
      available: sql<number>`count(*) filter (where ${accountsTable.status} = 'available')`,
      clicks: sql<number>`coalesce(sum(${accountsTable.clickCount}), 0)`,
    })
    .from(accountsTable);

  const [waClicks] = await db
    .select({ count: sql<number>`count(*)` })
    .from(statsTable)
    .where(eq(statsTable.eventType, "whatsapp_click"));

  const topAccounts = await db
    .select()
    .from(accountsTable)
    .orderBy(desc(accountsTable.clickCount))
    .limit(5);

  function formatAccount(a: Record<string, unknown>) {
    return {
      id: a.id,
      name: a.name,
      platform: a.platform,
      followers: a.followers,
      price: parseFloat(String(a.price)),
      description: a.description ?? null,
      imageUrl: a.imageUrl ?? null,
      status: a.status,
      featured: a.featured,
      clickCount: a.clickCount,
      createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
      updatedAt: a.updatedAt instanceof Date ? a.updatedAt.toISOString() : String(a.updatedAt),
    };
  }

  res.json({
    totalAccounts: Number(totals.total),
    soldAccounts: Number(totals.sold),
    availableAccounts: Number(totals.available),
    totalClicks: Number(totals.clicks),
    whatsappClicks: Number(waClicks.count),
    topAccounts: topAccounts.map(a => formatAccount(a as Record<string, unknown>)),
  });
});

router.post("/whatsapp-click", async (_req, res) => {
  await db.insert(statsTable).values({ eventType: "whatsapp_click" });
  res.json({ success: true });
});

export default router;
