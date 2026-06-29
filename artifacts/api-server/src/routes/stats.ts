import { Router } from "express";
import { db, accountsTable, statsTable, feedbackPostsTable, accountVisitsTable, siteVisitsTable } from "@workspace/db";
import { eq, desc, sql, and, isNotNull, inArray, gte, lt } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// ── Bot UA patterns ──────────────────────────────────────────────────────────
const BOT_RE = /bot|crawler|spider|scraper|slurp|curl|wget|python-requests|python\/|java\/|go-http|axios\/|node-fetch|node\.js|phantomjs|headless|facebookexternalhit|linkedinbot|twitterbot|whatsapp|discordbot|telegrambot|applebot|bingbot|googlebot|yandex|duckduck|baiduspider|sogou|exabot|ia_archiver|mediapartners|adsbot/i;

// ── Helper: detect device ────────────────────────────────────────────────────
function detectDevice(ua: string | null | undefined): string {
  if (!ua) return "غير معروف";
  const u = ua.toLowerCase();
  if (/ipad|tablet|kindle|silk|playbook/.test(u)) return "لوحي";
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/.test(u)) return "هاتف";
  return "كمبيوتر";
}

// ── Helper: detect browser ───────────────────────────────────────────────────
function detectBrowser(ua: string | null | undefined): string {
  if (!ua) return "غير معروف";
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  if (/MSIE|Trident/.test(ua)) return "Internet Explorer";
  return "أخرى";
}

