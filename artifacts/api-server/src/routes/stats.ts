import { Router } from "express";
import { db, accountsTable, statsTable, feedbackPostsTable, accountVisitsTable, siteVisitsTable } from "@workspace/db";
import { eq, desc, sql, and, isNotNull, inArray, max, gte, lt } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// ── Bot UA patterns ──────────────────────────────────────────────────────────
const BOT_RE = /bot|crawler|spider|scraper|slurp|curl|wget|python-requests|python\/|java\/|go-http|axios\/|node-fetch|node\.js|phantomjs|headless|facebookexternalhit|linkedinbot|twitterbot|whatsapp|discordbot|telegrambot|applebot|bingbot|googlebot|yandex|duckduck|baiduspider|sogou|exabot|ia_archiver|mediapartners|adsbot/i;

// ── Dashboard summary ─────────────────────────────────────────────────────────
router.get("/dashboard", async (_req, res) => {
  const [totals] = await db
    .select({
      total:     sql<number>`count(*)`,
      sold:      sql<number>`count(*) filter (where ${accountsTable.status} = 'sold')`,
      available: sql<number>`count(*) filter (where ${accountsTable.status} = 'available')`,
      monetized: sql<number>`count(*) filter (where ${accountsTable.platform} = 'tiktok_monetized')`,
      tiktok:    sql<number>`count(*) filter (where ${accountsTable.platform} = 'tiktok')`,
      instagram: sql<number>`count(*) filter (where ${accountsTable.platform} = 'instagram')`,
      facebook:  sql<number>`count(*) filter (where ${accountsTable.platform} = 'facebook')`,
      clicks:    sql<number>`coalesce(sum(${accountsTable.clickCount}), 0)`,
    })
    .from(accountsTable);

  const [waClicks] = await db
    .select({ count: sql<number>`count(*)` })
    .from(statsTable)
    .where(eq(statsTable.eventType, "whatsapp_click"));

  const [fbCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(feedbackPostsTable);

  const topAccounts = await db
    .select()
    .from(accountsTable)
    .orderBy(desc(accountsTable.clickCount))
    .limit(5);

  const recentAccounts = await db
    .select()
    .from(accountsTable)
    .orderBy(desc(accountsTable.createdAt))
    .limit(10);

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
    totalAccounts:     Number(totals.total),
    soldAccounts:      Number(totals.sold),
    availableAccounts: Number(totals.available),
    monetizedAccounts: Number(totals.monetized),
    tiktokAccounts:    Number(totals.tiktok),
    instagramAccounts: Number(totals.instagram),
    facebookAccounts:  Number(totals.facebook),
    totalClicks:       Number(totals.clicks),
    whatsappClicks:    Number(waClicks.count),
    feedbackPosts:     Number(fbCount.count),
    recentAccounts:    recentAccounts.map(a => formatAccount(a as Record<string, unknown>)),
    topAccounts:       topAccounts.map(a => formatAccount(a as Record<string, unknown>)),
  });
});

// ── Site visit tracking ───────────────────────────────────────────────────────
// POST /stats/site-visit
// Body: { visitorId, sessionId, page }
// Dedup: same visitorId+page within 30 min → skip
// Bot detection: user-agent check
router.post("/site-visit", async (req, res) => {
  const { visitorId, sessionId, page } = req.body as {
    visitorId?: string; sessionId?: string; page?: string;
  };

  if (!visitorId || !sessionId || !page) {
    res.status(400).json({ error: "visitorId, sessionId and page are required" });
    return;
  }

  const ua = req.headers["user-agent"] ?? "";

  // Reject known bots
  if (BOT_RE.test(ua)) {
    res.json({ counted: false, reason: "bot" });
    return;
  }

  // Dedup: same visitorId + same page within last 30 min → skip
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
  const [existing] = await db
    .select({ id: siteVisitsTable.id })
    .from(siteVisitsTable)
    .where(
      and(
        eq(siteVisitsTable.visitorId, visitorId),
        eq(siteVisitsTable.page, page),
        gte(siteVisitsTable.createdAt, thirtyMinAgo),
      ),
    )
    .limit(1);

  if (existing) {
    res.json({ counted: false, reason: "dedup" });
    return;
  }

  await db.insert(siteVisitsTable).values({
    visitorId,
    sessionId,
    page,
    userAgent: ua || null,
  });

  res.json({ counted: true });
});

