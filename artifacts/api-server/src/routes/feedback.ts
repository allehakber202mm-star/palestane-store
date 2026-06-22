import { Router } from "express";
import { db, feedbackPostsTable, settingsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { requireAuth } from "../middlewares/auth";
import { runTelegramSync } from "../lib/telegramSync";

const router = Router();

const BOT_TOKEN = () => process.env.TELEGRAM_BOT_TOKEN ?? "";
const TG_API = (method: string, token: string) =>
  `https://api.telegram.org/bot${token}/${method}`;

function formatPost(r: typeof feedbackPostsTable.$inferSelect) {
  return {
    id: r.id,
    telegramMessageId: r.telegramMessageId,
    text: r.text ?? null,
    imageUrl: r.imageUrl ?? null,
    videoUrl: (r as Record<string, unknown>).videoUrl ?? null,
    postedAt: r.postedAt instanceof Date ? r.postedAt.toISOString() : String(r.postedAt),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
  };
}

// ── Public: list feedback posts ───────────────────────────────────────────
router.get("/", async (_req, res) => {
  const rows = await db
    .select()
    .from(feedbackPostsTable)
    .orderBy(desc(feedbackPostsTable.postedAt));
  res.json(rows.map(formatPost));
});

// ── Admin: debug — full diagnostic without consuming offset ───────────────
router.get("/debug", requireAuth, async (req, res) => {
  const token = BOT_TOKEN();
  const feedbackChannel = (process.env.TELEGRAM_FEEDBACK_CHANNEL ?? "palestinestore01").replace(/^@/, "");
  const accountsChannel = (process.env.TELEGRAM_CHANNEL_USERNAME ?? "Palestine_storeL").replace(/^@/, "");

  const diagnostics: Record<string, unknown> = {
    config: {
      hasBotToken: !!token,
      feedbackChannel,
      accountsChannel,
    },
  };

  // 1. getMe — verify bot token
  try {
    const meRes = await fetch(TG_API("getMe", token), { signal: AbortSignal.timeout(8_000) });
    const meData = await meRes.json();
    diagnostics.getMe = meData;
  } catch (err) {
    diagnostics.getMe = { error: String(err) };
  }

  // 2. getChat for feedback channel
  try {
    const chatRes = await fetch(
      TG_API(`getChat?chat_id=@${feedbackChannel}`, token),
      { signal: AbortSignal.timeout(8_000) },
    );
    const chatData = await chatRes.json();
    diagnostics.feedbackChannelInfo = chatData;
  } catch (err) {
    diagnostics.feedbackChannelInfo = { error: String(err) };
  }

  // 3. getChatAdministrators — check if bot is admin in feedback channel
  try {
    const adminsRes = await fetch(
      TG_API(`getChatAdministrators?chat_id=@${feedbackChannel}`, token),
      { signal: AbortSignal.timeout(8_000) },
    );
    const adminsData = await adminsRes.json() as {
      ok: boolean;
      result?: Array<{ user: { id: number; username?: string; is_bot?: boolean }; status: string }>;
      description?: string;
    };
    const meData = diagnostics.getMe as Record<string, unknown>;
    const botId = (meData?.result as Record<string, unknown>)?.id as number;
    if (adminsData.ok && adminsData.result) {
      const botAdmin = adminsData.result.find(a => a.user.id === botId);
      diagnostics.botAdminStatus = {
        isAdmin: !!botAdmin,
        status: botAdmin?.status ?? "not_found",
        adminCount: adminsData.result.length,
        admins: adminsData.result.map(a => ({ username: a.user.username, status: a.status, is_bot: a.user.is_bot })),
        verdict: botAdmin
          ? `✅ البوت مشرف في القناة بصلاحية: ${botAdmin.status}`
          : `❌ البوت ليس مشرفاً في القناة — يجب إضافته كمشرف لاستقبال الرسائل`,
      };
    } else {
      diagnostics.botAdminStatus = {
        isAdmin: false,
        error: adminsData.description ?? "getChatAdministrators فشل",
        verdict: "❌ لا يمكن التحقق — البوت على الأرجح ليس مشرفاً",
      };
    }
  } catch (err) {
    diagnostics.botAdminStatus = { error: String(err) };
  }

  // 3b. getChatMember — check bot's own membership
  try {
    const meData = diagnostics.getMe as Record<string, unknown>;
    const botId = (meData?.result as Record<string, unknown>)?.id;
    if (botId) {
      const memberRes = await fetch(
        TG_API(`getChatMember?chat_id=@${feedbackChannel}&user_id=${botId}`, token),
        { signal: AbortSignal.timeout(8_000) },
      );
      const memberData = await memberRes.json();
      diagnostics.botMemberStatus = memberData;
    }
  } catch (err) {
    diagnostics.botMemberStatus = { error: String(err) };
  }

  // 4. DB stored offset
  try {
    const [offsetRow] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "telegram_update_offset"))
      .limit(1);
    diagnostics.storedOffset = offsetRow?.value ?? "0 (not set)";
  } catch (err) {
    diagnostics.storedOffset = { error: String(err) };
  }

  // 5. getUpdates — NO offset to see pending queue (does not advance offset unless limit acknowledged)
  try {
    const params = new URLSearchParams({
      limit: "20",
      allowed_updates: JSON.stringify(["channel_post", "edited_channel_post", "message"]),
    });
    const updatesRes = await fetch(TG_API(`getUpdates?${params}`, token), {
      signal: AbortSignal.timeout(10_000),
    });
    const updatesData = await updatesRes.json() as {
      ok: boolean;
      result?: Array<{
        update_id: number;
        channel_post?: { message_id: number; chat: { id: number; username?: string; title?: string }; text?: string; caption?: string; photo?: unknown[]; video?: unknown };
        message?: { message_id: number; chat: { id: number; username?: string; title?: string }; text?: string };
      }>;
    };
    diagnostics.pendingUpdates = {
      ok: updatesData.ok,
      count: updatesData.result?.length ?? 0,
      updates: (updatesData.result ?? []).map(u => ({
        update_id: u.update_id,
        type: u.channel_post ? "channel_post" : u.message ? "message" : "other",
        chat_id: u.channel_post?.chat?.id ?? u.message?.chat?.id,
        chat_username: u.channel_post?.chat?.username ?? u.message?.chat?.username,
        chat_title: u.channel_post?.chat?.title ?? u.message?.chat?.title,
        message_id: u.channel_post?.message_id ?? u.message?.message_id,
        has_photo: !!(u.channel_post?.photo?.length),
        has_video: !!(u.channel_post?.video),
        has_text: !!(u.channel_post?.text ?? u.channel_post?.caption ?? u.message?.text),
        text_preview: (u.channel_post?.text ?? u.channel_post?.caption ?? u.message?.text ?? "").slice(0, 80),
        matchesAccountChannel: u.channel_post?.chat?.username?.toLowerCase() === accountsChannel.toLowerCase(),
        matchesFeedbackChannel: u.channel_post?.chat?.username?.toLowerCase() === feedbackChannel.toLowerCase(),
      })),
    };
  } catch (err) {
    diagnostics.pendingUpdates = { error: String(err) };
  }

  // 6. DB feedback posts count
  try {
    const rows = await db.select().from(feedbackPostsTable).orderBy(desc(feedbackPostsTable.postedAt)).limit(20);
    diagnostics.dbFeedbackPosts = {
      count: rows.length,
      recent: rows.map(r => ({
        id: r.id,
        telegramMessageId: r.telegramMessageId,
        text: r.text?.slice(0, 100),
        hasImage: !!r.imageUrl,
        postedAt: r.postedAt,
      })),
    };
  } catch (err) {
    diagnostics.dbFeedbackPosts = { error: String(err) };
  }

  logger.info({ diagnostics }, "Feedback debug: تقرير تشخيصي كامل");
  res.json(diagnostics);
});

