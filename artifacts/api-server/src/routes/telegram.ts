import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { runTelegramSync } from "../lib/telegramSync";

const router = Router();

// ── POST /api/telegram/import  (manual trigger — requires admin JWT) ────────
router.post("/import", requireAuth, async (req, res) => {
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
});

export default router;
