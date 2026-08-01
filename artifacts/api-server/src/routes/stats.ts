import { Router } from "express";
import { db, accountsTable, statsTable, feedbackPostsTable, accountVisitsTable, siteVisitsTable } from "@workspace/db";
import { eq, desc, sql, and, isNotNull, inArray, gte, lt } from "drizzle-orm";
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
      snapchat:  sql<number>`count(*) filter (where ${accountsTable.platform} = 'snapchat')`,
      clicks:    sql<number>`coalesce(sum(${accountsTable.clickCount}), 0)`,
      featured:  sql<number>`count(*) filter (where ${accountsTable.featured} = true)`,
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
    snapchatAccounts:  Number(totals.snapchat),
    featuredAccounts:  Number(totals.featured),
    totalClicks:       Number(totals.clicks),
    whatsappClicks:    Number(waClicks.count),
    feedbackPosts:     Number(fbCount.count),
    recentAccounts:    recentAccounts.map(a => formatAccount(a as Record<string, unknown>)),
    topAccounts:       topAccounts.map(a => formatAccount(a as Record<string, unknown>)),
  });
});

// ── Site visit tracking ───────────────────────────────────────────────────────
router.post("/site-visit", async (req, res) => {
  const { visitorId, sessionId, page, referrer } = req.body as {
    visitorId?: string; sessionId?: string; page?: string; referrer?: string | null;
  };

  if (!visitorId || !sessionId || !page) {
    res.status(400).json({ error: "visitorId, sessionId and page are required" });
    return;
  }

  const ua = req.headers["user-agent"] ?? "";
  if (BOT_RE.test(ua)) { res.json({ counted: false, reason: "bot" }); return; }

  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
  const [existing] = await db
    .select({ id: siteVisitsTable.id })
    .from(siteVisitsTable)
    .where(and(
      eq(siteVisitsTable.visitorId, visitorId),
      eq(siteVisitsTable.page, page),
      gte(siteVisitsTable.createdAt, thirtyMinAgo),
    ))
    .limit(1);

  if (existing) { res.json({ counted: false, reason: "dedup" }); return; }

  await db.insert(siteVisitsTable).values({
    visitorId,
    sessionId,
    page,
    userAgent: ua || null,
    referrer:  referrer || null,
  });

  res.json({ counted: true });
});

// ── Site overview analytics (admin only) ─────────────────────────────────────
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
  const { eventType, accountId, visitorId, sessionId } = req.body as {
    eventType?: string; accountId?: number; visitorId?: string; sessionId?: string;
  };
  if (!eventType) { res.status(400).json({ error: "eventType required" }); return; }
  const allowed = ["page_view", "whatsapp_click", "account_url_click"] as const;
  if (!allowed.includes(eventType as typeof allowed[number])) {
    res.status(400).json({ error: "invalid eventType" }); return;
  }

  if (eventType === "page_view" && visitorId && accountId) {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const [existing] = await db
      .select({ id: statsTable.id })
      .from(statsTable)
      .where(and(
        eq(statsTable.eventType, "page_view"),
        eq(statsTable.accountId, Number(accountId)),
        sql`${statsTable.createdAt} >= ${thirtyMinAgo}`,
      ))
      .limit(1);
    if (existing) { res.json({ success: true, counted: false, reason: "dedup" }); return; }
  }

  await db.insert(statsTable).values({
    eventType,
    accountId: accountId ? Number(accountId) : null,
    sessionId: sessionId ?? null,
  });
  res.json({ success: true, counted: true });
});

// ── Legacy whatsapp-click ────────────────────────────────────────────────────
router.post("/whatsapp-click", async (_req, res) => {
  await db.insert(statsTable).values({ eventType: "whatsapp_click" });
  res.json({ success: true });
});

