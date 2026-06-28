import { db, accountsTable, settingsTable, feedbackPostsTable } from "@workspace/db";
import { eq, inArray, and, desc, sql } from "drizzle-orm";
import { objectStorageClient } from "./objectStorage";
import { randomUUID } from "crypto";
import { logger } from "./logger";
import { syncAccountUrls } from "./accountUrlSync";
import { extractUsernameFromImage, warmupOcr } from "./ocrExtract";

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
  imported:       number;
  skipped:        number;
  total:          number;
  /** URLs that came directly from the Telegram post */
  urlsFromPost:   number;
  /** URLs auto-built from username (no URL in post) */
  urlsGenerated:  number;
  /** Accounts saved but with NO url and NO username — need manual review */
  needsManual:    number;
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
  originalDescription: string | null;  // النص الأصلي من Telegram — لا يُعرض للزوار
  categorySelected: string;            // القسم المختار تلقائياً
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

// ─────────────────────────────────────────────────────────────────────────────
// Known placeholder strings that sometimes appear when someone types a test
// post using template text. These must NOT be saved as real data.
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// validatePostData
//
// Called for every Telegram post BEFORE saving to DB.
//
// STEP 1 — Placeholder cleansing:
//   • If username matches a known placeholder word  → set username = null
//   • If accountUrl matches a known placeholder URL → set accountUrl = null
//
// STEP 2 — Data sufficiency check (the ONLY rejection condition):
//   An account is REJECTED **only** when ALL THREE of the following are missing:
//     price     = 0    (no price found in text)
//     followers = 0    (no follower count found in text)
//     accountUrl = null (no URL and no real @handle)
//
//   If ANY ONE of the three is present (price > 0 OR followers > 0 OR accountUrl
//   is a real URL) → the account IS saved, even with the other fields missing.
//
// Returns an object so the caller can log exactly what happened.
// ─────────────────────────────────────────────────────────────────────────────
interface ValidationResult {
  /** true → save the account;  false → reject (skip) */
  shouldSave: boolean;

  /** Present only when shouldSave = false. Human-readable rejection reason. */
  rejectionReason?: string;

  /** Which individual conditions failed (for diagnostics) */
  checks: {
    hasRealPrice:     boolean;   // price > 0
    hasRealFollowers: boolean;   // followers > 0
    hasRealUrl:       boolean;   // accountUrl !== null  (after placeholder strip)
  };

  /** Fields that were stripped because they matched a known placeholder */
  strippedPlaceholders: Array<{ field: "username" | "accountUrl"; value: string }>;
}

