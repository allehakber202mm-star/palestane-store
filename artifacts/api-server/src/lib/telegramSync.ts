import { db, accountsTable, settingsTable, feedbackPostsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { objectStorageClient } from "./objectStorage";
import { randomUUID } from "crypto";
import { logger } from "./logger";

const BOT_TOKEN        = () => process.env.TELEGRAM_BOT_TOKEN ?? "";
const CHANNEL          = () =>
  (process.env.TELEGRAM_CHANNEL_USERNAME ?? "Palestine_storeL").replace(/^@/, "");
const FEEDBACK_CHANNEL = () =>
  (process.env.TELEGRAM_FEEDBACK_CHANNEL ?? "palestinestore01").replace(/^@/, "");
const TG_API  = (method: string, token: string) =>
  `https://api.telegram.org/bot${token}/${method}`;
const TG_FILE = (token: string, filePath: string) =>
  `https://api.telegram.org/file/bot${token}/${filePath}`;

// ── Types ──────────────────────────────────────────────────────────────────
export type TgPhoto  = { file_id: string; width: number; height: number };
export type TgVideo  = { file_id: string; width: number; height: number; duration: number; mime_type?: string; file_size?: number };
export type TgPost   = {
  message_id: number;
  date: number;
  chat: { id?: number; username?: string; title?: string };
  text?: string;
  caption?: string;
  photo?: TgPhoto[];
  video?: TgVideo;
};
export type TgUpdate = { update_id: number; channel_post?: TgPost; edited_channel_post?: TgPost };

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

/**
 * Convert a raw number string + optional unit word → integer.
 * Handles:
 *   Western/Arabic thousand separators  (,  ،)
 *   Latin suffixes                       K k M m
 *   Arabic multiplier words              الف ألف مليون مليار
 */
function parseFollowerText(numStr: string, unitStr?: string): number {
  // Strip Western comma AND Arabic comma (U+060C)
  const cleaned = numStr.replace(/[,،]/g, "").trim();
  const n = parseFloat(cleaned);
  if (isNaN(n) || n <= 0) return 0;

  const unit = (unitStr ?? "").toLowerCase().trim();
  const mul =
    unit === "الف"   || unit === "ألف"  || unit === "k" || unit === "ك" ? 1_000
  : unit === "مليون" || unit === "m"                                     ? 1_000_000
  : unit === "مليار" || unit === "b"                                     ? 1_000_000_000
  : 1;

  return Math.round(n * mul);
}

/** Legacy alias kept so existing call-sites still compile */
function parseFollowerNumber(raw: string): number {
  const s = raw.replace(/[,،]/g, "").trim();
  const m = /^(\d+(?:\.\d+)?)([KkMm]?)$/.exec(s);
  if (!m) return 0;
  const n   = parseFloat(m[1]);
  const mul = m[2].toLowerCase() === "k" ? 1_000
            : m[2].toLowerCase() === "m" ? 1_000_000
            : 1;
  return Math.round(n * mul);
}

/** Strip Arabic/Western thousand separators then parseFloat */
function parsePriceString(raw: string): number {
  return parseFloat(raw.replace(/[,،]/g, "").trim());
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
      // Skip the store's own handles and generic bot words
      if (!/^(Palestine_storeL|Palestine_sstore|PalestineStore|admin|bot)$/i.test(handle)) {
        username = handle;
        usernameLog = `استُخرج من النص: @${username}`;
        break;
      }
    }
  }

  // ── 3. Platform keyword detection — MUST run BEFORE URL construction ──────
  // BUG FIX: previously ran AFTER URL construction, causing Instagram/Facebook
  // accounts with @handle (no direct URL) to get a TikTok URL by default.
  let platformLog = `المنصة: ${platform} (من الرابط)`;
  if (!urlM) {
    const lower = text.toLowerCase();
    // BUG FIX #2: Arabic Instagram has two common spellings:
    //   إنستغرام (with hamza إ U+0625) — the correct/common spelling
    //   انستغرام (with alef  ا U+0627) — alternate spelling
    // The previous regex only had 'انستغرام', missing the hamza variant.
    // Fix: use character class [اإأ] to match both.
    if (/instagram|[اإأ]نست[غق]رام/.test(lower))            { platform = "instagram"; }
    else if (/facebook|فيسبوك|فيس\s*بوك/.test(lower))       { platform = "facebook";  }
    else if (/tiktok|تيك\s*توك/.test(lower))                 { platform = "tiktok";    }
    platformLog = `المنصة: ${platform} (من الكلمات المفتاحية)`;
  }

  // ── 3b. Construct accountUrl from username AFTER platform is known ─────────
  // BUG FIX: URL is now built with the correct platform (after keyword detection)
  if (!accountUrl && username) {
    if      (platform === "instagram")         accountUrl = `https://www.instagram.com/${username}`;
    else if (platform === "facebook")          accountUrl = `https://www.facebook.com/${username}`;
    else                                       accountUrl = `https://www.tiktok.com/@${username}`;
    urlLog = `بُني من اسم المستخدم (${platform}): ${accountUrl}`;
  }

  // ── 3c. TikTok Monetized detection ────────────────────────────────────────
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
  // Each pattern has TWO capture groups: (number)(unit?)
  // Unit can be: K k M m الف ألف مليون مليار
  const UNIT_WORDS = "ألف|الف|مليون|مليار";
  // [KkMmك] — Latin K/M and Arabic kaf (ك = thousands), e.g. "36ك"
  const UNIT_CHARS = "[KkMmك]";
  // BUG FIX #4: Use [ \\t]* (space/tab only) instead of \\s* between keyword and number
  // to prevent cross-line matching. Without this, "متابع\n400 شيكل" wrongly reads
  // the price (400) as followers count.
  const followerPatterns: RegExp[] = [
    // "متابعين : 315 الف" / "followers: 1.5M" / "متابعين : 36ك"  (keyword BEFORE number)
    new RegExp(`(?:followers?|متابع(?:ين|ون)?|مشترك(?:ين)?|معجب(?:ون|ين)?)[ \\t]*:?[ \\t]*([\\d,،]+(?:\\.\\d+)?)[ \\t]*(${UNIT_WORDS}|${UNIT_CHARS})?`, "i"),
    // "315 الف متابع" / "1.5M followers" / "36ك متابع"  (number BEFORE keyword)
    new RegExp(`([\\d,،]+(?:\\.\\d+)?)[ \\t]*(${UNIT_WORDS}|${UNIT_CHARS})?[ \\t]*(?:followers?|متابع(?:ين|ون)?|مشترك(?:ين)?|معجب(?:ون|ين)?)`, "i"),
    // "إعجابات : 50 ألف" (Facebook likes as follower proxy)
    new RegExp(`(?:إعجاب(?:ات)?|likes?)[ \\t]*:?[ \\t]*([\\d,،]+(?:\\.\\d+)?)[ \\t]*(${UNIT_WORDS}|${UNIT_CHARS})?`, "i"),
    // bare "58K" / "36ك" / "1.2M" (last resort — only when unit suffix is present)
    new RegExp(`\\b(\\d[\\d,،]*(?:\\.\\d+)?)(${UNIT_CHARS})\\b`, "i"),
  ];

  for (const rx of followerPatterns) {
    const m = rx.exec(text);
    if (m) {
      const parsed = parseFollowerText(m[1], m[2]);
      if (parsed > 0) {
        followers    = parsed;
        followersLog = `استُخرج "${m[1]}${m[2] ? " " + m[2] : ""}" → ${followers.toLocaleString()} (النمط: ${rx.source.slice(0, 50)})`;
        break;
      }
    }
  }

  // ── 5. Price ──────────────────────────────────────────────────────────────
  let price    = 0;
  let priceLog = "لم يُعثر على السعر";

  // Numbers may contain Arabic thousand separator ، (U+060C) — e.g. "1،600"
  const pricePatterns: RegExp[] = [
    // "السعر: 1،600" / "الثمن : 250" / "ثمن : 500" / "price: 250"
    // BUG FIX #3: added ثمن/الثمن/تكلفة as price synonyms
    /(?:السعر|سعر|الثمن|ثمن|تكلفة|price)\s*:?\s*([\d,،]+(?:\.\d+)?)/i,
    // "1،600 شيكل" / "250 دولار" / "250 USD" / "250₪"
    /([\d,،]+(?:\.\d+)?)\s*(?:شيكل|دولار|دينار|ريال|جنيه|₪|\$|USD|ILS|JOD)/i,
    // "$250" or "₪250"
    /[$₪]\s*([\d,،]+(?:\.\d+)?)/i,
    // Last resort: standalone large number ≥100 on its own line (likely a price)
    /^([\d,،]{3,})$/m,
  ];

  for (const rx of pricePatterns) {
    const m = rx.exec(text);
    if (m) {
      price    = parsePriceString(m[1]);  // strips ، and , before parseFloat
      priceLog = `استُخرج "${m[0]}" → ${price} (النمط: ${rx.source.slice(0, 50)})`;
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
    logger.info({ fileId }, "importPhoto: بدء تحميل الصورة");
    const fileRes = await fetch(
      TG_API(`getFile?file_id=${encodeURIComponent(fileId)}`, token),
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!fileRes.ok) {
      logger.warn({ status: fileRes.status, fileId }, "importPhoto: getFile فشل");
      return null;
    }
    const fileData = await fileRes.json() as { ok: boolean; result?: { file_path: string } };
    if (!fileData.ok || !fileData.result?.file_path) {
      logger.warn({ fileData, fileId }, "importPhoto: file_path غير موجود في الرد");
      return null;
    }
    logger.info({ filePath: fileData.result.file_path }, "importPhoto: جاري تحميل الملف");
    const imgRes = await fetch(TG_FILE(token, fileData.result.file_path), {
      signal: AbortSignal.timeout(30_000),
    });
    if (!imgRes.ok) {
      logger.warn({ status: imgRes.status }, "importPhoto: تحميل الملف فشل");
      return null;
    }
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    logger.info({ bytes: buffer.byteLength }, "importPhoto: جاري الرفع إلى GCS");
    const url = await uploadBufferToGCS(buffer, "image/jpeg");
    logger.info({ url }, "importPhoto: ✅ تم رفع الصورة");
    return url;
  } catch (err) {
    logger.error({ err, fileId }, "importPhoto: خطأ غير متوقع");
    return null;
  }
}

