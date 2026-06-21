import { Router } from "express";
import { db } from "@workspace/db";
import { accountsTable } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { objectStorageClient } from "../lib/objectStorage";
import { randomUUID } from "crypto";

const router = Router();

const BOT_TOKEN = () => process.env.TELEGRAM_BOT_TOKEN ?? "";
const CHANNEL   = () => (process.env.TELEGRAM_CHANNEL_USERNAME ?? "Palestine_storeL").replace(/^@/, "");
const TG_API    = (method: string, token: string) =>
  `https://api.telegram.org/bot${token}/${method}`;
const TG_FILE   = (token: string, path: string) =>
  `https://api.telegram.org/file/bot${token}/${path}`;

// ── Upload a downloaded buffer directly to GCS ─────────────────────────────
async function uploadBufferToGCS(buffer: Buffer, contentType: string): Promise<string> {
  const privateDir = (process.env.PRIVATE_OBJECT_DIR ?? "").replace(/^\//, "");
  if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR not set");

  const uuid       = randomUUID();
  const fullPath   = `${privateDir}/uploads/${uuid}`;
  const parts      = fullPath.split("/");
  const bucketName = parts[0];
  const objectName = parts.slice(1).join("/");

  const bucket = objectStorageClient.bucket(bucketName);
  const file   = bucket.file(objectName);
  await file.save(buffer, { contentType, resumable: false });

  return `/api/storage/objects/uploads/${uuid}`;
}

// ── Download photo from Telegram, upload to GCS ────────────────────────────
async function importPhoto(fileId: string, token: string): Promise<string | null> {
  try {
    const fileRes = await fetch(TG_API(`getFile?file_id=${encodeURIComponent(fileId)}`, token));
    if (!fileRes.ok) return null;
    const fileData = await fileRes.json() as { ok: boolean; result?: { file_path: string } };
    if (!fileData.ok || !fileData.result?.file_path) return null;

    const imgRes = await fetch(TG_FILE(token, fileData.result.file_path));
    if (!imgRes.ok) return null;
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    return await uploadBufferToGCS(buffer, "image/jpeg");
  } catch {
    return null;
  }
}

// ── POST /api/telegram/import ──────────────────────────────────────────────
router.post("/import", requireAuth, async (req, res) => {
  const token   = BOT_TOKEN();
  const channel = CHANNEL();

  if (!token) {
    res.status(400).json({ error: "TELEGRAM_BOT_TOKEN غير مضبوط في إعدادات السيرفر" });
    return;
  }

  try {
    // Load stored update offset
    const [offsetRow] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.key, "telegram_update_offset"))
      .limit(1);
    const storedOffset = offsetRow ? parseInt(offsetRow.value, 10) : 0;

    // Fetch updates from Telegram
    const params = new URLSearchParams({
      limit: "100",
      allowed_updates: JSON.stringify(["channel_post"]),
    });
    if (storedOffset > 0) params.set("offset", String(storedOffset + 1));

    const updatesRes = await fetch(TG_API(`getUpdates?${params.toString()}`, token), {
      signal: AbortSignal.timeout(15_000),
    });
    if (!updatesRes.ok) {
      res.status(502).json({ error: "فشل الاتصال بـ Telegram API" });
      return;
    }

    type TgPhoto = { file_id: string; width: number; height: number };
    type TgPost  = {
      message_id: number;
      chat: { username?: string };
      text?: string;
      caption?: string;
      photo?: TgPhoto[];
    };
    type TgUpdate = { update_id: number; channel_post?: TgPost };

    const updatesData = await updatesRes.json() as { ok: boolean; result: TgUpdate[] };
    if (!updatesData.ok) {
      res.status(502).json({ error: "Telegram API أعاد خطأ" });
      return;
    }

    const updates = updatesData.result;
    if (!updates.length) {
      res.json({ imported: 0, skipped: 0, message: "لا توجد منشورات جديدة في القناة" });
      return;
    }

    // Filter to our channel's posts only
    const posts = updates
      .filter(u => u.channel_post?.chat.username?.toLowerCase() === channel.toLowerCase())
      .map(u => ({ update_id: u.update_id, post: u.channel_post! }));

    // Detect already-imported message IDs from the DB
    const messageIds = posts.map(p => p.post.message_id);
    const existing   = messageIds.length
      ? await db
          .select({ tgId: accountsTable.telegramMessageId })
          .from(accountsTable)
          .where(inArray(accountsTable.telegramMessageId, messageIds))
      : [];
    const existingIds = new Set(existing.map(r => r.tgId));

    let imported = 0;
    let skipped  = 0;

    for (const { post } of posts) {
      if (existingIds.has(post.message_id)) {
        skipped++;
        continue;
      }

      const rawText   = post.caption ?? post.text ?? "";
      const lines     = rawText.split("\n").map(l => l.trim()).filter(Boolean);
      const name      = lines[0]?.slice(0, 120) || `منشور #${post.message_id}`;
      const description = lines.length > 1 ? lines.slice(1).join("\n") : (rawText || null);

      // Download the largest available photo
      let imageUrl: string | null = null;
      if (post.photo?.length) {
        const largest = post.photo.reduce((a, b) =>
          a.width * a.height >= b.width * b.height ? a : b
        );
        imageUrl = await importPhoto(largest.file_id, token);
      }

      await db.insert(accountsTable).values({
        name,
        platform: "tiktok",
        followers: 0,
        price: "0",
        description,
        imageUrl,
        status: "available",
        featured: false,
        telegramMessageId: post.message_id,
      });
      imported++;
    }

    // Advance the stored update offset
    const maxUpdateId = Math.max(...updates.map(u => u.update_id));
    await db
      .insert(settingsTable)
      .values({ key: "telegram_update_offset", value: String(maxUpdateId) })
      .onConflictDoUpdate({
        target: settingsTable.key,
        set: { value: String(maxUpdateId) },
      });

    res.json({
      imported,
      skipped,
      total: posts.length,
      message: imported > 0
        ? `تم استيراد ${imported} حساب جديد بنجاح`
        : "لا توجد منشورات جديدة للاستيراد",
    });
  } catch (err) {
    req.log.error({ err }, "Telegram import error");
    res.status(500).json({ error: "فشل الاستيراد، راجع السجلات" });
  }
});

export default router;
