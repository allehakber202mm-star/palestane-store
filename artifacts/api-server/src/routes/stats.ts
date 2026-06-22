import { Router } from "express";
import { db, accountsTable, statsTable } from "@workspace/db";
import { eq, desc, sql, and, isNotNull, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// ── Dashboard summary (existing, kept for compatibility) ─────────────────────
router.get("/dashboard", async (_req, res) => {
  const [totals] = await db
    .select({
      total: sql<number>`count(*)`,
      sold: sql<number>`count(*) filter (where ${accountsTable.status} = 'sold')`,
      available: sql<number>`count(*) filter (where ${accountsTable.status} = 'available')`,
      monetized: sql<number>`count(*) filter (where ${accountsTable.platform} = 'tiktok_monetized')`,
      tiktok: sql<number>`count(*) filter (where ${accountsTable.platform} = 'tiktok')`,
      instagram: sql<number>`count(*) filter (where ${accountsTable.platform} = 'instagram')`,
      facebook: sql<number>`count(*) filter (where ${accountsTable.platform} = 'facebook')`,
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
      id: a.id, name: a.name, platform: a.platform, followers: a.followers,
      price: parseFloat(String(a.price)), description: a.description ?? null,
      imageUrl: a.imageUrl ?? null, status: a.status, featured: a.featured,
      clickCount: a.clickCount,
      createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
      updatedAt: a.updatedAt instanceof Date ? a.updatedAt.toISOString() : String(a.updatedAt),
    };
  }

  res.json({
    totalAccounts: Number(totals.total),
    soldAccounts: Number(totals.sold),
    availableAccounts: Number(totals.available),
    monetizedAccounts: Number(totals.monetized),
    tiktokAccounts: Number(totals.tiktok),
    instagramAccounts: Number(totals.instagram),
    facebookAccounts: Number(totals.facebook),
    totalClicks: Number(totals.clicks),
    whatsappClicks: Number(waClicks.count),
    topAccounts: topAccounts.map(a => formatAccount(a as Record<string, unknown>)),
  });
});

// ── Unified event tracking ───────────────────────────────────────────────────
router.post("/track", async (req, res) => {
  const { eventType, accountId } = req.body as { eventType?: string; accountId?: number };
  if (!eventType) { res.status(400).json({ error: "eventType required" }); return; }
  const allowed = ["page_view", "whatsapp_click", "account_url_click"] as const;
  if (!allowed.includes(eventType as typeof allowed[number])) {
    res.status(400).json({ error: "invalid eventType" }); return;
  }
  await db.insert(statsTable).values({
    eventType,
    accountId: accountId ? Number(accountId) : null,
  });
  res.json({ success: true });
});

// ── Legacy whatsapp-click (kept for compatibility) ───────────────────────────
router.post("/whatsapp-click", async (_req, res) => {
  await db.insert(statsTable).values({ eventType: "whatsapp_click" });
  res.json({ success: true });
});

// ── Detailed admin stats ─────────────────────────────────────────────────────
router.get("/admin-detail", requireAuth, async (_req, res) => {
  // Total counts by event type
  const counts = await db
    .select({ eventType: statsTable.eventType, count: sql<number>`count(*)::int` })
    .from(statsTable)
    .groupBy(statsTable.eventType);

  const totals: Record<string, number> = {};
  for (const row of counts) totals[row.eventType] = Number(row.count);

  // Helper: get top account IDs for an event type
  async function topByEvent(eventType: string, limit = 10) {
    const rows = await db
      .select({ accountId: statsTable.accountId, count: sql<number>`count(*)::int` })
      .from(statsTable)
      .where(and(eq(statsTable.eventType, eventType), isNotNull(statsTable.accountId)))
      .groupBy(statsTable.accountId)
      .orderBy(desc(sql`count(*)`))
      .limit(limit);
    return rows.filter(r => r.accountId != null) as { accountId: number; count: number }[];
  }

  const [pvTop, waTop, urlTop] = await Promise.all([
    topByEvent("page_view"),
    topByEvent("whatsapp_click"),
    topByEvent("account_url_click"),
  ]);

  // Fetch account names/platform for those IDs
  const allIds = [
    ...pvTop.map(r => r.accountId),
    ...waTop.map(r => r.accountId),
    ...urlTop.map(r => r.accountId),
  ].filter((v, i, a) => a.indexOf(v) === i);

  const accMap: Record<number, { id: number; name: string; platform: string; imageUrl: string | null }> = {};
  if (allIds.length) {
    const rows = await db
      .select({ id: accountsTable.id, name: accountsTable.name, platform: accountsTable.platform, imageUrl: accountsTable.imageUrl })
      .from(accountsTable)
      .where(inArray(accountsTable.id, allIds));
    for (const r of rows) accMap[r.id] = r;
  }

  const enrich = (items: { accountId: number; count: number }[]) =>
    items.map(r => ({ ...accMap[r.accountId], count: Number(r.count) })).filter(r => r.id);

  res.json({
    totals: {
      pageViews:       Number(totals["page_view"] ?? 0),
      whatsappClicks:  Number(totals["whatsapp_click"] ?? 0),
      accountUrlClicks: Number(totals["account_url_click"] ?? 0),
    },
    topByPageViews:      enrich(pvTop),
    topByWhatsapp:       enrich(waTop),
    topByAccountUrlClick: enrich(urlTop),
  });
});

export default router;