// ── Detailed admin stats ─────────────────────────────────────────────────────
router.get("/admin-detail", requireAuth, async (req, res) => {
  const now = new Date();
  const fromParam     = req.query.from     as string | undefined;
  const toParam       = req.query.to       as string | undefined;
  const platformParam = req.query.platform as string | undefined;
  const from = fromParam ? new Date(fromParam) : new Date(0);
  const to   = toParam   ? new Date(toParam)   : now;
  const hasPlatform = !!platformParam && platformParam !== "all";

  async function topByEvent(eventType: string, limit = 10): Promise<{ accountId: number; count: number }[]> {
    const baseWhere = and(
      eq(statsTable.eventType, eventType),
      isNotNull(statsTable.accountId),
      gte(statsTable.createdAt, from),
      lt(statsTable.createdAt, to),
    );
    if (hasPlatform) {
      const rows = await db
        .select({ accountId: statsTable.accountId, count: sql<number>`count(*)::int` })
        .from(statsTable)
        .innerJoin(accountsTable, eq(statsTable.accountId, accountsTable.id))
        .where(and(baseWhere, eq(accountsTable.platform, platformParam!)))
        .groupBy(statsTable.accountId)
        .orderBy(desc(sql`count(*)`))
        .limit(limit);
      return rows.filter(r => r.accountId != null) as { accountId: number; count: number }[];
    } else {
      const rows = await db
        .select({ accountId: statsTable.accountId, count: sql<number>`count(*)::int` })
        .from(statsTable)
        .where(baseWhere)
        .groupBy(statsTable.accountId)
        .orderBy(desc(sql`count(*)`))
        .limit(limit);
      return rows.filter(r => r.accountId != null) as { accountId: number; count: number }[];
    }
  }

  const [pvTop, waTop, urlTop] = await Promise.all([
    topByEvent("page_view"),
    topByEvent("whatsapp_click"),
    topByEvent("account_url_click"),
  ]);

  const allIds = [...pvTop, ...waTop, ...urlTop]
    .map(r => r.accountId)
    .filter((v, i, a) => a.indexOf(v) === i);

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
    topByPageViews:       enrich(pvTop),
    topByWhatsapp:        enrich(waTop),
    topByAccountUrlClick: enrich(urlTop),
  });
});

// ── Advanced analytics (admin only) ──────────────────────────────────────────
router.get("/advanced", requireAuth, async (req, res) => {
  const now           = new Date();
  const fromParam     = req.query.from     as string | undefined;
  const toParam       = req.query.to       as string | undefined;
  const platformParam = req.query.platform as string | undefined;
  const from = fromParam ? new Date(fromParam) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const to   = toParam   ? new Date(toParam)   : now;
  const hasPlatform = !!platformParam && platformParam !== "all";

  const siteWhere = and(gte(siteVisitsTable.createdAt, from), lt(siteVisitsTable.createdAt, to));

  // ── Visit totals + avgSessionPages
  const [visitTotals] = await db
    .select({
      visitCount:     sql<number>`count(*)::int`,
      uniqueVisitors: sql<number>`count(distinct ${siteVisitsTable.visitorId})::int`,
      uniqueSessions: sql<number>`count(distinct ${siteVisitsTable.sessionId})::int`,
    })
    .from(siteVisitsTable)
    .where(siteWhere);

  const visitCount     = Number(visitTotals?.visitCount     ?? 0);
  const uniqueVisitors = Number(visitTotals?.uniqueVisitors ?? 0);
  const uniqueSessions = Number(visitTotals?.uniqueSessions ?? 0);
  const avgSessionPages = uniqueSessions > 0 ? Math.round((visitCount / uniqueSessions) * 10) / 10 : 0;

  // ── Stats event counts (pageViews, waClicks, urlClicks) with optional platform filter
  const statDateWhere = and(gte(statsTable.createdAt, from), lt(statsTable.createdAt, to));
  let statEventRows: { eventType: string; count: number }[];
  if (hasPlatform) {
    statEventRows = await db
      .select({ eventType: statsTable.eventType, count: sql<number>`count(*)::int` })
      .from(statsTable)
      .innerJoin(accountsTable, eq(statsTable.accountId, accountsTable.id))
      .where(and(statDateWhere, eq(accountsTable.platform, platformParam!)))
      .groupBy(statsTable.eventType);
  } else {
    statEventRows = await db
      .select({ eventType: statsTable.eventType, count: sql<number>`count(*)::int` })
      .from(statsTable)
      .where(statDateWhere)
      .groupBy(statsTable.eventType);
  }

  const pvCount  = statEventRows.find(r => r.eventType === "page_view")?.count         ?? 0;
  const waCount  = statEventRows.find(r => r.eventType === "whatsapp_click")?.count     ?? 0;
  const urlCount = statEventRows.find(r => r.eventType === "account_url_click")?.count  ?? 0;

  // ── Platform breakdown (only when no platform filter)
  let platformRows: { platform: string; count: string }[] = [];
  if (!hasPlatform) {
    const r = await db.execute<{ platform: string; count: string }>(sql`
      SELECT a.platform, COUNT(*)::int AS count
      FROM stats s
      JOIN accounts a ON a.id = s.account_id
      WHERE s.event_type = 'page_view'
        AND s.created_at >= ${from} AND s.created_at < ${to}
      GROUP BY a.platform ORDER BY count DESC
    `);
    platformRows = r.rows;
  }

  res.json({
    from:           from.toISOString(),
    to:             to.toISOString(),
    visitCount,
    uniqueVisitors,
    pageViews:      Number(pvCount),
    waClicks:       Number(waCount),
    urlClicks:      Number(urlCount),
    avgSessionPages,
    platforms:      platformRows.map(r => ({ platform: String(r.platform), count: Number(r.count) })),
  });
});

