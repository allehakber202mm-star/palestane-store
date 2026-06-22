import { Router } from "express";
import { db, accountsTable, statsTable } from "@workspace/db";
import { eq, desc, and, sql, asc } from "drizzle-orm";
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
    earningsStatus: a.earningsStatus ?? null,
    eligibleCountry: a.eligibleCountry ?? null,
    activationDate: a.activationDate ?? null,
    earningsNotes: a.earningsNotes ?? null,
    avgEarningsPer10k: a.avgEarningsPer10k != null ? parseFloat(String(a.avgEarningsPer10k)) : null,
    createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
    updatedAt: a.updatedAt instanceof Date ? a.updatedAt.toISOString() : String(a.updatedAt),
  };
}

router.get("/", async (req, res) => {
  const parse = ListAccountsQueryParams.safeParse(req.query);
  const params = parse.success ? parse.data : {};

  const conditions: ReturnType<typeof eq>[] = [];
  if (params.platform) conditions.push(eq(accountsTable.platform, params.platform));
  if (params.status) conditions.push(eq(accountsTable.status, params.status));
  if (params.featured !== undefined) conditions.push(eq(accountsTable.featured, params.featured));

  // available first, sold last — then by followers desc
  const statusOrder = sql`CASE WHEN ${accountsTable.status} = 'sold' THEN 1 ELSE 0 END`;

  let rows;
  if (conditions.length > 0) {
    rows = await db
      .select()
      .from(accountsTable)
      .where(and(...conditions))
      .orderBy(asc(statusOrder), desc(accountsTable.followers))
      .limit(params.limit ?? 50)
      .offset(params.offset ?? 0);
  } else {
    rows = await db
      .select()
      .from(accountsTable)
      .orderBy(asc(statusOrder), desc(accountsTable.followers))
      .limit(params.limit ?? 50)
      .offset(params.offset ?? 0);
  }

  res.json(rows.map(formatAccount));
});

router.get("/featured", async (_req, res) => {
  const rows = await db
    .select()
    .from(accountsTable)
    .where(and(eq(accountsTable.featured, true), eq(accountsTable.status, "available")))
    .orderBy(desc(accountsTable.createdAt))
    .limit(8);
  res.json(rows.map(formatAccount));
});

router.get("/recent", async (_req, res) => {
  const rows = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.status, "available"))
    .orderBy(desc(accountsTable.createdAt))
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

router.post("/:id/click", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!isNaN(id)) {
    await db
      .update(accountsTable)
      .set({ clickCount: sql`${accountsTable.clickCount} + 1` })
      .where(eq(accountsTable.id, id));
    await db.insert(statsTable).values({ eventType: "account_click", accountId: id });
  }
  res.json({ success: true });
});

export default router;
