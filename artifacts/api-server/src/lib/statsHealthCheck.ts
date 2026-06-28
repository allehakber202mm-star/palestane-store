import { db, statsTable, siteVisitsTable, accountVisitsTable, accountsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

interface HealthIssue {
  description: string;
  fixed: boolean;
}

/**
 * Runs on server startup. Checks all statistics tables and counters,
 * auto-fixes what it can, and logs a full report.
 */
export async function statsHealthCheck(): Promise<void> {
  const issues: HealthIssue[] = [];

  // ── 1. Check site_visits table is accessible ──────────────────────────────
  try {
    const result = await db.execute<{ cnt: number }>(
      sql`SELECT count(*)::int AS cnt FROM site_visits`,
    );
    const cnt = Number(result.rows[0]?.cnt ?? 0);
    logger.info({ siteVisitsCount: cnt }, "[statsHealth] site_visits ✅");
  } catch (e) {
    issues.push({ description: "site_visits table not accessible", fixed: false });
    logger.error({ err: e }, "[statsHealth] site_visits ❌");
  }

  // ── 2. Check account_visits table is accessible ───────────────────────────
  try {
    const result = await db.execute<{ cnt: number }>(
      sql`SELECT count(*)::int AS cnt FROM account_visits`,
    );
    const cnt = Number(result.rows[0]?.cnt ?? 0);
    logger.info({ accountVisitsCount: cnt }, "[statsHealth] account_visits ✅");
  } catch (e) {
    issues.push({ description: "account_visits table not accessible", fixed: false });
    logger.error({ err: e }, "[statsHealth] account_visits ❌");
  }

  // ── 3. Check stats table is accessible ───────────────────────────────────
  try {
    const result = await db.execute<{ event_type: string; cnt: number }>(
      sql`SELECT event_type, count(*)::int AS cnt FROM stats GROUP BY event_type`,
    );
    const summary = Object.fromEntries(result.rows.map(r => [r.event_type, Number(r.cnt)]));
    logger.info({ eventCounts: summary }, "[statsHealth] stats table ✅");
  } catch (e) {
    issues.push({ description: "stats table not accessible", fixed: false });
    logger.error({ err: e }, "[statsHealth] stats table ❌");
  }

  // ── 4. Check accounts with negative click/visit counts ────────────────────
  try {
    const result = await db.execute<{ cnt: number }>(
      sql`SELECT count(*)::int AS cnt FROM accounts WHERE click_count < 0 OR visit_count < 0`,
    );
    const badCount = Number(result.rows[0]?.cnt ?? 0);
    if (badCount > 0) {
      await db.execute(sql`UPDATE accounts SET click_count = 0 WHERE click_count < 0`);
      await db.execute(sql`UPDATE accounts SET visit_count = 0 WHERE visit_count < 0`);
      issues.push({ description: `${badCount} accounts had negative counters — reset to 0`, fixed: true });
      logger.warn({ badCount }, "[statsHealth] Negative counters found and reset ✅");
    }
  } catch (e) {
    issues.push({ description: "Could not check account counters", fixed: false });
    logger.error({ err: e }, "[statsHealth] counter check ❌");
  }

  // ── 5. Check generate_series SQL works (required for chart) ───────────────
  try {
    await db.execute(sql`SELECT generate_series(now() - interval '1 day', now(), interval '1 day')`);
    logger.info("[statsHealth] generate_series (chart engine) ✅");
  } catch (e) {
    issues.push({ description: "generate_series not available (chart will break)", fixed: false });
    logger.error({ err: e }, "[statsHealth] generate_series ❌");
  }

  // ── Report ────────────────────────────────────────────────────────────────
  const fixed   = issues.filter(i => i.fixed).length;
  const unfixed = issues.filter(i => !i.fixed).length;

  if (issues.length === 0) {
    logger.info("✅ Statistics Health Check Passed.");
  } else {
    logger.info(
      { total: issues.length, fixed, unfixed, issues },
      `[statsHealth] فحص اكتمل — مشاكل: ${issues.length} | تم الإصلاح: ${fixed} | يحتاج تدخل: ${unfixed}`,
    );
  }
}