// ── All accounts engagement (admin only) ─────────────────────────────────────
router.get("/accounts-engagement", requireAuth, async (req, res) => {
  const now = new Date();
  const fromParam     = req.query.from     as string | undefined;
  const toParam       = req.query.to       as string | undefined;
  const platformParam = req.query.platform as string | undefined;
  const from = fromParam ? new Date(fromParam) : new Date(0);
  const to   = toParam   ? new Date(toParam)   : now;
  const hasPlatform = !!platformParam && platformParam !== "all";

  const accWhere = hasPlatform ? eq(accountsTable.platform, platformParam!) : undefined;
  const accounts = await db
    .select({
      id: accountsTable.id, name: accountsTable.name, platform: accountsTable.platform,
      imageUrl: accountsTable.imageUrl, status: accountsTable.status,
      followers: accountsTable.followers, price: accountsTable.price,
    })
    .from(accountsTable)
    .where(accWhere)
    .orderBy(desc(accountsTable.createdAt));

  if (!accounts.length) { res.json([]); return; }

  const ids = accounts.map(a => a.id);

  // Stats counts per account filtered by date range
  const statRows = await db
    .select({
      accountId: statsTable.accountId,
      eventType: statsTable.eventType,
      count: sql<number>`count(*)::int`,
    })
    .from(statsTable)
    .where(and(
      isNotNull(statsTable.accountId),
      inArray(statsTable.accountId, ids),
      gte(statsTable.createdAt, from),
      lt(statsTable.createdAt, to),
    ))
    .groupBy(statsTable.accountId, statsTable.eventType);

  // Last activity per account (also date-filtered)
  const lastActivityRows = await db.execute<{ account_id: number; last_at: string }>(sql`
    SELECT account_id, MAX(created_at) AS last_at
    FROM stats
    WHERE account_id IS NOT NULL
      AND created_at >= ${from} AND created_at < ${to}
    GROUP BY account_id
  `);
  const lastMap: Record<number, string> = {};
  for (const r of lastActivityRows.rows) lastMap[Number(r.account_id)] = String(r.last_at);

  type Counts = { pageViews: number; whatsapp: number; urlClicks: number };
  const countsMap: Record<number, Counts> = {};
  for (const r of statRows) {
    const id = r.accountId!;
    if (!countsMap[id]) countsMap[id] = { pageViews: 0, whatsapp: 0, urlClicks: 0 };
    if (r.eventType === "page_view")         countsMap[id].pageViews  = Number(r.count);
    if (r.eventType === "whatsapp_click")    countsMap[id].whatsapp   = Number(r.count);
    if (r.eventType === "account_url_click") countsMap[id].urlClicks  = Number(r.count);
  }

  const result = accounts.map(a => {
    const c = countsMap[a.id] ?? { pageViews: 0, whatsapp: 0, urlClicks: 0 };
    const conversion = c.pageViews > 0 ? Math.round(((c.whatsapp + c.urlClicks) / c.pageViews) * 100) : 0;
    return {
      id: a.id, name: a.name, platform: a.platform,
      imageUrl: a.imageUrl ?? null, status: a.status,
      followers: a.followers, price: String(a.price),
      pageViews: c.pageViews,
      whatsappClicks: c.whatsapp,
      urlClicks: c.urlClicks,
      conversionRate: conversion,
      lastActivity: lastMap[a.id] ?? null,
    };
  });

  res.json(result);
});

