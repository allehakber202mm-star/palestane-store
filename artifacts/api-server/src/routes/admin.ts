import { Router } from "express";
import { db, accountsTable, accountVisitsTable, settingsTable } from "@workspace/db";
import { eq, desc, and, ilike, sql, inArray, max, isNotNull } from "drizzle-orm";
import { CreateAccountBody, UpdateAccountBody, AdminListAccountsQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { formatAccount } from "./accounts";
import { logger } from "../lib/logger";
import { scrapeFacebookFollowers } from "../lib/facebookScraper";
import { syncAccountUrls } from "../lib/accountUrlSync";
import { ocrScanExistingAccounts } from "../lib/ocrScanAccounts";

// Auto-generate a profile URL from username when accountUrl is not provided
function buildProfileUrl(
  platform: string,
  username: string | null | undefined,
  accountUrl: string | null | undefined,
): string | null {
  if (accountUrl) return accountUrl;
  if (!username) return null;
  const u = username.replace(/^@/, "");
  if (platform === "tiktok" || platform === "tiktok_monetized") return `https://www.tiktok.com/@${u}`;
  if (platform === "instagram") return `https://www.instagram.com/${u}`;
  if (platform === "facebook") return `https://www.facebook.com/${u}`;
  return null;
}

const router = Router();
router.use(requireAuth);

// ── GET /admin/me — alias for /auth/me (some clients call this path) ─────────
router.get("/me", (req, res) => {
  res.json({ email: (req as any).admin.email });
});

router.get("/accounts", async (req, res) => {
  const parse = AdminListAccountsQueryParams.safeParse(req.query);
  const params = parse.success ? parse.data : {};

  const conditions: ReturnType<typeof eq>[] = [];
  if (params.platform) conditions.push(eq(accountsTable.platform, params.platform));
  if (params.status) conditions.push(eq(accountsTable.status, params.status));

  let rows;
  if (params.search) {
    const searchCond = ilike(accountsTable.name, `%${params.search}%`);
    if (conditions.length > 0) {
      rows = await db
        .select()
        .from(accountsTable)
        .where(and(...conditions, searchCond))
        .orderBy(desc(accountsTable.createdAt));
    } else {
      rows = await db
        .select()
        .from(accountsTable)
        .where(searchCond)
        .orderBy(desc(accountsTable.createdAt));
    }
  } else if (conditions.length > 0) {
    rows = await db
      .select()
      .from(accountsTable)
      .where(and(...conditions))
      .orderBy(desc(accountsTable.createdAt));
  } else {
    rows = await db
      .select()
      .from(accountsTable)
      .orderBy(desc(accountsTable.createdAt));
  }

  res.json(rows.map(formatAccount));
});

router.post("/accounts", async (req, res) => {
  const parse = CreateAccountBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid data", details: parse.error.flatten() });
    return;
  }
  const data = parse.data;
  const resolvedUrl = buildProfileUrl(data.platform, data.username, data.accountUrl);
  const [row] = await db
    .insert(accountsTable)
    .values({
      name: data.name,
      platform: data.platform,
      followers: data.followers,
      price: String(data.price),
      description: data.description ?? null,
      username: data.username ?? null,
      imageUrl: data.imageUrl ?? null,
      accountUrl: resolvedUrl,
      status: data.status ?? "available",
      featured: data.featured ?? false,
      earningsStatus: data.earningsStatus ?? null,
      eligibleCountry: data.eligibleCountry ?? null,
      activationDate: data.activationDate ?? null,
      earningsNotes: data.earningsNotes ?? null,
      avgEarningsPer10k: data.avgEarningsPer10k != null ? String(data.avgEarningsPer10k) : null,
    })
    .returning();
  res.status(201).json(formatAccount(row as Record<string, unknown>));
  syncAccountUrls("mutation").catch((e) => logger.error({ err: e }, "accountUrlSync failed after create"));
});

