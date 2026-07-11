import { db, statsTable, siteVisitsTable } from "@workspace/db";
import { sql, lt } from "drizzle-orm";
import { logger } from "./logger";

// Retention periods
const STATS_RETENTION_DAYS       = 180;
const SITE_VISITS_RETENTION_DAYS = 180;

/**
 * Removes old records from high-growth analytics tables.
 * Runs once a day (first call 10 minutes after startup, then every 24 hours).
 *
 * Retention policy:
 *   - stats          → keep last 180 days
 *   - site_visits    → keep last 180 days
 *   - account_visits → not pruned (small volume, linked to accounts by FK cascade)
 */
export async function pruneOldData(): Promise<void> {
  const statsCutoff      = new Date(Date.now() - STATS_RETENTION_DAYS       * 24 * 60 * 60 * 1000);
  const siteVisitsCutoff = new Date(Date.now() - SITE_VISITS_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  try {
    const statsResult = await db.execute<{ deleted: string }>(
      sql`WITH deleted AS (DELETE FROM stats WHERE created_at < ${statsCutoff} RETURNING id)
          SELECT count(*)::int AS deleted FROM deleted`,
    );
    const statsDeleted = Number(statsResult.rows[0]?.deleted ?? 0);

    const siteResult = await db.execute<{ deleted: string }>(
      sql`WITH deleted AS (DELETE FROM site_visits WHERE created_at < ${siteVisitsCutoff} RETURNING id)
          SELECT count(*)::int AS deleted FROM deleted`,
    );
    const siteDeleted = Number(siteResult.rows[0]?.deleted ?? 0);

    if (statsDeleted > 0 || siteDeleted > 0) {
      logger.info(
        { statsDeleted, siteDeleted },
        "🗑️ dataPruning: تم حذف السجلات القديمة",
      );
    } else {
      logger.info("dataPruning: لا سجلات قديمة للحذف");
    }
  } catch (err) {
    logger.error({ err }, "dataPruning: خطأ أثناء تنظيف البيانات القديمة");
  }
}

const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000; // once per day

export function startDataPruning(): void {
  // Run first prune 10 minutes after startup (avoid startup load spike)
  setTimeout(() => {
    pruneOldData().catch(() => {});
    setInterval(() => pruneOldData().catch(() => {}), PRUNE_INTERVAL_MS);
  }, 10 * 60 * 1000);
}