// ── Platform summary: today / week / month per platform ──────────────────────
router.get("/platform-summary", requireAuth, async (_req, res) => {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d7    = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
  const d30   = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const platforms = ["tiktok", "tiktok_monetized", "instagram", "facebook", "snapchat"] as const;

  // Count accounts per platform
  const accountCounts = await db
    .select({
      platform: accountsTable.platform,
      count: sql<number>`count(*)::int`,
    })
    .from(accountsTable)
    .groupBy(accountsTable.platform);

  const accMap: Record<string, number> = {};
  for (const r of accountCounts) accMap[String(r.platform)] = Number(r.count);

  // For each time period, get page_view + account_url_click + whatsapp_click per platform
  async function getPlatformStats(from: Date) {
    const rows = await db.execute<{
      platform: string;
      page_views: string;
      url_clicks: string;
      wa_clicks:  string;
    }>(sql`
      SELECT
        a.platform,
        COUNT(*) FILTER (WHERE s.event_type = 'page_view')         AS page_views,
        COUNT(*) FILTER (WHERE s.event_type = 'account_url_click') AS url_clicks,
        COUNT(*) FILTER (WHERE s.event_type = 'whatsapp_click')    AS wa_clicks
      FROM stats s
      JOIN accounts a ON a.id = s.account_id
      WHERE s.created_at >= ${from}
        AND s.account_id IS NOT NULL
      GROUP BY a.platform
    `);
    const map: Record<string, { pageViews: number; urlClicks: number; waClicks: number }> = {};
    for (const r of rows.rows) {
      map[String(r.platform)] = {
        pageViews: Number(r.page_views),
        urlClicks: Number(r.url_clicks),
        waClicks:  Number(r.wa_clicks),
      };
    }
    return map;
  }

  // Site visits per platform (via /account/:id URL pattern)
  async function getSiteVisitsPerPlatform(from: Date) {
    const rows = await db.execute<{ platform: string; count: string }>(sql`
      SELECT a.platform, COUNT(sv.id)::int AS count
      FROM site_visits sv
      JOIN accounts a ON sv.page = '/account/' || a.id::text
      WHERE sv.created_at >= ${from}
      GROUP BY a.platform
    `);
    const map: Record<string, number> = {};
    for (const r of rows.rows) map[String(r.platform)] = Number(r.count);
    return map;
  }

  const [todayStats, weekStats, monthStats, todaySV, weekSV, monthSV] = await Promise.all([
    getPlatformStats(today),
    getPlatformStats(d7),
    getPlatformStats(d30),
    getSiteVisitsPerPlatform(today),
    getSiteVisitsPerPlatform(d7),
    getSiteVisitsPerPlatform(d30),
  ]);

  const result = platforms.map(p => ({
    platform: p,
    accounts: accMap[p] ?? 0,
    today: {
      siteVisits: todaySV[p]  ?? 0,
      pageViews:  todayStats[p]?.pageViews ?? 0,
      urlClicks:  todayStats[p]?.urlClicks ?? 0,
      waClicks:   todayStats[p]?.waClicks  ?? 0,
    },
    week: {
      siteVisits: weekSV[p]  ?? 0,
      pageViews:  weekStats[p]?.pageViews ?? 0,
      urlClicks:  weekStats[p]?.urlClicks ?? 0,
      waClicks:   weekStats[p]?.waClicks  ?? 0,
    },
    month: {
      siteVisits: monthSV[p]  ?? 0,
      pageViews:  monthStats[p]?.pageViews ?? 0,
      urlClicks:  monthStats[p]?.urlClicks ?? 0,
      waClicks:   monthStats[p]?.waClicks  ?? 0,
    },
  }));

  res.json(result);
});

