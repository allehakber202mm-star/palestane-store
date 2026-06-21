import { db, accountsTable, settingsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { objectStorageClient } from "./objectStorage";
import { randomUUID } from "crypto";
import { logger } from "./logger";

const BOT_TOKEN = () => process.env.TELEGRAM_BOT_TOKEN ?? "";
const CHANNEL   = () =>
  (process.env.TELEGRAM_CHANNEL_USERNAME ?? "Palestine_storeL").replace(/^@/, "");
const TG_API = (method: string, token: string) =>
  `https://api.telegram.org/bot${token}/${method}`;
const TG_FILE = (token: string, filePath: string) =>
  `https://api.telegram.org/file/bot${token}/${filePath}`;

// ── Types ──────────────────────────────────────────────────────────────────
export type TgPhoto  = { file_id: string; width: number; height: number };
export type TgPost   = {
  message_id: number;
  chat: { username?: string };
  text?: string;
  caption?: string;
  photo?: TgPhoto[];
};
export type TgUpdate = { update_id: number; channel_post?: TgPost };

export interface SyncResult {
  imported: number;
  skipped:  number;
  total:    number;
}

// ── Upload buffer directly to GCS ─────────────────────────────────────────
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
    const fileRes = await fetch(TG_API(`getFile?file_id=${encodeURIComponent(fileId)}`, token), {
      signal: AbortSignal.timeout(10_000),
    });
    if (!fileRes.ok) return null;
    const fileData = await fileRes.json() as { ok: boolean; result?: { file_path: string } };
    if (!fileData.ok || !fileData.result?.file_path) return null;

    const imgRes = await fetch(TG_FILE(token, fileData.result.file_path), {
      signal: AbortSignal.timeout(30_000),
    });
    if (!imgRes.ok) return null;
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    return await uploadBufferToGCS(buffer, "image/jpeg");
  } catch {
    return null;
  }
}

// ── Core sync function (used by both route and background job) ─────────────
export async function runTelegramSync(): Promise<SyncResult> {
  const token   = BOT_TOKEN();
  const channel = CHANNEL();

  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");

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
  if (!updatesRes.ok) throw new Error(`Telegram API HTTP ${updatesRes.status}`);

  const updatesData = await updatesRes.json() as { ok: boolean; result: TgUpdate[] };
  if (!updatesData.ok) throw new Error("Telegram API returned ok:false");

  const updates = updatesData.result;
  if (!updates.length) return { imported: 0, skipped: 0, total: 0 };

  // Filter to our channel posts only
  const posts = updates
    .filter(u => u.channel_post?.chat.username?.toLowerCase() === channel.toLowerCase())
    .map(u => ({ update_id: u.update_id, post: u.channel_post! }));

  // Detect already-imported message IDs
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
    if (existingIds.has(post.message_id)) { skipped++; continue; }

    const rawText     = post.caption ?? post.text ?? "";
    const lines       = rawText.split("\n").map(l => l.trim()).filter(Boolean);
    const name        = lines[0]?.slice(0, 120) || `منشور #${post.message_id}`;
    const description = lines.length > 1 ? lines.slice(1).join("\n") : (rawText || null);

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
    logger.info({ messageId: post.message_id, name }, "Telegram: imported account");
  }

  // Advance the stored offset
  const maxUpdateId = Math.max(...updates.map(u => u.update_id));
  await db
    .insert(settingsTable)
    .values({ key: "telegram_update_offset", value: String(maxUpdateId) })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { value: String(maxUpdateId) },
    });

  return { imported, skipped, total: posts.length };
}

// ── Background auto-sync (call once at startup) ────────────────────────────
const POLL_INTERVAL_MS = 60_000; // 60 seconds
let   syncTimer: ReturnType<typeof setInterval> | null = null;
let   running = false;

async function tick() {
  if (running) return; // skip if previous tick still in progress
  running = true;
  try {
    const result = await runTelegramSync();
    if (result.imported > 0) {
      logger.info(result, "Telegram auto-sync: new accounts imported");
    }
  } catch (err) {
    logger.warn({ err }, "Telegram auto-sync: error (will retry next tick)");
  } finally {
    running = false;
  }
}

export function startTelegramAutoSync() {
  if (syncTimer) return; // already started
  const token = BOT_TOKEN();
  if (!token) {
    logger.warn("Telegram auto-sync: TELEGRAM_BOT_TOKEN not set — skipping");
    return;
  }
  logger.info({ intervalMs: POLL_INTERVAL_MS }, "Telegram auto-sync: started");
  // First tick after 5 s so the server is fully up
  setTimeout(tick, 5_000);
  syncTimer = setInterval(tick, POLL_INTERVAL_MS);
}