// ── Admin: manual sync ────────────────────────────────────────────────────
router.post("/sync", requireAuth, async (req, res) => {
  try {
    logger.info("Feedback: مزامنة يدوية بدأت");
    const result = await runTelegramSync();
    logger.info(result, "Feedback: مزامنة يدوية اكتملت");
    res.json({ ok: true, result });
  } catch (err) {
    logger.error({ err }, "Feedback: مزامنة يدوية فشلت");
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ── Admin: reset offset → re-sync from Telegram queue start ──────────────
router.post("/reset-offset", requireAuth, async (req, res) => {
  try {
    await db
      .insert(settingsTable)
      .values({ key: "telegram_update_offset", value: "0" })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value: "0" } });
    logger.info("Feedback: تم إعادة ضبط telegram_update_offset إلى 0");
    const result = await runTelegramSync();
    logger.info(result, "Feedback: مزامنة بعد إعادة الضبط اكتملت");
    res.json({ ok: true, message: "تم إعادة ضبط الـ offset وتشغيل المزامنة", result });
  } catch (err) {
    logger.error({ err }, "Feedback: إعادة ضبط الـ offset فشلت");
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ── Admin: delete single feedback post ───────────────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) return void res.status(400).json({ error: "id غير صالح" });
  await db.delete(feedbackPostsTable).where(eq(feedbackPostsTable.id, id));
  logger.info({ id }, "Feedback: منشور محذوف");
  res.json({ ok: true });
});

export default router;