// ── Download video from Telegram → upload to GCS ──────────────────────────
async function importVideo(fileId: string, token: string): Promise<string | null> {
  try {
    logger.info({ fileId }, "importVideo: بدء تحميل الفيديو");
    const fileRes = await fetch(
      TG_API(`getFile?file_id=${encodeURIComponent(fileId)}`, token),
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!fileRes.ok) {
      logger.warn({ status: fileRes.status, fileId }, "importVideo: getFile فشل");
      return null;
    }
    const fileData = await fileRes.json() as { ok: boolean; result?: { file_path: string; file_size?: number } };
    if (!fileData.ok || !fileData.result?.file_path) {
      logger.warn({ fileData }, "importVideo: file_path غير موجود");
      return null;
    }
    const fileSize = fileData.result.file_size ?? 0;
    if (fileSize > 50 * 1024 * 1024) {
      logger.warn({ fileSize }, "importVideo: الفيديو أكبر من 50MB — تم التخطي");
      return null;
    }
    logger.info({ filePath: fileData.result.file_path, fileSize }, "importVideo: جاري تحميل الملف");
    const vidRes = await fetch(TG_FILE(token, fileData.result.file_path), {
      signal: AbortSignal.timeout(60_000),
    });
    if (!vidRes.ok) {
      logger.warn({ status: vidRes.status }, "importVideo: تحميل الملف فشل");
      return null;
    }
    const buffer = Buffer.from(await vidRes.arrayBuffer());
    logger.info({ bytes: buffer.byteLength }, "importVideo: جاري الرفع إلى GCS");
    const url = await uploadBufferToGCS(buffer, "video/mp4");
    logger.info({ url }, "importVideo: ✅ تم رفع الفيديو");
    return url;
  } catch (err) {
    logger.error({ err, fileId }, "importVideo: خطأ غير متوقع");
    return null;
  }
}

