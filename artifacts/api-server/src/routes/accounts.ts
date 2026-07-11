import { Router } from "express";
import { db, accountsTable, accountVisitsTable } from "@workspace/db";
import { eq, desc, and, sql, asc, gte } from "drizzle-orm";
import { ListAccountsQueryParams } from "@workspace/api-zod";

const router = Router();

export function formatAccount(a: Record<string, unknown>) {
  return {
    id: a.id,
    name: a.name,
    platform: a.platform,
    followers: a.followers,
    price: parseFloat(String(a.price)),
    description: a.description ?? null,
    username: a.username ?? null,
    imageUrl: a.imageUrl ?? null,
    accountUrl: a.accountUrl ?? null,
    status: a.status,
    featured: a.featured,
    clickCount: a.clickCount,
    visitCount: Number(a.visitCount ?? 0),
    earningsStatus: a.earningsStatus ?? null,
    eligibleCountry: a.eligibleCountry ?? null,
    activationDate: a.activationDate ?? null,
    earningsNotes: a.earningsNotes ?? null,
    avgEarningsPer10k: a.avgEarningsPer10k != null ? parseFloat(String(a.avgEarningsPer10k)) : null,
    followersUpdatedAt: a.followersUpdatedAt instanceof Date
      ? a.followersUpdatedAt.toISOString()
      : (a.followersUpdatedAt ? String(a.followersUpdatedAt) : null),
    createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
    updatedAt: a.updatedAt instanceof Date ? a.updatedAt.toISOString() : String(a.updatedAt),
  };
}

// ── Sort helpers ──────────────────────────────────────────────────────────────
// Sold accounts always go last regardless of sort
const statusOrder = sql`CASE WHEN ${accountsTable.status} = 'sold' THEN 1 ELSE 0 END`;

// Zero or NULL followers → sent to the end when sorting by followers
const followersZeroLast = sql`CASE WHEN COALESCE(${accountsTable.followers}, 0) = 0 THEN 1 ELSE 0 END`;

type SortKey = "followers_desc" | "followers_asc" | "newest" | "oldest" | "price_desc" | "price_asc";

function buildOrderBy(sort?: string | null) {
  const key = (sort as SortKey) ?? "followers_desc";
  switch (key) {
    case "followers_asc":
      // Zero/null still go to end even ascending (they have no real data)
      return [asc(statusOrder), asc(followersZeroLast), asc(accountsTable.followers)];
    case "newest":
      return [asc(statusOrder), desc(accountsTable.createdAt)];
    case "oldest":
      return [asc(statusOrder), asc(accountsTable.createdAt)];
    case "price_desc":
      return [asc(statusOrder), desc(accountsTable.price)];
    case "price_asc":
      return [asc(statusOrder), asc(accountsTable.price)];
    case "followers_desc":
    default:
      return [asc(statusOrder), asc(followersZeroLast), desc(accountsTable.followers)];
  }
}

// ── GET /accounts ─────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const parse = ListAccountsQueryParams.safeParse(req.query);
  const params = parse.success ? parse.data : {};

  const conditions: ReturnType<typeof eq>[] = [];
  if (params.platform) conditions.push(eq(accountsTable.platform, params.platform));
  if (params.status) conditions.push(eq(accountsTable.status, params.status));
  if (params.featured !== undefined) conditions.push(eq(accountsTable.featured, params.featured));

  const orderBy = buildOrderBy(params.sort);

  const rows = conditions.length > 0
    ? await db
        .select()
        .from(accountsTable)
        .where(and(...conditions))
        .orderBy(...orderBy)
        .limit(params.limit ?? 100)
        .offset(params.offset ?? 0)
    : await db
        .select()
        .from(accountsTable)
        .orderBy(...orderBy)
        .limit(params.limit ?? 100)
        .offset(params.offset ?? 0);

  res.json(rows.map(formatAccount));
});

router.get("/featured", async (_req, res) => {
  const rows = await db
    .select()
    .from(accountsTable)
    .where(and(eq(accountsTable.featured, true), eq(accountsTable.status, "available")))
    .orderBy(...buildOrderBy("followers_desc"))
    .limit(8);
  res.json(rows.map(formatAccount));
});

router.get("/recent", async (_req, res) => {
  const rows = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.status, "available"))
    .orderBy(...buildOrderBy("newest"))
    .limit(8);
  res.json(rows.map(formatAccount));
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(accountsTable).where(eq(accountsTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatAccount(row as Record<string, unknown>));
});

// ── POST /accounts/:id/click ─────────────────────────────────────────────────
// Increments clickCount on the account row. Called when a user clicks the
// WhatsApp button on a specific account card. No rate-limiting — raw count.
router.post("/:id/click", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [updated] = await db
    .update(accountsTable)
    .set({ clickCount: sql`${accountsTable.clickCount} + 1` })
    .where(eq(accountsTable.id, id))
    .returning({ clickCount: accountsTable.clickCount });

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ success: true, clickCount: Number(updated.clickCount ?? 0) });
});

// ── POST /accounts/:id/visit ─────────────────────────────────────────────────
// Records a visit to an account's URL. Rate-limited: 1 visit per visitorId per
// account per 30 minutes. Increments visitCount on the account row.
router.post("/:id/visit", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { visitorId } = req.body as { visitorId?: string };
  if (!visitorId) { res.status(400).json({ error: "visitorId required" }); return; }

  const [account] = await db
    .select({ id: accountsTable.id, accountUrl: accountsTable.accountUrl, visitCount: accountsTable.visitCount })
    .from(accountsTable)
    .where(eq(accountsTable.id, id));
  if (!account) { res.status(404).json({ error: "Not found" }); return; }

  // Rate-limit: check if this visitor already visited this account in the last 30 min
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
  const [existing] = await db
    .select({ id: accountVisitsTable.id })
    .from(accountVisitsTable)
    .where(
      and(
        eq(accountVisitsTable.accountId, id),
        eq(accountVisitsTable.visitorId, visitorId),
        gte(accountVisitsTable.visitedAt, thirtyMinsAgo)
      )
    )
    .limit(1);

  if (existing) {
    // Already counted — return current count without incrementing
    res.json({ counted: false, visitCount: Number(account.visitCount ?? 0), accountUrl: account.accountUrl });
    return;
  }

  // Record visit
  const [accountRow] = await db
    .select({ name: accountsTable.name })
    .from(accountsTable)
    .where(eq(accountsTable.id, id));

  await db.insert(accountVisitsTable).values({
    accountId: id,
    accountTitle: String(accountRow?.name ?? ""),
    visitorId,
    visitedAt: new Date(),
  });

  // Increment visitCount on account
  const [updated] = await db
    .update(accountsTable)
    .set({ visitCount: sql`${accountsTable.visitCount} + 1` })
    .where(eq(accountsTable.id, id))
    .returning({ visitCount: accountsTable.visitCount, accountUrl: accountsTable.accountUrl });

  res.json({ counted: true, visitCount: Number(updated.visitCount ?? 0), accountUrl: updated.accountUrl });
});

export default router;
