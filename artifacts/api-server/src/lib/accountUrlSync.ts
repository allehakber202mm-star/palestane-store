import { db, accountsTable } from "@workspace/db";
import { isNull, isNotNull, inArray, or, eq, sql } from "drizzle-orm";
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
 * Scans all accounts in supported platforms and auto-generates accountUrl
 * for any account that has a username but is missing a URL.
 * Logs a summary report.
 */
export async function syncAccountUrls(trigger: "startup" | "sync" | "mutation" = "startup"): Promise<void> {
  const rows = await db
    .select({
      id: accountsTable.id,
      platform: accountsTable.platform,
      username: accountsTable.username,
      accountUrl: accountsTable.accountUrl,
    })
    .from(accountsTable)
    .where(
      inArray(accountsTable.platform, [...SUPPORTED_PLATFORMS]),
    );

  const total = rows.length;
  let alreadyHasUrl = 0;
  let fixed = 0;
  let skipped = 0;

  const toFix: { id: number; url: string }[] = [];

  for (const row of rows) {
    if (row.accountUrl) {
      alreadyHasUrl++;
      continue;
    }
    if (!row.username || row.username.trim() === "") {
      skipped++;
      continue;
    }
    const url = buildProfileUrl(row.platform as SupportedPlatform, row.username);
    toFix.push({ id: row.id, url });
  }

  // Batch update all accounts that need a URL
  for (const { id, url } of toFix) {
    await db
      .update(accountsTable)
      .set({ accountUrl: url, updatedAt: new Date() })
      .where(eq(accountsTable.id, id));
    fixed++;
  }

  logger.info(
    {
      trigger,
      total_checked: total,
      already_had_url: alreadyHasUrl,
      fixed,
      skipped_no_username: skipped,
    },
    `[accountUrlSync] فحص الحسابات اكتمل | trigger=${trigger} | total=${total} | fixed=${fixed} | alreadyHadUrl=${alreadyHasUrl} | skippedNoUsername=${skipped}`,
  );
}