// ── Helper: detect traffic source ───────────────────────────────────────────
function detectSource(referrer: string | null | undefined): string {
  if (!referrer) return "مباشر";
  const r = referrer.toLowerCase();
  if (r.includes("google")) return "Google";
  if (r.includes("facebook") || r.includes("fb.com")) return "Facebook";
  if (r.includes("tiktok")) return "TikTok";
  if (r.includes("instagram")) return "Instagram";
  if (r.includes("t.me") || r.includes("telegram")) return "Telegram";
  if (r.includes("twitter.com") || r.includes("x.com")) return "X (Twitter)";
  if (r.includes("whatsapp")) return "WhatsApp";
  if (r.includes("youtube")) return "YouTube";
  return "أخرى";
}

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

  // ── Visit totals (site_visits, date-filtered — platform not applicable here)
  const [visitTotals] = await db
    .select({
      visitCount:     sql<number>`count(*)::int`,
      uniqueVisitors: sql<number>`count(distinct ${siteVisitsTable.visitorId})::int`,
    })
    .from(siteVisitsTable)
    .where(siteWhere);

  // ── Daily chart (generate_series so every day shows even if 0 visits)
  const dailyRows = await db.execute<{ date: string; count: number }>(sql`
    SELECT
      to_char(gs.day, 'YYYY-MM-DD') AS date,
      COALESCE(COUNT(sv.id), 0)::int AS count
    FROM generate_series(
      date_trunc('day', ${from}::timestamptz AT TIME ZONE 'UTC'),
      date_trunc('day', ${to}::timestamptz   AT TIME ZONE 'UTC'),
      INTERVAL '1 day'
    ) AS gs(day)
    LEFT JOIN site_visits sv
      ON date_trunc('day', sv.created_at AT TIME ZONE 'UTC') = gs.day
      AND sv.created_at >= ${from} AND sv.created_at < ${to}
    GROUP BY gs.day
    ORDER BY gs.day
    LIMIT 90
  `);

  // ── Top pages
  const topPagesRows = await db
    .select({ page: siteVisitsTable.page, count: sql<number>`count(*)::int` })
    .from(siteVisitsTable)
    .where(siteWhere)
    .groupBy(siteVisitsTable.page)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  // ── Fetch site visits for device/browser/source aggregation (cap 5000)
  const visits = await db
    .select({
      userAgent: siteVisitsTable.userAgent,
      referrer:  siteVisitsTable.referrer,
      sessionId: siteVisitsTable.sessionId,
      page:      siteVisitsTable.page,
      createdAt: siteVisitsTable.createdAt,
    })
    .from(siteVisitsTable)
    .where(siteWhere)
    .limit(5000);

  const deviceCounts:  Record<string, number> = {};
  const browserCounts: Record<string, number> = {};
  const sourceCounts:  Record<string, number> = {};

  for (const v of visits) {
    const device  = detectDevice(v.userAgent);
    const browser = detectBrowser(v.userAgent);
    const source  = detectSource(v.referrer);
    deviceCounts[device]   = (deviceCounts[device]   ?? 0) + 1;
    browserCounts[browser] = (browserCounts[browser] ?? 0) + 1;
    sourceCounts[source]   = (sourceCounts[source]   ?? 0) + 1;
  }

  // ── Hourly chart (site_visits, date-only)
  const hourlyRows = await db.execute<{ hour: string; count: string }>(sql`
    SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::int AS hour,
           COUNT(*)::int AS count
    FROM site_visits
    WHERE created_at >= ${from} AND created_at < ${to}
    GROUP BY 1 ORDER BY 1
  `);
  const hourlyMap: Record<number, number> = {};
  for (const r of hourlyRows.rows) hourlyMap[Number(r.hour)] = Number(r.count);
  const hourlyChart = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: hourlyMap[h] ?? 0 }));

  // ── Heatmap (site_visits, date-only)
  const heatmapRows = await db.execute<{ day: string; hour: string; count: string }>(sql`
    SELECT EXTRACT(DOW  FROM created_at AT TIME ZONE 'UTC')::int AS day,
           EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC')::int AS hour,
           COUNT(*)::int AS count
    FROM site_visits
    WHERE created_at >= ${from} AND created_at < ${to}
    GROUP BY 1, 2 ORDER BY 1, 2
  `);

  // ── Button clicks (filtered by platform when provided)
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

  const BUTTON_LABELS: Record<string, string> = {
    page_view:         "فتح صفحة حساب",
    whatsapp_click:    "ضغط واتساب",
    account_url_click: "زيارة الحساب",
  };
  const buttonClicks = statEventRows
    .map(r => ({ button: r.eventType, label: BUTTON_LABELS[r.eventType] ?? r.eventType, count: Number(r.count) }))
    .sort((a, b) => b.count - a.count);

  // Derived summary counts (filtered by platform)
  const pvCount  = buttonClicks.find(b => b.button === "page_view")?.count         ?? 0;
  const waCount  = buttonClicks.find(b => b.button === "whatsapp_click")?.count     ?? 0;
  const urlCount = buttonClicks.find(b => b.button === "account_url_click")?.count  ?? 0;

  // ── Platform breakdown from page_view events
  let platformRows: { platform: string; count: string }[];
  if (hasPlatform) {
    platformRows = [];
  } else {
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

  // ── Recent activity
  const recentVisits = await db
    .select({ id: siteVisitsTable.id, page: siteVisitsTable.page, createdAt: siteVisitsTable.createdAt, userAgent: siteVisitsTable.userAgent, referrer: siteVisitsTable.referrer })
    .from(siteVisitsTable)
    .where(siteWhere)
    .orderBy(desc(siteVisitsTable.createdAt))
    .limit(20);

  let recentStats;
  if (hasPlatform) {
    recentStats = await db
      .select({ id: statsTable.id, eventType: statsTable.eventType, accountId: statsTable.accountId, createdAt: statsTable.createdAt })
      .from(statsTable)
      .innerJoin(accountsTable, eq(statsTable.accountId, accountsTable.id))
      .where(and(statDateWhere, isNotNull(statsTable.accountId), eq(accountsTable.platform, platformParam!)))
      .orderBy(desc(statsTable.createdAt))
      .limit(20);
  } else {
    recentStats = await db
      .select({ id: statsTable.id, eventType: statsTable.eventType, accountId: statsTable.accountId, createdAt: statsTable.createdAt })
      .from(statsTable)
      .where(and(statDateWhere, isNotNull(statsTable.accountId)))
      .orderBy(desc(statsTable.createdAt))
      .limit(20);
  }

  const statAccIds = [...new Set(recentStats.map(r => r.accountId!).filter(Boolean))];
  const statAccNames: Record<number, string> = {};
  if (statAccIds.length) {
    const rows = await db
      .select({ id: accountsTable.id, name: accountsTable.name })
      .from(accountsTable)
      .where(inArray(accountsTable.id, statAccIds));
    for (const r of rows) statAccNames[r.id] = r.name;
  }

  const recentActivity = [
    ...recentVisits.map(v => ({
      id: `sv-${v.id}`, type: "visit" as const,
      page: v.page,
      timestamp: (v.createdAt as Date).toISOString(),
      device: detectDevice(v.userAgent),
      source: detectSource(v.referrer),
    })),
    ...recentStats.map(s => ({
      id: `st-${s.id}`, type: "event" as const,
      eventType: s.eventType,
      accountId: s.accountId ?? undefined,
      accountName: s.accountId ? statAccNames[s.accountId] : undefined,
      timestamp: (s.createdAt as Date).toISOString(),
    })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 30);

  // ── User journeys — last 15 sessions
  const sessionRows = await db.execute<{ session_id: string; start_time: string; page_count: string }>(sql`
    SELECT session_id,
           MIN(created_at) AS start_time,
           COUNT(*)::int   AS page_count
    FROM site_visits
    WHERE created_at >= ${from} AND created_at < ${to}
      AND session_id IS NOT NULL AND session_id != ''
    GROUP BY session_id
    ORDER BY start_time DESC
    LIMIT 15
  `);

  const sessionIds = sessionRows.rows.map(r => String(r.session_id)).filter(Boolean);
  let journeys: unknown[] = [];

  if (sessionIds.length) {
    const sv = await db
      .select({ sessionId: siteVisitsTable.sessionId, page: siteVisitsTable.page, createdAt: siteVisitsTable.createdAt, userAgent: siteVisitsTable.userAgent, referrer: siteVisitsTable.referrer })
      .from(siteVisitsTable)
      .where(inArray(siteVisitsTable.sessionId, sessionIds))
      .orderBy(siteVisitsTable.sessionId, siteVisitsTable.createdAt);

    const grouped: Record<string, typeof sv> = {};
    for (const v of sv) {
      if (!grouped[v.sessionId]) grouped[v.sessionId] = [];
      grouped[v.sessionId].push(v);
    }

    journeys = sessionRows.rows.map(r => {
      const sid = String(r.session_id);
      const vs  = grouped[sid] ?? [];
      const first = vs[0];
      return {
        sessionId: sid.slice(0, 8) + "…",
        pages: vs.map(v => ({ page: v.page, time: (v.createdAt as Date).toISOString() })),
        startTime: String(r.start_time),
        device: first ? detectDevice(first.userAgent) : "غير معروف",
        source: first ? detectSource(first.referrer)  : "مباشر",
        pageCount: Number(r.page_count),
      };
    });
  }

  const uniqueSessions = new Set(visits.map(v => v.sessionId)).size;
  const avgSessionPages = uniqueSessions > 0 ? Math.round((visits.length / uniqueSessions) * 10) / 10 : 0;

  res.json({
    from: from.toISOString(),
    to:   to.toISOString(),
    visitCount:    Number(visitTotals?.visitCount    ?? 0),
    uniqueVisitors: Number(visitTotals?.uniqueVisitors ?? 0),
    pageViews:     pvCount,
    waClicks:      waCount,
    urlClicks:     urlCount,
    dailyChart:    dailyRows.rows.map(r => ({ date: String(r.date), count: Number(r.count) })),
    topPages:      topPagesRows.map(r => ({ page: r.page, count: Number(r.count) })),
    devices:       Object.entries(deviceCounts).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    browsers:      Object.entries(browserCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    sources:       Object.entries(sourceCounts).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
    platforms:     platformRows.map(r => ({ platform: String(r.platform), count: Number(r.count) })),
    hourlyChart,
    heatmap:       heatmapRows.rows.map(r => ({ day: Number(r.day), hour: Number(r.hour), count: Number(r.count) })),
    buttonClicks,
    recentActivity,
    journeys,
    avgSessionPages,
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
