import { createWorker, type Worker } from "tesseract.js";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Language data cache directory — persists across restarts
const CACHE_DIR = path.resolve(__dirname, "../../.tesseract-cache");

// ── Singleton worker ──────────────────────────────────────────────────────────
let _worker: Worker | null = null;
let _workerReady = false;
let _workerInit: Promise<void> | null = null;

async function initWorker(): Promise<void> {
  _worker = await createWorker("eng", 1, {
    cachePath: CACHE_DIR,
    // Silence verbose tesseract progress logs
    logger: () => {},
  });
  _workerReady = true;
}

async function getWorker(): Promise<Worker | null> {
  if (_workerReady && _worker) return _worker;
  if (!_workerInit) _workerInit = initWorker().catch(err => {
    logger.warn({ err }, "[OCR] worker init failed — OCR disabled");
    _workerInit = null;
  });
  await _workerInit;
  return _workerReady ? _worker : null;
}

// ── Noise: UI words that are never usernames ──────────────────────────────────
const NOISE_WORDS = new Set([
  "followers", "following", "likes", "posts", "videos", "views",
  "share", "tiktok", "instagram", "facebook", "reels", "story", "stories",
  "search", "explore", "home", "profile", "settings", "edit", "message",
  "follow", "unfollow", "subscribe", "verified", "live",
  "palestine", "palestinestoreL", "palestine_storeL",
]);

// Handles that are the store's own channels — skip
const OWN_HANDLES = /^(Palestine_storeL?|Palestine_sstore|PalestineStore|admin|bot)$/i;

// ── Extract best username from raw OCR text ───────────────────────────────────
function extractBestUsername(text: string, platform: string): string | null {
  const candidates: string[] = [];

  // 1. @handle — most reliable signal
  for (const m of text.matchAll(/@([A-Za-z0-9._]{3,30})/g)) {
    const h = m[1];
    if (!NOISE_WORDS.has(h.toLowerCase()) && !OWN_HANDLES.test(h)) {
      candidates.push(h);
    }
  }

  // 2. Platform URL patterns embedded in screenshots
  if (platform === "tiktok" || platform === "tiktok_monetized") {
    for (const m of text.matchAll(/tiktok\.com\/@?([A-Za-z0-9._]{3,30})/gi)) {
      const h = m[1].replace(/^@/, "");
      if (!NOISE_WORDS.has(h.toLowerCase())) candidates.push(h);
    }
  } else if (platform === "instagram") {
    for (const m of text.matchAll(/instagram\.com\/([A-Za-z0-9._]{3,30})/gi)) {
      const h = m[1].replace(/^@/, "");
      if (!NOISE_WORDS.has(h.toLowerCase())) candidates.push(h);
    }
    // Instagram usernames appear at top of profile without @ — plain word lines
    for (const m of text.matchAll(/^([A-Za-z0-9._]{4,30})$/gm)) {
      const h = m[1];
      if (!NOISE_WORDS.has(h.toLowerCase()) && !/^\d+$/.test(h)) candidates.push(h);
    }
  } else if (platform === "facebook") {
    for (const m of text.matchAll(/(?:facebook|fb)\.com\/([A-Za-z0-9._]{3,30})/gi)) {
      const h = m[1].replace(/^@/, "");
      if (!NOISE_WORDS.has(h.toLowerCase()) && !["watch", "groups", "pages", "events"].includes(h.toLowerCase())) {
        candidates.push(h);
      }
    }
  } else if (platform === "snapchat") {
    // snapchat.com/add/USERNAME
    for (const m of text.matchAll(/snapchat\.com\/add\/([A-Za-z0-9._-]{3,30})/gi)) {
      const h = m[1];
      if (!NOISE_WORDS.has(h.toLowerCase())) candidates.push(h);
    }
    // Plain username on its own line
    for (const m of text.matchAll(/^([A-Za-z0-9._-]{4,30})$/gm)) {
      const h = m[1];
      if (!NOISE_WORDS.has(h.toLowerCase()) && !/^\d+$/.test(h)) candidates.push(h);
    }
    // Username embedded inline — e.g. "- jody268588 By" — word with both letters and digits
    for (const m of text.matchAll(/\b([A-Za-z][A-Za-z0-9._-]{3,29}\d[A-Za-z0-9._-]*|\d[A-Za-z0-9._-]*[A-Za-z][A-Za-z0-9._-]{2,29})\b/g)) {
      const h = m[1];
      if (!NOISE_WORDS.has(h.toLowerCase()) && h.length >= 4 && h.length <= 30) candidates.push(h);
    }
  }

  if (candidates.length === 0) return null;

  // Return the first valid candidate (prominence order)
  const best = candidates[0].replace(/^@/, "").trim();
  return best.length >= 3 ? best : null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run OCR on an image buffer and try to extract a social-media username.
 * Returns the extracted username (without @), or null if nothing found.
 *
 * Only called when text-parsing already failed to find a username/URL.
 */
export async function extractUsernameFromImage(
  imageBuffer: Buffer,
  platform: string,
): Promise<string | null> {
  const w = await getWorker();
  if (!w) return null;

  try {
    const { data: { text, confidence } } = await w.recognize(imageBuffer);

    logger.info(
      { platform, chars: text.length, confidence: Math.round(confidence) },
      "[OCR] نص مستخرج من الصورة",
    );

    if (!text.trim() || confidence < 20) {
      logger.info({ confidence }, "[OCR] ثقة منخفضة جداً — تجاهل النتيجة");
      return null;
    }

    const username = extractBestUsername(text, platform);

    if (username) {
      logger.info({ username, platform }, "[OCR] ✅ اسم مستخدم مستخرج من الصورة");
    } else {
      logger.info("[OCR] لم يُعثر على اسم مستخدم في الصورة");
    }

    return username;
  } catch (err) {
    logger.warn({ err }, "[OCR] خطأ أثناء تحليل الصورة");
    return null;
  }
}

/**
 * Warm up the OCR worker at server start (downloads lang data once).
 * Call fire-and-forget; errors are swallowed.
 */
export function warmupOcr(): void {
  getWorker().catch(() => {});
}

/**
 * Shut down the OCR worker gracefully.
 */
export async function terminateOcrWorker(): Promise<void> {
  if (_worker) {
    await _worker.terminate();
    _worker = null;
    _workerReady = false;
    _workerInit = null;
  }
}