function validatePostData(p: ParsedAccount): ValidationResult {
  const stripped: ValidationResult["strippedPlaceholders"] = [];

  // ── Step 1: strip known placeholder values ────────────────────────────────
  if (p.username && PLACEHOLDER_USERNAMES.has(p.username.toLowerCase())) {
    stripped.push({ field: "username", value: p.username });
    p.username = null;
  }
  if (p.accountUrl && PLACEHOLDER_URLS.has(p.accountUrl.toLowerCase())) {
    stripped.push({ field: "accountUrl", value: p.accountUrl });
    p.accountUrl = null;
  }

  // ── Step 2: data sufficiency check ───────────────────────────────────────
  const checks = {
    hasRealPrice:     p.price > 0,
    hasRealFollowers: p.followers > 0,
    hasRealUrl:       p.accountUrl !== null,
  };

  // REJECT condition: ALL three must be missing simultaneously.
  // Having price > 0 alone is enough to pass. Having followers > 0 alone is
  // enough to pass. Having a real URL alone is enough to pass.
  const shouldSave = checks.hasRealPrice || checks.hasRealFollowers || checks.hasRealUrl;

  const rejectionReason = shouldSave
    ? undefined
    : [
        !checks.hasRealPrice     ? "price=0 (لم يُعثر على سعر)"           : null,
        !checks.hasRealFollowers ? "followers=0 (لم يُعثر على متابعين)"    : null,
        !checks.hasRealUrl       ? "accountUrl=null (لا رابط ولا @username حقيقي)" : null,
      ]
        .filter(Boolean)
        .join(" | ");

  return { shouldSave, rejectionReason, checks, strippedPlaceholders: stripped };
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
    // Instagram: covers all Arabic spelling variants + common abbreviations:
    //   إنستغرام / انستغرام (غ or ق) / إنستاغرام / انستاجرام / انستاقرام
    //   انستا / إنستا  (very common Arabic short form — NOTE: no \b after Arabic chars,
    //                   \b only works for ASCII \w chars; Arabic is always \W)
    //   insta / IG     (Latin short forms — \b works fine here)
    const instaRx = /instagram|insta\b|\big\b|[اإأ]نستا|[اإأ]نست[اي]?[اغجق]?رام/;
    if (instaRx.test(lower))                                  { platform = "instagram"; platformLog = `المنصة: instagram (كلمة مفتاحية)`; }
    else if (/facebook|فيسبوك|فيس\s*بوك/.test(lower))        { platform = "facebook";  platformLog = `المنصة: facebook (كلمة مفتاحية)`;  }
    else if (/tiktok|تيك\s*توك/.test(lower))                  { platform = "tiktok";    platformLog = `المنصة: tiktok (كلمة مفتاحية)`;    }
    else if (username) {
      // ── Fallback: infer platform from @handle itself ───────────────────
      // Catches cases where the post has no URL, no platform keyword,
      // but the @username name contains a platform hint, e.g. @my_insta_shop
      const uname = username.toLowerCase();
      if (uname.includes("instagram") || uname.includes("insta")) {
        platform    = "instagram";
        platformLog = `المنصة: instagram (من اسم المستخدم: @${username})`;
      } else if (uname.includes("facebook")) {
        platform    = "facebook";
        platformLog = `المنصة: facebook (من اسم المستخدم: @${username})`;
      } else {
        platformLog = `المنصة: ${platform} (افتراضي — لم يُعثر على مؤشر)`;
      }
    } else {
      platformLog = `المنصة: ${platform} (افتراضي — لا رابط ولا كلمة مفتاحية ولا @username)`;
    }
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
      // ── كلمات المستخدم (الأولوية) ───────────────────────────────────────
      "ارباح المشاهدات",      // بدون همزة  ←  الأكثر شيوعاً في القناة
      "أرباح المشاهدات",      // بالهمزة
      "الربح من المشاهدات",
      "monetization",
      "creator rewards",
      "creativity program",
      // ── كلمات إضافية (كانت موجودة سابقاً) ─────────────────────────────
      "فيه أرباح",
      "فيه ارباح",
      "كل 10ك مشاهدات",
      "tiktok creativity",
      "creator fund",
      "صندوق المبدعين",
      "tiktok_monetized",
      "أرباح تيك توك",
      "ارباح تيك توك",
    ];
    const lowerText = text.toLowerCase();
    const matchedKw = monetizedKeywords.find(kw => lowerText.includes(kw.toLowerCase()));
    if (matchedKw) {
      platform = "tiktok_monetized";
      platformLog = `المنصة: tiktok_monetized (اكتُشفت كلمة: "${matchedKw}")`;
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

  // الوصف الأصلي من Telegram — يُحفظ في originalDescription ولا يُعرض للزوار
  const originalDescription = text || null;

  // ── 7. Auto-description (TikTok only) ────────────────────────────────────
  // استبدال الوصف الأصلي بوصف ثابت بناءً على فئة الحساب
  const MONETIZED_DESC =
    `فيه ارباح المشاهدات\n\nكل 10k مشاهدات على الفيديو بتربح 2.1$\n\n` +
    `✓ متابعين حقيقيين 100%\n` +
    `✓ جمهور نشط ومتفاعل\n` +
    `✓ بدون متابعين وهميين أو بوتات\n` +
    `✓ نمو طبيعي وآمن للحساب\n` +
    `✓ مناسب للإعلانات والتسويق\n` +
    `✓ جاهز للاستخدام مباشرة`;

  const TIKTOK_DESC =
    `✓ متابعين حقيقيين 100%\n` +
    `✓ جمهور نشط ومتفاعل\n` +
    `✓ بدون متابعين وهميين أو بوتات\n` +
    `✓ نمو طبيعي وآمن للحساب\n` +
    `✓ مناسب للإعلانات والتسويق\n` +
    `✓ جاهز للاستخدام مباشرة`;

  let description: string | null;
  let categorySelected: string;

  if (platform === "tiktok_monetized") {
    description      = MONETIZED_DESC;
    categorySelected = "أرباح المشاهدات (tiktok_monetized)";
  } else if (platform === "tiktok") {
    description      = TIKTOK_DESC;
    categorySelected = "TikTok العادي";
  } else {
    // Instagram / Facebook — يحتفظ بالوصف الأصلي
    description      = originalDescription;
    categorySelected = platform;
  }

  return {
    username,
    accountUrl,
    platform,
    followers,
    price,
    name,
    description,
    originalDescription,
    parseLog: {
      username:   usernameLog,
      accountUrl: urlLog,
      platform:   platformLog,
      followers:  followersLog,
      price:      priceLog,
    },
    categorySelected,
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

// ── Download raw buffer from Telegram (no upload) ──────────────────────────
async function downloadTgBuffer(fileId: string, token: string): Promise<Buffer | null> {
  try {
    const fileRes = await fetch(
      TG_API(`getFile?file_id=${encodeURIComponent(fileId)}`, token),
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!fileRes.ok) {
      logger.warn({ status: fileRes.status, fileId }, "downloadTgBuffer: getFile فشل");
      return null;
    }
    const fileData = await fileRes.json() as { ok: boolean; result?: { file_path: string } };
    if (!fileData.ok || !fileData.result?.file_path) {
      logger.warn({ fileData }, "downloadTgBuffer: file_path غير موجود");
      return null;
    }
    const imgRes = await fetch(TG_FILE(token, fileData.result.file_path), {
      signal: AbortSignal.timeout(30_000),
    });
    if (!imgRes.ok) {
      logger.warn({ status: imgRes.status }, "downloadTgBuffer: تحميل الملف فشل");
      return null;
    }
    return Buffer.from(await imgRes.arrayBuffer());
  } catch (err) {
    logger.warn({ err, fileId }, "downloadTgBuffer: خطأ غير متوقع");
    return null;
  }
}

// ── Download photo from Telegram → upload to GCS ──────────────────────────
async function importPhoto(fileId: string, token: string, existingBuffer?: Buffer): Promise<string | null> {
  try {
    logger.info({ fileId }, "importPhoto: بدء تحميل الصورة");
    const buffer = existingBuffer ?? await downloadTgBuffer(fileId, token);
    if (!buffer) {
      logger.warn({ fileId }, "importPhoto: فشل تنزيل البافر");
      return null;
    }
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

// ─────────────────────────────────────────────────────────────────────────────
// fixMisclassifiedAccounts
//
// Re-parses the originalDescription of every Telegram-imported account and
// corrects the platform field if the detected platform differs from what is
// currently stored in the DB.
//
// Called automatically at the start of every runTelegramSync() so that even
// accounts imported before this fix was deployed get corrected on the next sync.
// ─────────────────────────────────────────────────────────────────────────────
async function fixMisclassifiedAccounts(): Promise<{ checked: number; fixed: number }> {
  const accounts = await db
    .select({
      id:                  accountsTable.id,
      name:                accountsTable.name,
      platform:            accountsTable.platform,
      telegramMessageId:   accountsTable.telegramMessageId,
      originalDescription: accountsTable.originalDescription,
    })
    .from(accountsTable)
    .where(
      sql`${accountsTable.telegramMessageId} IS NOT NULL
          AND ${accountsTable.originalDescription} IS NOT NULL
          AND ${accountsTable.originalDescription} != ''`,
    );

  let fixed = 0;

  for (const acc of accounts) {
    const reparsed    = parsePostText(acc.originalDescription!, acc.telegramMessageId!);
    const detectedPlt = reparsed.platform;

    logger.info(
      {
        accountId:        acc.id,
        accountName:      acc.name,
        storedPlatform:   acc.platform,
        detectedPlatform: detectedPlt,
        detectionReason:  reparsed.parseLog.platform,
        needsFix:         detectedPlt !== acc.platform,
      },
      `[FIX_CHECK] "${acc.name}" | stored: ${acc.platform} | detected: ${detectedPlt}`,
    );

    if (detectedPlt !== acc.platform) {
      await db
        .update(accountsTable)
        .set({ platform: detectedPlt, updatedAt: new Date() })
        .where(eq(accountsTable.id, acc.id));

      logger.warn(
        {
          accountId:      acc.id,
          accountName:    acc.name,
          fromPlatform:   acc.platform,
          toPlatform:     detectedPlt,
          reason:         reparsed.parseLog.platform,
          sectionBefore:  acc.platform,
          sectionAfter:   detectedPlt,
        },
        `🔧 PLATFORM_FIXED: "${acc.name}" | ${acc.platform} → ${detectedPlt} | سبب: ${reparsed.parseLog.platform}`,
      );

      fixed++;
    }
  }

  logger.info(
    { checked: accounts.length, fixed },
    `✅ fixMisclassifiedAccounts: فحص ${accounts.length} حساب — صُحِّح ${fixed}`,
  );

  return { checked: accounts.length, fixed };
}

// ── Core sync (used by route + background job) ─────────────────────────────
export async function runTelegramSync(): Promise<SyncResult> {
  const token   = BOT_TOKEN();
  const channel = CHANNEL();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");

  // ── Fix any existing mis-classified accounts before processing new ones ────
  // This runs on every sync so accounts imported before this fix get corrected.
  try {
    await fixMisclassifiedAccounts();
  } catch (fixErr) {
    logger.warn({ fixErr }, "runTelegramSync: fixMisclassifiedAccounts() خطأ — متابعة المزامنة");
  }

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

  if (!updates.length) return { imported: 0, skipped: 0, total: 0, urlsFromPost: 0, urlsGenerated: 0, needsManual: 0 };

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

  let imported      = 0;
  let skipped       = 0;
  let urlsFromPost  = 0;
  let urlsGenerated = 0;
  let needsManual   = 0;

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
    // [DIAG] AUTO_CATEGORIZE — القسم المختار والأوصاف المُولَّدة
    // ══════════════════════════════════════════════════════════════════════
    logger.info(
      {
        telegramMessageId:   post.message_id,
        categorySelected:    p.categorySelected,
        originalDescription: p.originalDescription?.slice(0, 200) ?? null,
        finalDescription:    p.description?.slice(0, 200) ?? null,
        descriptionReplaced: p.originalDescription !== p.description,
      },
      "[DIAG] AUTO_CATEGORIZE — Category Selected / Original Desc / Final Desc",
    );

    // ══════════════════════════════════════════════════════════════════════
    // [DIAG] VALIDATION — validatePostData()
    // دالة مسماة تُنفّذ خطوتين:
    //   1. إزالة القيم الوهمية (placeholder cleansing)
    //   2. فحص كفاية البيانات (data sufficiency)
    // ══════════════════════════════════════════════════════════════════════
    const validation = validatePostData(p);
    // NOTE: validatePostData mutates p.username and p.accountUrl in-place
    // when it detects placeholders, so p is already cleaned after this call.

    // ── Log stripped placeholders ─────────────────────────────────────────
    if (validation.strippedPlaceholders.length > 0) {
      logger.warn(
        {
          telegramMessageId: post.message_id,
          function: "validatePostData → Step 1: placeholder cleansing",
          strippedPlaceholders: validation.strippedPlaceholders,
          placeholderUsernamesList: [...PLACEHOLDER_USERNAMES],
          placeholderUrlsList:      [...PLACEHOLDER_URLS],
        },
        "[DIAG] 🚫 PLACEHOLDER_STRIPPED — قيم وهمية تم تجاهلها",
      );
    }

    // ── Rejection: only when ALL THREE fields are missing ─────────────────
    if (!validation.shouldSave) {
      logger.error(
        {
          telegramMessageId:  post.message_id,
          function:           "validatePostData → Step 2: data sufficiency check",
          rejectionReason:    validation.rejectionReason,
          checks: {
            "price > 0":       validation.checks.hasRealPrice,     // false → rejected
            "followers > 0":   validation.checks.hasRealFollowers, // false → rejected
            "accountUrl ≠ null": validation.checks.hasRealUrl,     // false → rejected
          },
          rule: "الرفض يحدث فقط إذا كانت price=0 AND followers=0 AND accountUrl=null في نفس الوقت",
          strippedPlaceholders: validation.strippedPlaceholders,
          rawText_preview:    rawText.slice(0, 200),
          fix_hint:           "أضف إلى المنشور: السعر + عدد المتابعين + رابط الحساب أو @username",
          example:            "السعر : 450 شيكل\nعدد المتابعين 43 ألف\nhttps://www.facebook.com/yourpage",
        },
        "[DIAG] ❌ REJECTED — validatePostData() قررت الرفض",
      );
      skipped++;
      continue;
    }

    // ── Partial data warnings (account WILL be saved) ─────────────────────
    const warnings: string[] = [];
    if (!validation.checks.hasRealPrice)
      warnings.push("⚠️ price=0 — الحساب سيُحفظ لأن متابعين أو رابط موجود");
    if (!validation.checks.hasRealFollowers)
      warnings.push("⚠️ followers=0 — الحساب سيُحفظ لأن سعر أو رابط موجود");
    if (!validation.checks.hasRealUrl)
      warnings.push("⚠️ accountUrl=null — الحساب سيُحفظ لأن سعر أو متابعين موجود");
    if (!p.description)
      warnings.push("⚠️ description=null");

    if (warnings.length > 0) {
      logger.warn(
        {
          telegramMessageId: post.message_id,
          function: "validatePostData → Step 2: passed (partial data)",
          checks: {
            "price > 0":       validation.checks.hasRealPrice,
            "followers > 0":   validation.checks.hasRealFollowers,
            "accountUrl ≠ null": validation.checks.hasRealUrl,
          },
          warnings,
        },
        "[DIAG] ⚠️ PARTIAL_DATA — الحساب سيُحفظ رغم نقص بعض الحقول",
      );
    }

    // ── OCR: try to extract username from image when text parsing found none ──
    // Runs ONLY when both username and accountUrl are still null at this point.
    let photoBuffer: Buffer | null = null;
    if (!p.username && !p.accountUrl && post.photo?.length) {
      const largest = post.photo.reduce((a, b) =>
        a.width * a.height >= b.width * b.height ? a : b,
      );
      logger.info(
        { telegramMessageId: post.message_id, platform: p.platform },
        "[OCR] لا يوجد username في النص — جاري تحليل الصورة...",
      );
      photoBuffer = await downloadTgBuffer(largest.file_id, token);
      if (photoBuffer) {
        const ocrUsername = await extractUsernameFromImage(photoBuffer, p.platform);
        if (ocrUsername) {
          p.username = ocrUsername;
          if      (p.platform === "instagram")        p.accountUrl = `https://www.instagram.com/${ocrUsername}`;
          else if (p.platform === "facebook")         p.accountUrl = `https://www.facebook.com/${ocrUsername}`;
          else                                        p.accountUrl = `https://www.tiktok.com/@${ocrUsername}`;
          p.parseLog.username   = `[OCR] مُستخرج من الصورة: @${ocrUsername}`;
          p.parseLog.accountUrl = `[OCR] بُني من الصورة (${p.platform}): ${p.accountUrl}`;
          logger.info(
            { telegramMessageId: post.message_id, ocrUsername, accountUrl: p.accountUrl },
            "[OCR] ✅ username ورابط تم إنشاؤهما تلقائياً من الصورة",
          );
        }
      }
    }

    // ── Download photo ──────────────────────────────────────────────────────
    let imageUrl: string | null = null;
    if (post.photo?.length) {
      const largest = post.photo.reduce((a, b) =>
        a.width * a.height >= b.width * b.height ? a : b,
      );
      // Reuse already-downloaded buffer (from OCR step) to avoid double download
      imageUrl = await importPhoto(largest.file_id, token, photoBuffer ?? undefined);
      if (!imageUrl) {
        logger.warn({ telegramMessageId: post.message_id }, "Telegram sync: فشل تحميل الصورة");
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // [DIAG] DATA_BEFORE_SAVE — البيانات الكاملة قبل الحفظ في DB
    // ══════════════════════════════════════════════════════════════════════
    const recordToSave = {
      name:                p.name,
      username:            p.username,
      platform:            p.platform,
      followers:           p.followers,
      price:               String(p.price),
      description:         p.description,
      originalDescription: p.originalDescription,
      imageUrl,
      accountUrl:          p.accountUrl,
      status:              "available" as const,
      featured:            false,
      telegramMessageId:   post.message_id,
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

    // ══════════════════════════════════════════════════════════════════════
    // [PLATFORM] سجل Debug للمنصة — مطلوب من المستخدم
    // ══════════════════════════════════════════════════════════════════════
    logger.info(
      {
        accountName:      p.name,
        platformReceived: p.parseLog.platform,   // ما قرأه الكود من الرسالة
        platformSaved:    p.platform,             // ما سيُحفظ في DB
        sectionDisplayed: p.categorySelected,    // القسم الذي سيظهر فيه
        username:         p.username ?? "—",
        accountUrl:       p.accountUrl ?? "—",
      },
      `📋 [PLATFORM] "${p.name}" | مستلم: ${p.parseLog.platform} | محفوظ: ${p.platform} | قسم: ${p.categorySelected}`,
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

    // ── Track URL generation stats ─────────────────────────────────────────
    if (p.accountUrl) {
      if (p.parseLog.accountUrl.startsWith("وُجد رابط")) {
        urlsFromPost++;
      } else {
        // URL was auto-built from username
        urlsGenerated++;
      }
    } else {
      needsManual++;
    }

    imported++;
  }

  // ── Auto-fix any accounts that still lack a URL ────────────────────────────
  // (Covers edge cases where URL construction was skipped for any reason)
  if (imported > 0) {
    try {
      await syncAccountUrls("sync");
    } catch (syncErr) {
      logger.warn({ syncErr }, "runTelegramSync: syncAccountUrls() خطأ — تجاهل");
    }
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

  // ── Sort log: show follower order per platform ─────────────────────────────
  if (imported > 0 || accountPosts.length > 0) {
    try {
      const platforms = ["tiktok", "tiktok_monetized", "instagram", "facebook"] as const;
      logger.info({ event: "SORTING ACCOUNTS..." }, "🔃 SORTING ACCOUNTS...");
      for (const platform of platforms) {
        const rows = await db
          .select({
            id:        accountsTable.id,
            followers: accountsTable.followers,
          })
          .from(accountsTable)
          .where(
            and(
              eq(accountsTable.platform, platform),
              eq(accountsTable.status, "available"),
            ),
          )
          .orderBy(
            sql`CASE WHEN COALESCE(${accountsTable.followers}, 0) = 0 THEN 1 ELSE 0 END`,
            desc(accountsTable.followers),
          );

        const label =
          platform === "tiktok"           ? "TikTok"
        : platform === "tiktok_monetized" ? "TikTok Monetized"
        : platform === "instagram"        ? "Instagram"
        : "Facebook";

        logger.info(
          {
            platform,
            sortOrder:    "followers DESC (zeros last)",
            totalVisible: rows.length,
            top3: rows.slice(0, 3).map(r => ({
              id:        r.id,
              followers: Number(r.followers ?? 0),
            })),
          },
          `Platform: ${label} — Sorted by followers DESC`,
        );
      }
    } catch (sortLogErr) {
      logger.warn({ sortLogErr }, "SORTING ACCOUNTS: خطأ أثناء كتابة سجل الترتيب");
    }
  }

  return { imported, skipped, total: accountPosts.length, urlsFromPost, urlsGenerated, needsManual };
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
      logger.info(
        {
          "📥 حسابات جديدة":             result.imported,
          "⏭️ تم تخطيها (مكررة/مرفوضة)": result.skipped,
          "📨 منشورات فُحصت":            result.total,
          "🔗 روابط من المنشور مباشرةً":  result.urlsFromPost,
          "⚙️ روابط أُنشئت تلقائياً":     result.urlsGenerated,
          "⚠️ تحتاج تدخلاً يدوياً":       result.needsManual,
        },
        "✅ Telegram sync — تقرير المزامنة",
      );
      if (result.needsManual > 0) {
        logger.warn(
          { count: result.needsManual },
          `⚠️ [telegramSync] ${result.needsManual} حساب بدون رابط ولا username — راجعها يدوياً في لوحة التحكم`,
        );
      }
    } else {
      logger.info(
        { "📨 منشورات فُحصت": result.total, "⏭️ مكررة/مرفوضة": result.skipped },
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
  // Pre-warm OCR worker so language data is ready before first sync
  warmupOcr();
  setTimeout(tick, 5_000);
  syncTimer = setInterval(tick, POLL_INTERVAL_MS);
}
