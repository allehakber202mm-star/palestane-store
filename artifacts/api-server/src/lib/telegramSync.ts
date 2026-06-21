import { db, accountsTable, settingsTable } from "@workspace/db";
import { eq, inArray, or } from "drizzle-orm";
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

// ─────────────────────────────────────────────────────────────────────────────
// TEXT PARSER — extracts structured account data from a raw post body
// ─────────────────────────────────────────────────────────────────────────────
export interface ParsedAccount {
  username:   string | null;
  accountUrl: string | null;
  platform:   string;         // tiktok | instagram | facebook | tiktok_monetized
  followers:  number;
  price:      number;
  name:       string;
  description: string | null;
  parseLog: {
    username:   string;
    accountUrl: string;
    platform:   string;
    followers:  string;
    price:      string;
  };
}

/** Convert "1.2M" / "58K" / "58,000" / "58000" → integer */
function parseFollowerNumber(raw: string): number {
  const s = raw.replace(/,/g, "").trim();
  const m = /^(\d+(?:\.\d+)?)([KkMm]?)$/.exec(s);
  if (!m) return 0;
  const n   = parseFloat(m[1]);
  const mul = m[2].toLowerCase() === "k" ? 1_000
            : m[2].toLowerCase() === "m" ? 1_000_000
            : 1;
  return Math.round(n * mul);
}

/** Clean a raw URL — strip trailing punctuation / Markdown noise */
function cleanUrl(raw: string): string {
  return raw.replace(/[),.\]>]+$/, "").trim();
}

