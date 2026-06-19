import { Router } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateSettingsBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router = Router();

const DEFAULT_SETTINGS = {
  storeName: "Palestine Store",
  storeNameAr: "متجر فلسطين",
  logoUrl: null,
  whatsapp: "+972566112031",
  email: "palsetanestora@gmail.com",
  bannerTitle: "متجر فلسطين للحسابات",
  bannerSubtitle: "منصة فلسطينية متخصصة في بيع حسابات السوشيال ميديا الجاهزة بشكل آمن وسريع",
  paymentMethods: JSON.stringify(["بنك فلسطين", "البنك العربي", "Reflect", "بنك هبوعليم", "شركة توصيل"]),
  paymentNote: "يمكن الدفع عبر التحويل البنكي أو من خلال شركة التوصيل حسب الاتفاق.",
};

async function getSettingsMap(): Promise<Record<string, string>> {
  const rows = await db.select().from(settingsTable);
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}

function buildSettings(map: Record<string, string>) {
  const pm = map.paymentMethods ? JSON.parse(map.paymentMethods) : JSON.parse(DEFAULT_SETTINGS.paymentMethods);
  return {
    storeName: map.storeName ?? DEFAULT_SETTINGS.storeName,
    storeNameAr: map.storeNameAr ?? DEFAULT_SETTINGS.storeNameAr,
    logoUrl: map.logoUrl ?? null,
    whatsapp: map.whatsapp ?? DEFAULT_SETTINGS.whatsapp,
    email: map.email ?? DEFAULT_SETTINGS.email,
    bannerTitle: map.bannerTitle ?? DEFAULT_SETTINGS.bannerTitle,
    bannerSubtitle: map.bannerSubtitle ?? DEFAULT_SETTINGS.bannerSubtitle,
    paymentMethods: pm,
    paymentNote: map.paymentNote ?? DEFAULT_SETTINGS.paymentNote,
  };
}

router.get("/", async (_req, res) => {
  const map = await getSettingsMap();
  res.json(buildSettings(map));
});

router.patch("/", requireAuth, async (req, res) => {
  const parse = UpdateSettingsBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const data = parse.data;
  const updates: { key: string; value: string }[] = [];

  if (data.storeName !== undefined) updates.push({ key: "storeName", value: data.storeName });
  if (data.storeNameAr !== undefined) updates.push({ key: "storeNameAr", value: data.storeNameAr });
  if (data.logoUrl !== undefined) updates.push({ key: "logoUrl", value: data.logoUrl });
  if (data.whatsapp !== undefined) updates.push({ key: "whatsapp", value: data.whatsapp });
  if (data.email !== undefined) updates.push({ key: "email", value: data.email });
  if (data.bannerTitle !== undefined) updates.push({ key: "bannerTitle", value: data.bannerTitle });
  if (data.bannerSubtitle !== undefined) updates.push({ key: "bannerSubtitle", value: data.bannerSubtitle });
  if (data.paymentMethods !== undefined) updates.push({ key: "paymentMethods", value: JSON.stringify(data.paymentMethods) });
  if (data.paymentNote !== undefined) updates.push({ key: "paymentNote", value: data.paymentNote });

  for (const { key, value } of updates) {
    const existing = await db.select().from(settingsTable).where(eq(settingsTable.key, key));
    if (existing.length > 0) {
      await db.update(settingsTable).set({ value }).where(eq(settingsTable.key, key));
    } else {
      await db.insert(settingsTable).values({ key, value });
    }
  }

  const map = await getSettingsMap();
  res.json(buildSettings(map));
});

export default router;
