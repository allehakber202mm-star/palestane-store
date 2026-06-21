import { Router } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { runTelegramSync } from "../lib/telegramSync";

const router = Router();

async function handleSync(req: import("express").Request, res: import("express").Response) {
  const token = process.env.TELEGRAM_BOT_TOKEN ?? "";
  if (!token) {
    res.status(400).json({ error: "TELEGRAM_BOT_TOKEN غير مضبوط في إعدادات السيرفر" });
    return;
  }

  try {
    const result = await runTelegramSync();
    res.json({
      ...result,
      message: result.imported > 0
        ? `تم استيراد ${result.imported} حساب جديد بنجاح`
        : "لا توجد منشورات جديدة للاستيراد",
    });
  } catch (err) {
    req.log.error({ err }, "Telegram manual import error");
    res.status(500).json({ error: "فشل الاستيراد، راجع السجلات" });
  }
}

// ── POST /api/telegram/import  (manual trigger) ─────────────────────────────
router.post("/import", requireAuth, handleSync);

// ── POST /api/admin/telegram-sync  (alias for admin panel) ──────────────────
router.post("/sync", requireAuth, handleSync);

// ── POST /api/admin/telegram-reset-offset  (reset offset to re-sync all) ────
router.post("/reset-offset", requireAuth, async (req, res) => {
  try {
    await db
      .insert(settingsTable)
      .values({ key: "telegram_update_offset", value: "0" })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value: "0" } });
    res.json({ message: "تم إعادة تعيين الـ offset — ستتم مزامنة كل المنشورات في الدورة القادمة" });
  } catch (err) {
    req.log.error({ err }, "Reset offset error");
    res.status(500).json({ error: "فشل إعادة التعيين" });
  }
});

export default router;