// ── Site overview analytics (admin only) ─────────────────────────────────────
// GET /stats/site-overview
router.get("/site-overview", requireAuth, async (_req, res) => {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d7    = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
  const d30   = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const d5min = new Date(now.getTime() - 5  * 60 * 1000);

  const [totals] = await db
    .select({
      total:          sql<number>`count(*)::int`,
      todayCount:     sql<number>`count(*) filter (where ${siteVisitsTable.createdAt} >= ${today})::int`,
      last7:          sql<number>`count(*) filter (where ${siteVisitsTable.createdAt} >= ${d7})::int`,
      last30:         sql<number>`count(*) filter (where ${siteVisitsTable.createdAt} >= ${d30})::int`,
      uniqueVisitors: sql<number>`count(distinct ${siteVisitsTable.visitorId})::int`,
      activeNow:      sql<number>`count(distinct ${siteVisitsTable.visitorId}) filter (where ${siteVisitsTable.createdAt} >= ${d5min})::int`,
    })
    .from(siteVisitsTable);

  // Daily chart — last 30 days, fill gaps with 0 using generate_series
  const dailyRows = await db.execute<{ date: string; count: number }>(sql`
    SELECT
      to_char(gs.day, 'YYYY-MM-DD') AS date,
      COALESCE(COUNT(sv.id), 0)::int AS count
    FROM generate_series(
      date_trunc('day', now() AT TIME ZONE 'UTC') - INTERVAL '29 days',
      date_trunc('day', now() AT TIME ZONE 'UTC'),
      INTERVAL '1 day'
    ) AS gs(day)
    LEFT JOIN site_visits sv
      ON date_trunc('day', sv.created_at AT TIME ZONE 'UTC') = gs.day
    GROUP BY gs.day
    ORDER BY gs.day
  `);

  // Top pages — limit 10
  const topPages = await db
    .select({
      page:  siteVisitsTable.page,
      count: sql<number>`count(*)::int`,
    })
    .from(siteVisitsTable)
    .groupBy(siteVisitsTable.page)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  res.json({
    total:          Number(totals.total),
    today:          Number(totals.todayCount),
    last7days:      Number(totals.last7),
    last30days:     Number(totals.last30),
    uniqueVisitors: Number(totals.uniqueVisitors),
    activeNow:      Number(totals.activeNow),
    dailyChart:     dailyRows.rows.map(r => ({ date: String(r.date), count: Number(r.count) })),
    topPages:       topPages.map(r => ({ page: r.page, count: Number(r.count) })),
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

// ── Legacy whatsapp-click ────────────────────────────────────────────────────
router.post("/whatsapp-click", async (_req, res) => {
  await db.insert(statsTable).values({ eventType: "whatsapp_click" });
  res.json({ success: true });
});

// ── Detailed admin stats ─────────────────────────────────────────────────────
router.get("/admin-detail", requireAuth, async (_req, res) => {
  const counts = await db
    .select({ eventType: statsTable.eventType, count: sql<number>`count(*)::int` })
    .from(statsTable)
    .groupBy(statsTable.eventType);

  const totals: Record<string, number> = {};
  for (const row of counts) totals[row.eventType] = Number(row.count);

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
      pageViews:        Number(totals["page_view"] ?? 0),
      whatsappClicks:   Number(totals["whatsapp_click"] ?? 0),
      accountUrlClicks: Number(totals["account_url_click"] ?? 0),
    },
    topByPageViews:       enrich(pvTop),
    topByWhatsapp:        enrich(waTop),
    topByAccountUrlClick: enrich(urlTop),
  });
});

export default router;