export function parsePostText(rawText: string, messageId: number): ParsedAccount {
  const text = rawText.trim();

  // ── 1. Platform + URL + Username from links ─────────────────────────────
  let platform   = "tiktok";
  let accountUrl: string | null = null;
  let username:   string | null = null;
  let urlLog = "لم يُعثر على رابط";

  // Full platform URL patterns (vm.tiktok, tiktok, instagram, facebook)
  const urlRx = /https?:\/\/(?:www\.)?((?:vm\.)?tiktok\.com|instagram\.com|(?:www\.)?facebook\.com|fb\.com)\/([^\s,)\]]+)/i;
  const urlM  = urlRx.exec(text);
  if (urlM) {
    accountUrl = cleanUrl(urlM[0]);
    const domain = urlM[1].toLowerCase();
    const pathPart = urlM[2];

    if (domain.includes("instagram"))         platform = "instagram";
    else if (domain.includes("facebook") || domain === "fb.com") platform = "facebook";
    else                                       platform = "tiktok";

    // Extract username from path
    const tikMatch = /^@?([^/?&\s]+)/.exec(pathPart.replace(/^@/, ""));
    if (tikMatch) {
      username = tikMatch[1].replace(/^@/, "");
    }
    urlLog = `وُجد رابط: ${accountUrl}`;
  }

  // ── 2. @Username — if no URL found or username still missing ─────────────
  let usernameLog = username
    ? `استُخرج من الرابط: @${username}`
    : "لم يُعثر على username";

  if (!username) {
    // Exclude the channel's own @mention; pick first @word that looks like a handle
    const atRx = /@([A-Za-z0-9._]{3,})/g;
    let atM: RegExpExecArray | null;
    while ((atM = atRx.exec(text)) !== null) {
      const handle = atM[1];
      // Skip generic words that are clearly not handles
      if (!/^(Palestine_storeL|admin|bot)$/i.test(handle)) {
        username = handle;
        usernameLog = `استُخرج من النص: @${username}`;
        break;
      }
    }
  }

  // Construct accountUrl from username if URL still missing
  if (!accountUrl && username) {
    if      (platform === "instagram") accountUrl = `https://www.instagram.com/${username}`;
    else if (platform === "facebook")  accountUrl = `https://www.facebook.com/${username}`;
    else                               accountUrl = `https://www.tiktok.com/@${username}`;
    urlLog = `بُني من اسم المستخدم: ${accountUrl}`;
  }

  // ── 3. Platform keyword detection (if still default & no URL clue) ────────
  let platformLog = `المنصة: ${platform} (من الرابط)`;
  if (!urlM) {
    const lower = text.toLowerCase();
    if (/instagram|انستغرام|انستقرام/.test(lower))         { platform = "instagram"; }
    else if (/facebook|فيسبوك|فيس بوك/.test(lower))       { platform = "facebook"; }
    else if (/tiktok|تيك ?توك|tiktok/.test(lower))        { platform = "tiktok"; }
    platformLog = `المنصة: ${platform} (من الكلمات المفتاحية)`;
  }

  // ── 3b. TikTok Monetized detection ────────────────────────────────────────
  // Must run AFTER platform is determined and only for TikTok accounts
  if (platform === "tiktok") {
    const monetizedKeywords = [
      "أرباح المشاهدات",
      "فيه أرباح",
      "كل 10ك مشاهدات",
      "tiktok creativity",
      "creator fund",
      "صندوق المبدعين",
      "tiktok_monetized",
      "أرباح تيك توك",
    ];
    const lowerText = text.toLowerCase();
    const isMonetized = monetizedKeywords.some(kw => lowerText.includes(kw.toLowerCase()));
    if (isMonetized) {
      platform = "tiktok_monetized";
      platformLog = `المنصة: tiktok_monetized (اكتُشفت كلمات الأرباح)`;
    }
  }

  // ── 4. Followers ─────────────────────────────────────────────────────────
  let followers   = 0;
  let followersLog = "لم يُعثر على عدد المتابعين";

  // Ordered patterns — most specific first
  const followerPatterns: RegExp[] = [
    // "followers: 58K" / "متابعين: 1.2M"
    /(?:followers?|متابع(?:ين|ون)?|مشترك(?:ين)?)\s*:?\s*(\d[\d,]*(?:\.\d+)?[KkMm]?)/i,
    // "58K followers" / "1.2M متابع"
    /(\d[\d,]*(?:\.\d+)?[KkMm]?)\s*(?:followers?|متابع(?:ين|ون)?|مشترك(?:ين)?)/i,
    // bare "58K" / "1.2M" anywhere in text (last resort)
    /\b(\d[\d,]*(?:\.\d+)?[KkMm])\b/i,
  ];

  for (const rx of followerPatterns) {
    const m = rx.exec(text);
    if (m) {
      const parsed = parseFollowerNumber(m[1]);
      if (parsed > 0) {
        followers    = parsed;
        followersLog = `استُخرج "${m[1]}" → ${followers.toLocaleString()} (النمط: ${rx.source.slice(0, 40)})`;
        break;
      }
    }
  }

  // ── 5. Price ──────────────────────────────────────────────────────────────
  let price    = 0;
  let priceLog = "لم يُعثر على السعر";

  const pricePatterns: RegExp[] = [
    // "السعر: 250" / "Price: 250" / "سعر 250"
    /(?:السعر|سعر|price)\s*:?\s*(\d+(?:\.\d+)?)/i,
    // "250 شيكل" / "250 دولار" / "250$" / "250 USD"
    /(\d+(?:\.\d+)?)\s*(?:شيكل|دولار|دينار|ريال|جنيه|\$|USD|ILS|JOD)/i,
    // "$250" / "250$"
    /\$\s*(\d+(?:\.\d+)?)/i,
  ];

  for (const rx of pricePatterns) {
    const m = rx.exec(text);
    if (m) {
      price    = parseFloat(m[1]);
      priceLog = `استُخرج "${m[0]}" → ${price} (النمط: ${rx.source.slice(0, 40)})`;
      break;
    }
  }

  // ── 6. Name + Description ─────────────────────────────────────────────────
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const name  = (username ? `@${username}` : lines[0]?.slice(0, 120)) || `منشور #${messageId}`;
  const description = text || null;

  return {
    username,
    accountUrl,
    platform,
    followers,
    price,
    name,
    description,
    parseLog: {
      username:   usernameLog,
      accountUrl: urlLog,
      platform:   platformLog,
      followers:  followersLog,
      price:      priceLog,
    },
  };
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