// ── Per-account detail (admin only) ─────────────────────────────────────────
router.get("/account/:id/details", requireAuth, async (req, res) => {
  const accountId = parseInt(String(req.params.id), 10);
  if (isNaN(accountId)) { res.status(400).json({ error: "invalid id" }); return; }

  const [counts] = await db
    .select({
      pageViews:   sql<number>`count(*) filter (where ${statsTable.eventType} = 'page_view')::int`,
      waClicks:    sql<number>`count(*) filter (where ${statsTable.eventType} = 'whatsapp_click')::int`,
      urlClicks:   sql<number>`count(*) filter (where ${statsTable.eventType} = 'account_url_click')::int`,
    })
    .from(statsTable)
    .where(eq(statsTable.accountId, accountId));

  // Last activity
  const [last] = await db
    .select({ createdAt: statsTable.createdAt })
    .from(statsTable)
    .where(eq(statsTable.accountId, accountId))
    .orderBy(desc(statsTable.createdAt))
    .limit(1);

  // Unique sessions (visitors) that viewed this account
  const [uniqueCount] = await db
    .select({ count: sql<number>`count(distinct ${statsTable.sessionId})::int` })
    .from(statsTable)
    .where(and(eq(statsTable.accountId, accountId), eq(statsTable.eventType, "page_view")));

  // Daily chart last 30 days
  const dailyRows = await db.execute<{ date: string; views: string; clicks: string }>(sql`
    SELECT
      to_char(gs.day, 'YYYY-MM-DD') AS date,
      COALESCE(SUM(CASE WHEN s.event_type = 'page_view'         THEN 1 ELSE 0 END), 0)::int AS views,
      COALESCE(SUM(CASE WHEN s.event_type = 'account_url_click' THEN 1 ELSE 0 END), 0)::int AS clicks
    FROM generate_series(
      date_trunc('day', now() AT TIME ZONE 'UTC') - INTERVAL '29 days',
      date_trunc('day', now() AT TIME ZONE 'UTC'),
      INTERVAL '1 day'
    ) AS gs(day)
    LEFT JOIN stats s ON s.account_id = ${accountId}
      AND date_trunc('day', s.created_at AT TIME ZONE 'UTC') = gs.day
    GROUP BY gs.day ORDER BY gs.day
  `);

  const pv = Number(counts.pageViews);
  const wa = Number(counts.waClicks);
  const ur = Number(counts.urlClicks);

  res.json({
    pageViews:      pv,
    uniqueVisitors: Number(uniqueCount?.count ?? 0),
    urlClicks:      ur,
    whatsappClicks: wa,
    conversionRate: pv > 0 ? Math.round(((wa + ur) / pv) * 100) : 0,
    lastSeen:       last ? (last.createdAt as Date).toISOString() : null,
    dailyChart:     dailyRows.rows.map(r => ({ date: String(r.date), views: Number(r.views), clicks: Number(r.clicks) })),
  });
});

export default router;