router.patch("/accounts/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parse = UpdateAccountBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid data", details: parse.error.flatten() });
    return;
  }
  const data = parse.data;

  const updateData: Partial<typeof accountsTable.$inferInsert> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.platform !== undefined) updateData.platform = data.platform;
  if (data.followers !== undefined) updateData.followers = data.followers;
  if (data.price !== undefined) updateData.price = String(data.price);
  if (data.description !== undefined) updateData.description = data.description;
  if (data.username !== undefined) updateData.username = data.username ?? null;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.featured !== undefined) updateData.featured = data.featured;
  if (data.earningsStatus !== undefined) updateData.earningsStatus = data.earningsStatus ?? null;
  if (data.eligibleCountry !== undefined) updateData.eligibleCountry = data.eligibleCountry ?? null;
  if (data.activationDate !== undefined) updateData.activationDate = data.activationDate ?? null;
  if (data.earningsNotes !== undefined) updateData.earningsNotes = data.earningsNotes ?? null;
  if (data.avgEarningsPer10k !== undefined) updateData.avgEarningsPer10k = data.avgEarningsPer10k != null ? String(data.avgEarningsPer10k) : null;

  // Resolve accountUrl: explicit value wins; if username was set but no URL, auto-generate
  if (data.accountUrl !== undefined) {
    updateData.accountUrl = data.accountUrl;
  } else if (data.username !== undefined) {
    // username changed — re-derive the URL (use updated platform if provided, else keep current via DB read)
    const platform = data.platform ?? (updateData.platform as string | undefined);
    if (platform) {
      updateData.accountUrl = buildProfileUrl(platform, data.username, undefined) ?? undefined;
    }
  }

  const [row] = await db
    .update(accountsTable)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(accountsTable.id, id))
    .returning();

  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatAccount(row as Record<string, unknown>));
  syncAccountUrls("mutation").catch((e) => logger.error({ err: e }, "accountUrlSync failed after update"));
});

router.delete("/accounts/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  // Fetch telegramMessageId before deleting so we can blocklist it
  const [row] = await db
    .select({ id: accountsTable.id, telegramMessageId: accountsTable.telegramMessageId })
    .from(accountsTable)
    .where(eq(accountsTable.id, id))
    .limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }

  // If account came from Telegram, add its message_id to the blocklist
  // so that the auto-sync never re-imports it
  if (row.telegramMessageId) {
    const [existing] = await db
      .select({ value: settingsTable.value })
      .from(settingsTable)
      .where(eq(settingsTable.key, "deleted_telegram_ids"))
      .limit(1);

    const blocked: number[] = existing
      ? JSON.parse(existing.value || "[]")
      : [];

    if (!blocked.includes(row.telegramMessageId)) {
      blocked.push(row.telegramMessageId);
    }

    await db
      .insert(settingsTable)
      .values({ key: "deleted_telegram_ids", value: JSON.stringify(blocked) })
      .onConflictDoUpdate({
        target: settingsTable.key,
        set: { value: JSON.stringify(blocked) },
      });

    logger.info(
      { accountId: id, telegramMessageId: row.telegramMessageId, totalBlocked: blocked.length },
      "🚫 أُضيف telegram_message_id إلى قائمة الحظر"
    );
  }

  await db.delete(accountsTable).where(eq(accountsTable.id, id));
  res.json({ success: true });
});

