import { Router } from "express";
import { db, accountsTable } from "@workspace/db";
import { eq, desc, and, ilike } from "drizzle-orm";
import { CreateAccountBody, UpdateAccountBody, AdminListAccountsQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { formatAccount } from "./accounts";
import { logger } from "../lib/logger";

const router = Router();
router.use(requireAuth);

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
  const [row] = await db
    .insert(accountsTable)
    .values({
      name: data.name,
      platform: data.platform,
      followers: data.followers,
      price: String(data.price),
      description: data.description ?? null,
      imageUrl: data.imageUrl ?? null,
      accountUrl: data.accountUrl ?? null,
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
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
  if (data.accountUrl !== undefined) updateData.accountUrl = data.accountUrl;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.featured !== undefined) updateData.featured = data.featured;
  if (data.earningsStatus !== undefined) updateData.earningsStatus = data.earningsStatus ?? null;
  if (data.eligibleCountry !== undefined) updateData.eligibleCountry = data.eligibleCountry ?? null;
  if (data.activationDate !== undefined) updateData.activationDate = data.activationDate ?? null;
  if (data.earningsNotes !== undefined) updateData.earningsNotes = data.earningsNotes ?? null;
  if (data.avgEarningsPer10k !== undefined) updateData.avgEarningsPer10k = data.avgEarningsPer10k != null ? String(data.avgEarningsPer10k) : null;

  const [row] = await db
    .update(accountsTable)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(accountsTable.id, id))
    .returning();

  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatAccount(row as Record<string, unknown>));
});

router.delete("/accounts/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(accountsTable).where(eq(accountsTable.id, id));
  res.json({ success: true });
});

export default router;