// ── Sold keyword detection ─────────────────────────────────────────────────
const SOLD_PATTERN = /مباع|تم\s+البيع|SOLD|❌/i;

export function isSoldPost(text: string): boolean {
  return SOLD_PATTERN.test(text);
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

  const feedbackChannel = FEEDBACK_CHANNEL();

  // Fetch updates (accounts + feedback channels)
  const params = new URLSearchParams({
    limit: "100",
    allowed_updates: JSON.stringify(["channel_post", "edited_channel_post"]),
  });
  if (storedOffset > 0) params.set("offset", String(storedOffset + 1));

  const updatesRes = await fetch(TG_API(`getUpdates?${params.toString()}`, token), {
    signal: AbortSignal.timeout(15_000),
  });
  if (!updatesRes.ok) throw new Error(`Telegram API HTTP ${updatesRes.status}`);

  const updatesData = await updatesRes.json() as { ok: boolean; result: TgUpdate[] };
  if (!updatesData.ok) throw new Error("Telegram API returned ok:false");

  const updates = updatesData.result;

  // ── Log ALL raw updates before any filtering ───────────────────────────────
  logger.info(
    {
      totalUpdates: updates.length,
      storedOffset,
      expectedAccountChannel: channel,
      expectedFeedbackChannel: feedbackChannel,
      updateSummary: updates.map(u => ({
        update_id: u.update_id,
        type: u.channel_post ? "channel_post" : u.edited_channel_post ? "edited_channel_post" : "other",
        chat_username: u.channel_post?.chat?.username ?? u.edited_channel_post?.chat?.username ?? "N/A",
        chat_id: u.channel_post?.chat?.id ?? u.edited_channel_post?.chat?.id ?? "N/A",
        message_id: u.channel_post?.message_id ?? u.edited_channel_post?.message_id,
        has_photo: !!(u.channel_post?.photo?.length ?? u.edited_channel_post?.photo?.length),
        has_video: !!(u.channel_post?.video ?? u.edited_channel_post?.video),
        text_preview: (u.channel_post?.text ?? u.channel_post?.caption ?? u.edited_channel_post?.text ?? u.edited_channel_post?.caption ?? "").slice(0, 60),
      })),
    },
    "Telegram sync: RAW updates من Telegram",
  );

  if (!updates.length) return { imported: 0, skipped: 0, total: 0 };

  // ── Separate by channel ───────────────────────────────────────────────────
  const accountPosts = updates
    .filter(u => u.channel_post?.chat.username?.toLowerCase() === channel.toLowerCase())
    .map(u => ({ update_id: u.update_id, post: u.channel_post! }));

  const accountEditedPosts = updates
    .filter(u => u.edited_channel_post?.chat.username?.toLowerCase() === channel.toLowerCase())
    .map(u => ({ update_id: u.update_id, post: u.edited_channel_post! }));

  const feedbackNewPosts = updates
    .filter(u => u.channel_post?.chat.username?.toLowerCase() === feedbackChannel.toLowerCase())
    .map(u => ({ update_id: u.update_id, post: u.channel_post! }));

  const feedbackEditedPosts = updates
    .filter(u => u.edited_channel_post?.chat.username?.toLowerCase() === feedbackChannel.toLowerCase())
    .map(u => ({ update_id: u.update_id, post: u.edited_channel_post! }));

  logger.info(
    {
      accountPosts: accountPosts.length,
      accountEditedPosts: accountEditedPosts.length,
      feedbackNewPosts: feedbackNewPosts.length,
      feedbackEditedPosts: feedbackEditedPosts.length,
    },
    "Telegram sync: نتيجة التصفية حسب القناة",
  );

  // ── Process feedback new posts ────────────────────────────────────────────
  if (feedbackNewPosts.length > 0) {
    const fbMsgIds = feedbackNewPosts.map(p => p.post.message_id);
    const existing = await db
      .select({ tgId: feedbackPostsTable.telegramMessageId })
      .from(feedbackPostsTable)
      .where(inArray(feedbackPostsTable.telegramMessageId, fbMsgIds));
    const existingFbIds = new Set(existing.map(r => r.tgId));

    for (const { post } of feedbackNewPosts) {
      if (existingFbIds.has(post.message_id)) continue;

      logger.info(
        { telegramMessageId: post.message_id, hasPhoto: !!post.photo?.length, hasVideo: !!post.video, hasText: !!(post.text ?? post.caption) },
        "Feedback sync: معالجة منشور جديد",
      );

      let imageUrl: string | null = null;
      let videoUrl: string | null = null;

      if (post.photo?.length) {
        const largest = post.photo.reduce((a, b) =>
          a.width * a.height >= b.width * b.height ? a : b,
        );
        imageUrl = await importPhoto(largest.file_id, token);
      }

      if (post.video) {
        videoUrl = await importVideo(post.video.file_id, token);
      }

      const rawText = (post.caption ?? post.text ?? "").trim() || null;
      const postedAt = new Date(post.date ? post.date * 1000 : Date.now());

      await db.insert(feedbackPostsTable).values({
        telegramMessageId: post.message_id,
        text:    rawText,
        imageUrl,
        videoUrl,
        postedAt,
      });
      logger.info(
        { telegramMessageId: post.message_id, hasImage: !!imageUrl, hasVideo: !!videoUrl, hasText: !!rawText },
        "Feedback sync: ✅ منشور جديد أُضيف",
      );
    }
  }

  // ── Process feedback edited posts ─────────────────────────────────────────
  for (const { post } of feedbackEditedPosts) {
    let imageUrl: string | null = null;
    let videoUrl: string | null = null;
    if (post.photo?.length) {
      const largest = post.photo.reduce((a, b) =>
        a.width * a.height >= b.width * b.height ? a : b,
      );
      imageUrl = await importPhoto(largest.file_id, token);
    }
    if (post.video) {
      videoUrl = await importVideo(post.video.file_id, token);
    }
    const rawText = (post.caption ?? post.text ?? "").trim() || null;
    await db
      .update(feedbackPostsTable)
      .set({ text: rawText, imageUrl, videoUrl, updatedAt: new Date() } as Record<string, unknown>)
      .where(eq(feedbackPostsTable.telegramMessageId, post.message_id));
    logger.info({ telegramMessageId: post.message_id }, "Feedback sync: ✏️ منشور محدّث");
  }

  // ── Process account edited posts (sold / available detection) ────────────
  if (accountEditedPosts.length > 0) {
    const editedMsgIds = accountEditedPosts.map(p => p.post.message_id);
    const editedAccounts = await db
      .select({ id: accountsTable.id, telegramMessageId: accountsTable.telegramMessageId, status: accountsTable.status })
      .from(accountsTable)
      .where(inArray(accountsTable.telegramMessageId, editedMsgIds));
    const accountByMsgId = new Map(editedAccounts.map(a => [a.telegramMessageId, a]));

    for (const { post } of accountEditedPosts) {
      const account = accountByMsgId.get(post.message_id);
      if (!account) {
        logger.info(
          { telegramMessageId: post.message_id },
          "Account edit sync: لم يُعثر على حساب بهذا message_id — تم التخطي",
        );
        continue;
      }

      const rawText = (post.caption ?? post.text ?? "").trim();
      const sold = isSoldPost(rawText);
      const newStatus = sold ? "sold" : "available";

      if (account.status === newStatus) {
        logger.info(
          { telegramMessageId: post.message_id, accountId: account.id, status: newStatus },
          "Account edit sync: الحالة لم تتغير — تم التخطي",
        );
        continue;
      }

      await db
        .update(accountsTable)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(accountsTable.id, account.id));

      logger.info(
        {
          telegramMessageId: post.message_id,
          accountId: account.id,
          oldStatus: account.status,
          newStatus,
          sold,
          textPreview: rawText.slice(0, 80),
        },
        sold
          ? "Account edit sync: 🔴 حساب تم تحديثه → مباع"
          : "Account edit sync: 🟢 حساب تم تحديثه → متاح",
      );
    }
  }

  // ── Process account posts (new) ───────────────────────────────────────────
  const messageIds = accountPosts.map(p => p.post.message_id);
  const parsed     = accountPosts.map(p => ({
    ...p,
    parsed: parsePostText(p.post.caption ?? p.post.text ?? "", p.post.message_id),
  }));

  const existingByMsgId = messageIds.length
    ? await db.select({ tgId: accountsTable.telegramMessageId })
        .from(accountsTable)
        .where(inArray(accountsTable.telegramMessageId, messageIds))
    : [];

  const existingMsgIds = new Set(existingByMsgId.map(r => r.tgId));

  let imported = 0;
  let skipped  = 0;

  for (const { post, parsed: p } of parsed) {
    // Skip if already imported by message ID
    if (existingMsgIds.has(post.message_id)) {
      logger.info(
        { telegramMessageId: post.message_id, reason: "telegram_message_id موجود مسبقاً" },
        "Telegram sync: منشور مكرر — تم التخطي",
      );
      skipped++;
      continue;
    }

    const rawText = (post.caption ?? post.text ?? "").trim();

    // ══════════════════════════════════════════════════════════════════════
    // [DIAG] RAW_USER_INPUT — النص الخام قبل أي معالجة
    // ══════════════════════════════════════════════════════════════════════
    logger.info(
      {
        telegramMessageId: post.message_id,
        RAW_USER_INPUT: rawText,
        hasPhoto: !!post.photo?.length,
        hasCaption: !!post.caption,
        hasText: !!post.text,
        charCount: rawText.length,
      },
      "[DIAG] RAW_USER_INPUT",
    );

    // ══════════════════════════════════════════════════════════════════════
    // [DIAG] PARSED_DATA — نتيجة التحليل التفصيلية
    // ══════════════════════════════════════════════════════════════════════
    logger.info(
      {
        telegramMessageId: post.message_id,
        PARSED_DATA: {
          platform:   p.platform,
          price:      p.price,
          followers:  p.followers,
          accountUrl: p.accountUrl ?? null,
          username:   p.username   ?? null,
          name:       p.name,
          description_preview: p.description?.slice(0, 100) ?? null,
        },
        parseLog: p.parseLog,
      },
      "[DIAG] PARSED_DATA",
    );

    // ══════════════════════════════════════════════════════════════════════
    // [DIAG] PLACEHOLDER CLEANSING — إزالة القيم الوهمية المعروفة
    // ══════════════════════════════════════════════════════════════════════
    // These are known placeholder strings that sometimes appear in test posts
    // or posts that literally say "@username" / "https://www.facebook.com/page".
    // We must NOT save them as real data.
    const PLACEHOLDER_USERNAMES = new Set([
      "username", "page", "profile", "user", "handle",
      "mypage", "myaccount", "myusername", "yourname", "name",
    ]);
    const PLACEHOLDER_URLS = new Set([
      "https://www.facebook.com/page",
      "https://www.instagram.com/username",
      "https://www.tiktok.com/@username",
      "https://www.facebook.com/username",
      "https://www.instagram.com/page",
    ]);

    // Strip placeholder username
    if (p.username && PLACEHOLDER_USERNAMES.has(p.username.toLowerCase())) {
      logger.warn(
        { telegramMessageId: post.message_id, username: p.username },
        "[DIAG] 🚫 PLACEHOLDER_USERNAME — تم تجاهل username وهمي",
      );
      p.username = null;
    }

    // Strip placeholder accountUrl
    if (p.accountUrl && PLACEHOLDER_URLS.has(p.accountUrl.toLowerCase())) {
      logger.warn(
        { telegramMessageId: post.message_id, accountUrl: p.accountUrl },
        "[DIAG] 🚫 PLACEHOLDER_URL — تم تجاهل رابط وهمي",
      );
      p.accountUrl = null;
    }

    // ══════════════════════════════════════════════════════════════════════
    // [DIAG] DATA SUFFICIENCY CHECK — لا حفظ بدون بيانات حقيقية
    // ══════════════════════════════════════════════════════════════════════
    // Require at least ONE meaningful field to save the account.
    // If price=0 AND followers=0 AND no real accountUrl → the post has no
    // structured data (or all data is placeholder) → REJECT, do NOT save.
    const hasRealPrice      = p.price > 0;
    const hasRealFollowers  = p.followers > 0;
    const hasRealUrl        = !!p.accountUrl;

    if (!hasRealPrice && !hasRealFollowers && !hasRealUrl) {
      logger.error(
        {
          telegramMessageId: post.message_id,
          platform:    p.platform,
          rawText_preview: rawText.slice(0, 200),
          reason: "price=0 AND followers=0 AND accountUrl=null",
          fix_hint: "أضف إلى المنشور: السعر + عدد المتابعين + رابط الحساب أو @username",
          example: "السعر : 450 شيكل\nعدد المتابعين 43 ألف\nhttps://www.facebook.com/yourpage",
        },
        "[DIAG] ❌ REJECTED — لم يتم حفظ الحساب: لا توجد بيانات حقيقية (سعر=0, متابعين=0, رابط=null)",
      );
      skipped++;
      continue;
    }

    // ══════════════════════════════════════════════════════════════════════
    // [DIAG] WARNINGS — تحذيرات الحقول الفارغة (للحسابات التي ستُحفظ)
    // ══════════════════════════════════════════════════════════════════════
    const warnings: string[] = [];
    if (!hasRealPrice)      warnings.push("⚠️ السعر = 0 (لم يُعثر على سعر في النص)");
    if (!hasRealFollowers)  warnings.push("⚠️ المتابعون = 0 (لم يُعثر على عدد متابعين)");
    if (!hasRealUrl)        warnings.push("⚠️ accountUrl = null (لم يُعثر على رابط أو @username)");
    if (!p.description)     warnings.push("⚠️ description = null (النص فارغ)");

    if (warnings.length > 0) {
      logger.warn(
        {
          telegramMessageId: post.message_id,
          platform: p.platform,
          warnings,
          hint: "الحساب سيُحفظ لأنه يحتوي على بعض البيانات الحقيقية، لكن بعض الحقول ناقصة",
        },
        "[DIAG] ⚠️ PARTIAL_DATA",
      );
    }

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

    // ══════════════════════════════════════════════════════════════════════
    // [DIAG] DATA_BEFORE_SAVE — البيانات الكاملة قبل الحفظ في DB
    // ══════════════════════════════════════════════════════════════════════
    const recordToSave = {
      name:              p.name,
      username:          p.username,
      platform:          p.platform,
      followers:         p.followers,
      price:             String(p.price),
      description:       p.description,
      imageUrl,
      accountUrl:        p.accountUrl,
      status:            "available" as const,
      featured:          false,
      telegramMessageId: post.message_id,
    };

    logger.info(
      {
        telegramMessageId: post.message_id,
        DATA_BEFORE_SAVE: {
          ...recordToSave,
          description: recordToSave.description?.slice(0, 100) ?? null,
        },
      },
      "[DIAG] DATA_BEFORE_SAVE",
    );

    // ── Insert account ──────────────────────────────────────────────────────
    const [inserted] = await db.insert(accountsTable).values(recordToSave).returning({
      id:         accountsTable.id,
      price:      accountsTable.price,
      followers:  accountsTable.followers,
      accountUrl: accountsTable.accountUrl,
      platform:   accountsTable.platform,
    });

    // ══════════════════════════════════════════════════════════════════════
    // [DIAG] DATA_SAVED_IN_DB — ما تم حفظه فعلياً في قاعدة البيانات
    // ══════════════════════════════════════════════════════════════════════
    logger.info(
      {
        telegramMessageId: post.message_id,
        DATA_SAVED_IN_DB: inserted,
        match: {
          price_match:      String(p.price) === inserted.price,
          followers_match:  p.followers === inserted.followers,
          accountUrl_match: p.accountUrl === inserted.accountUrl,
        },
      },
      "[DIAG] ✅ DATA_SAVED_IN_DB",
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

  return { imported, skipped, total: accountPosts.length };
}

// ── Background auto-sync ───────────────────────────────────────────────────
const POLL_INTERVAL_MS = 30_000;
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