// ── Download photo from Telegram → upload to GCS ──────────────────────────
async function importPhoto(fileId: string, token: string): Promise<string | null> {
  try {
    const fileRes = await fetch(
      TG_API(`getFile?file_id=${encodeURIComponent(fileId)}`, token),
      { signal: AbortSignal.timeout(10_000) },
    );
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

// ── Core sync (used by route + background job) ─────────────────────────────
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

  // Fetch updates
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

  // Filter to our channel
  const posts = updates
    .filter(u => u.channel_post?.chat.username?.toLowerCase() === channel.toLowerCase())
    .map(u => ({ update_id: u.update_id, post: u.channel_post! }));

  // ── Deduplication: by telegramMessageId OR username ──────────────────────
  const messageIds = posts.map(p => p.post.message_id);
  const parsed     = posts.map(p => ({
    ...p,
    parsed: parsePostText(p.post.caption ?? p.post.text ?? "", p.post.message_id),
  }));
  const usernames  = parsed.map(p => p.parsed.username).filter((u): u is string => !!u);

  const existingByMsgId = messageIds.length
    ? await db.select({ tgId: accountsTable.telegramMessageId })
        .from(accountsTable)
        .where(inArray(accountsTable.telegramMessageId, messageIds))
    : [];
  const existingByUsername = usernames.length
    ? await db.select({ username: accountsTable.username })
        .from(accountsTable)
        .where(inArray(accountsTable.username, usernames))
    : [];

  const existingMsgIds  = new Set(existingByMsgId.map(r => r.tgId));
  const existingUsernames = new Set(existingByUsername.map(r => r.username).filter(Boolean));

  let imported = 0;
  let skipped  = 0;

  for (const { post, parsed: p } of parsed) {
    // Skip if already imported (by message ID or username)
    if (existingMsgIds.has(post.message_id)) {
      logger.info(
        { telegramMessageId: post.message_id, reason: "telegram_message_id موجود مسبقاً" },
        "Telegram sync: منشور مكرر — تم التخطي",
      );
      skipped++;
      continue;
    }
    if (p.username && existingUsernames.has(p.username)) {
      logger.info(
        { username: p.username, telegramMessageId: post.message_id, reason: "username موجود مسبقاً" },
        "Telegram sync: حساب مكرر — تم التخطي",
      );
      skipped++;
      continue;
    }

    // ── Detailed parse log ──────────────────────────────────────────────────
    logger.info(
      {
        telegramMessageId: post.message_id,
        username:   p.username   ?? "(غير موجود)",
        accountUrl: p.accountUrl ?? "(غير موجود)",
        platform:   p.platform,
        followers:  p.followers,
        price:      p.price,
        parseLog:   p.parseLog,
      },
      "Telegram sync: تحليل المنشور",
    );

    // ── Download photo ──────────────────────────────────────────────────────
    let imageUrl: string | null = null;
    if (post.photo?.length) {
      const largest = post.photo.reduce((a, b) =>
        a.width * a.height >= b.width * b.height ? a : b,
      );
      imageUrl = await importPhoto(largest.file_id, token);
      if (!imageUrl) {
        logger.warn({ telegramMessageId: post.message_id }, "Telegram sync: فشل تحميل الصورة");
      }
    }

    // ── Insert account ──────────────────────────────────────────────────────
    await db.insert(accountsTable).values({
      name:             p.name,
      username:         p.username,
      platform:         p.platform,
      followers:        p.followers,
      price:            String(p.price),
      description:      p.description,
      imageUrl,
      accountUrl:       p.accountUrl,
      status:           "available",
      featured:         false,
      telegramMessageId: post.message_id,
    });

    logger.info(
      {
        telegramMessageId: post.message_id,
        username:   p.username,
        accountUrl: p.accountUrl,
        followers:  p.followers,
        price:      p.price,
        platform:   p.platform,
        hasImage:   !!imageUrl,
      },
      "Telegram sync: ✅ حساب جديد أُضيف",
    );

    imported++;
  }

  // Advance stored offset
  const maxUpdateId = Math.max(...updates.map(u => u.update_id));
  await db
    .insert(settingsTable)
    .values({ key: "telegram_update_offset", value: String(maxUpdateId) })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set:    { value: String(maxUpdateId) },
    });

  return { imported, skipped, total: posts.length };
}

// ── Background auto-sync ───────────────────────────────────────────────────
const POLL_INTERVAL_MS = 60_000;
let syncTimer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const result = await runTelegramSync();
    if (result.imported > 0) {
      logger.info(result, "Telegram auto-sync: ✅ حسابات جديدة أُضيفت");
    } else {
      logger.info(
        { total: result.total, skipped: result.skipped },
        "Telegram auto-sync: tick — لا منشورات جديدة",
      );
    }
  } catch (err) {
    logger.warn({ err }, "Telegram auto-sync: خطأ (سيُعاد المحاولة)");
  } finally {
    running = false;
  }
}

export function startTelegramAutoSync() {
  if (syncTimer) return;
  const token = BOT_TOKEN();
  if (!token) {
    logger.warn("Telegram auto-sync: TELEGRAM_BOT_TOKEN غير مضبوط — تم التخطي");
    return;
  }
  logger.info({ intervalMs: POLL_INTERVAL_MS }, "Telegram auto-sync: بدأ");
  setTimeout(tick, 5_000);
  syncTimer = setInterval(tick, POLL_INTERVAL_MS);
}
