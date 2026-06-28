import { db, accountsTable } from "@workspace/db";
import { inArray, eq } from "drizzle-orm";
import { objectStorageClient } from "./objectStorage";
import { extractUsernameFromImage } from "./ocrExtract";
import { logger } from "./logger";

const SUPPORTED_PLATFORMS = ["tiktok", "tiktok_monetized", "instagram", "facebook"] as const;
type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

function buildProfileUrl(platform: SupportedPlatform, username: string): string {
  const u = username.replace(/^@/, "");
  if (platform === "tiktok" || platform === "tiktok_monetized") return `https://www.tiktok.com/@${u}`;
  if (platform === "instagram") return `https://www.instagram.com/${u}`;
  return `https://www.facebook.com/${u}`;
}

/**
 * Parse a stored imageUrl and resolve to a GCS File for downloading.
 * Supports:
 *   /api/storage/objects/uploads/{uuid}  — new GCS storage
 *   /api/uploads/...                      — old local-upload style (served via express static)
 */
async function downloadImageBuffer(imageUrl: string): Promise<Buffer | null> {
  try {
    // ── New GCS storage ────────────────────────────────────────────────────
    // imageUrl: "/api/storage/objects/uploads/{uuid}"
    // strip "/api/storage" → "/objects/uploads/{uuid}"
    if (imageUrl.startsWith("/api/storage/objects/")) {
      const objectPath = imageUrl.replace("/api/storage", ""); // "/objects/uploads/{uuid}"
      const privateDir = (process.env.PRIVATE_OBJECT_DIR ?? "").replace(/^\//, "");
      if (!privateDir) { logger.warn("[ocrScan] PRIVATE_OBJECT_DIR غير مضبوط"); return null; }

      // fullPath = "{bucket}/{privateDirRest}/uploads/{uuid}"
      // privateDir = "{bucket}/{rest}"
      const parts = privateDir.split("/");
      const bucketName = parts[0];
      // strip the leading "/objects/" then prepend the rest of privateDir
      const entityId = objectPath.replace(/^\/objects\//, ""); // "uploads/{uuid}"
      const objectName = parts.slice(1).concat(entityId.split("/")).join("/");

      const bucket = objectStorageClient.bucket(bucketName);
      const file   = bucket.file(objectName);
      const [exists] = await file.exists();
      if (!exists) { logger.warn({ objectName }, "[ocrScan] ملف GCS غير موجود"); return null; }
      const [buf] = await file.download();
      return buf as Buffer;
    }

    // ── Old local uploads — fetch via HTTP on same port ───────────────────
    if (imageUrl.startsWith("/api/uploads/")) {
      const port = process.env.PORT ?? "8080";
      const res  = await fetch(`http://localhost:${port}${imageUrl}`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) { logger.warn({ status: res.status }, "[ocrScan] فشل تنزيل صورة قديمة"); return null; }
      return Buffer.from(await res.arrayBuffer());
    }

    logger.warn({ imageUrl }, "[ocrScan] صيغة imageUrl غير مدعومة");
    return null;
  } catch (err) {
    logger.warn({ err, imageUrl }, "[ocrScan] فشل تنزيل الصورة");
    return null;
  }
}

// ── Report shape ─────────────────────────────────────────────────────────────
export interface OcrScanReport {
  checked:     number;   // accounts scanned (no URL, has image)
  skipped:     number;   // already had a URL — untouched
  noImage:     number;   // no URL and no image → can't do anything
  ocrSuccess:  number;   // username extracted by OCR
  urlsAdded:   number;   // URLs saved to DB
  noUsername:  number;   // image found but OCR failed to find username
}

let scanRunning = false;

/**
 * Scan ALL accounts that lack an accountUrl and attempt to extract
 * a username via OCR on their stored image.
 * Safe to call multiple times — skips accounts that already have a URL.
 */
export async function ocrScanExistingAccounts(): Promise<OcrScanReport> {
  if (scanRunning) {
    logger.info("[ocrScan] فحص آخر قيد التشغيل — تم التخطي");
    return { checked: 0, skipped: 0, noImage: 0, ocrSuccess: 0, urlsAdded: 0, noUsername: 0 };
  }
  scanRunning = true;

  logger.info("[ocrScan] ══════ بدء الفحص الشامل بـ OCR ══════");

  try {
    const accounts = await db
      .select({
        id:         accountsTable.id,
        name:       accountsTable.name,
        platform:   accountsTable.platform,
        username:   accountsTable.username,
        accountUrl: accountsTable.accountUrl,
        imageUrl:   accountsTable.imageUrl,
      })
      .from(accountsTable)
      .where(inArray(accountsTable.platform, [...SUPPORTED_PLATFORMS]));

    const alreadyHasUrl = accounts.filter(a => a.accountUrl).length;
    const toScan        = accounts.filter(a => !a.accountUrl && a.imageUrl);
    const noImage       = accounts.filter(a => !a.accountUrl && !a.imageUrl).length;

    logger.info(
      {
        "📊 إجمالي الحسابات":                accounts.length,
        "✅ لديها رابط بالفعل (مُتخطاة)":     alreadyHasUrl,
        "🔍 تحتاج فحص OCR (لها صورة)":        toScan.length,
        "❌ لا رابط ولا صورة (يحتاج تدخل)":   noImage,
      },
      "[ocrScan] إحصائيات أولية",
    );

    let ocrSuccess = 0;
    let urlsAdded  = 0;
    let noUsername = 0;

    for (const account of toScan) {
      logger.info(
        { id: account.id, name: account.name, platform: account.platform },
        "[ocrScan] فحص الحساب...",
      );

      const buffer = await downloadImageBuffer(account.imageUrl!);
      if (!buffer) {
        logger.warn({ id: account.id }, "[ocrScan] تعذّر تنزيل الصورة — تخطي");
        noUsername++;
        continue;
      }

      const username = await extractUsernameFromImage(buffer, account.platform);

      if (!username) {
        logger.info({ id: account.id, name: account.name }, "[ocrScan] لم يُعثر على username داخل الصورة");
        noUsername++;
        continue;
      }

      ocrSuccess++;
      const url = buildProfileUrl(account.platform as SupportedPlatform, username);

      await db
        .update(accountsTable)
        .set({ username, accountUrl: url, updatedAt: new Date() })
        .where(eq(accountsTable.id, account.id));

      urlsAdded++;
      logger.info(
        { id: account.id, name: account.name, username, url },
        "[ocrScan] ✅ رابط تم إنشاؤه وحفظه",
      );
    }

    const report: OcrScanReport = {
      checked:    toScan.length,
      skipped:    alreadyHasUrl,
      noImage,
      ocrSuccess,
      urlsAdded,
      noUsername,
    };

    logger.info(
      {
        "📊 حسابات تم فحصها":                report.checked,
        "✅ حسابات مع رابط (مُتخطاة)":        report.skipped,
        "🔍 usernames استُخرجت بـ OCR":        report.ocrSuccess,
        "🔗 روابط زيارة تمت إضافتها":         report.urlsAdded,
        "⚠️ لم يُعثر على username في الصورة": report.noUsername,
        "❌ بدون صورة بالكلية":               report.noImage,
      },
      "[ocrScan] ══════ انتهى الفحص الشامل ══════",
    );

    return report;
  } finally {
    scanRunning = false;
  }
}