// ── POST /admin/facebook/sync ─────────────────────────────────────────────────
router.post("/facebook/sync", async (req, res) => {
  const accounts = await db
    .select()
    .from(accountsTable)
    .where(and(eq(accountsTable.platform, "facebook"), isNotNull(accountsTable.accountUrl)));

  // Deduplicate URLs — scrape each unique URL once, then reuse result
  const urlCache = new Map<string, Awaited<ReturnType<typeof scrapeFacebookFollowers>>>();
  const uniqueUrls = [...new Set(accounts.map(a => a.accountUrl).filter(Boolean) as string[])];

  await Promise.allSettled(
    uniqueUrls.map(async (url) => {
      const result = await scrapeFacebookFollowers(url);
      urlCache.set(url, result);
    })
  );

  const results: Array<{
    accountId: number;
    accountName: string;
    status: "updated" | "unchanged" | "failed";
    oldCount: number;
    newCount?: number;
    resolvedUrl?: string;
    reason?: string;
  }> = [];

  const now = new Date();

  for (const account of accounts) {
    if (!account.accountUrl) continue;

    const scrape = urlCache.get(account.accountUrl) ?? { success: false, reason: "لا نتيجة" };

    if (scrape.success && scrape.count !== undefined) {
      const oldCount = account.followers ?? 0;
      const changed  = scrape.count !== oldCount;

      if (changed) {
        await db
          .update(accountsTable)
          .set({ followers: scrape.count, followersUpdatedAt: now })
          .where(eq(accountsTable.id, account.id));
      }

      results.push({
        accountId:   account.id,
        accountName: account.name,
        status:      changed ? "updated" : "unchanged",
        oldCount,
        newCount:    scrape.count,
        resolvedUrl: scrape.resolvedUrl,
      });
    } else {
      logger.warn(
        { accountId: account.id, accountName: account.name, reason: scrape.reason },
        "facebook/sync: فشل جلب المتابعين"
      );
      results.push({
        accountId:   account.id,
        accountName: account.name,
        status:      "failed",
        oldCount:    account.followers ?? 0,
        resolvedUrl: scrape.resolvedUrl,
        reason:      scrape.reason ?? "خطأ غير معروف",
      });
    }
  }

  res.json({
    total:     accounts.length,
    updated:   results.filter(r => r.status === "updated").length,
    unchanged: results.filter(r => r.status === "unchanged").length,
    failed:    results.filter(r => r.status === "failed").length,
    results,
  });
  syncAccountUrls("sync").catch((e) => logger.error({ err: e }, "accountUrlSync failed after facebook/sync"));
});

// ── GET /admin/visits/stats ──────────────────────────────────────────────────
router.get("/visits/stats", async (_req, res) => {
  const [totals] = await db
    .select({ total: sql<number>`coalesce(sum(${accountsTable.visitCount}), 0)` })
    .from(accountsTable);

  const rows = await db
    .select({
      accountId:    accountVisitsTable.accountId,
      accountTitle: accountVisitsTable.accountTitle,
      visitCount:   sql<number>`count(*)::int`,
      lastVisit:    max(accountVisitsTable.visitedAt),
    })
    .from(accountVisitsTable)
    .groupBy(accountVisitsTable.accountId, accountVisitsTable.accountTitle)
    .orderBy(desc(sql`count(*)`))
    .limit(20);

  const ids = rows.map(r => r.accountId);
  const accMap: Record<number, { platform: string; imageUrl: string | null }> = {};
  if (ids.length) {
    const accs = await db
      .select({ id: accountsTable.id, platform: accountsTable.platform, imageUrl: accountsTable.imageUrl })
      .from(accountsTable)
      .where(inArray(accountsTable.id, ids));
    for (const a of accs) accMap[a.id] = { platform: a.platform, imageUrl: a.imageUrl };
  }

  res.json({
    totalVisits: Number(totals.total),
    topAccounts: rows.map(r => ({
      accountId:    r.accountId,
      accountTitle: r.accountTitle,
      platform:     accMap[r.accountId]?.platform ?? "tiktok",
      imageUrl:     accMap[r.accountId]?.imageUrl ?? null,
      visitCount:   Number(r.visitCount),
      lastVisit:    r.lastVisit instanceof Date
        ? r.lastVisit.toISOString()
        : (r.lastVisit ? String(r.lastVisit) : null),
    })),
  });
});

// ── POST /admin/ocr-scan — trigger a full OCR scan of accounts without URLs ──
router.post("/ocr-scan", async (_req, res) => {
  // Run synchronously so the caller gets the full report back
  try {
    const report = await ocrScanExistingAccounts();
    res.json({ success: true, report });
  } catch (err) {
    logger.error({ err }, "POST /admin/ocr-scan فشل");
    res.status(500).json({ success: false, error: String(err) });
  }
});

export default router;
