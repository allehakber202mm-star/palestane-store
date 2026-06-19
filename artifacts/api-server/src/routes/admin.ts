import { Router } from "express";
import { db, accountsTable } from "@workspace/db";
import { eq, desc, and, ilike, or } from "drizzle-orm";
import { CreateAccountBody, UpdateAccountBody, AdminListAccountsQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { formatAccount } from "./accounts";
import multer from "multer";
import path from "path";
import fs from "fs";
import { logger } from "../lib/logger";

const router = Router();
router.use(requireAuth);

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const uploadsDir = path.resolve(workspaceRoot, "artifacts/api-server/uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images allowed"));
  },
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
    rows = await db.select().from(accountsTable).orderBy(desc(accountsTable.createdAt));
  }

  res.json(rows.map(formatAccount));
});

router.post("/accounts", async (req, res) => {
  const parse = CreateAccountBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid input", details: parse.error.issues });
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
      status: data.status ?? "available",
      featured: data.featured ?? false,
    })
    .returning();
  res.status(201).json(formatAccount(row as Record<string, unknown>));
});

router.patch("/accounts/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parse = UpdateAccountBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid input", details: parse.error.issues });
    return;
  }

  const data = parse.data;
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.platform !== undefined) updateData.platform = data.platform;
  if (data.followers !== undefined) updateData.followers = data.followers;
  if (data.price !== undefined) updateData.price = String(data.price);
  if (data.description !== undefined) updateData.description = data.description;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.featured !== undefined) updateData.featured = data.featured;

  const [row] = await db
    .update(accountsTable)
    .set(updateData)
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

router.post("/accounts/upload-image", upload.single("image"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const url = `/api/uploads/${req.file.filename}`;
  res.json({ url });
});

export default router;
