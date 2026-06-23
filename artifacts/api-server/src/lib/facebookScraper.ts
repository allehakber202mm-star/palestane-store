import { logger } from "./logger";

export interface ScrapeResult {
  success: boolean;
  count?: number;
  resolvedUrl?: string;
  reason?: string;
}

const UA_CRAWLER = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const UA_BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const TIMEOUT_MS = 10_000;

function parseFollowers(html: string): number | null {
  const patterns: RegExp[] = [
    /"follower_count"\s*:\s*(\d+)/,
    /"followers_count"\s*:\s*(\d+)/,
    /"fan_count"\s*:\s*(\d+)/,
    /"subscriber_count"\s*:\s*(\d+)/,
    /"friends_count"\s*:\s*(\d+)/,
    /content="([\d,]+)\s+[Ff]ollowers?"/,
    /([\d,]+)\s+متابع/,
    /"formatted_count"\s*:\s*"([\d.,]+\s*[KMBكمم]?)"/i,
    /([\d,.]+[KkMmBb]?)\s+[Ff]ollowers?/,
  ];

  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m) {
      const raw = m[1].replace(/,/g, "").trim();
      const lower = raw.toLowerCase();
      if (lower.endsWith("k")) return Math.round(parseFloat(raw) * 1_000);
      if (lower.endsWith("m")) return Math.round(parseFloat(raw) * 1_000_000);
      if (lower.endsWith("b")) return Math.round(parseFloat(raw) * 1_000_000_000);
      const n = parseInt(raw, 10);
      if (!isNaN(n) && n >= 0) return n;
    }
  }
  return null;
}

async function fetchWithTimeout(url: string, ua: string): Promise<{ ok: boolean; status: number; html: string; resolvedUrl: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ar,en;q=0.8",
        "Cache-Control": "no-cache",
      },
      redirect: "follow",
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const html = res.ok ? await res.text() : "";
    return { ok: res.ok, status: res.status, html, resolvedUrl: res.url };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export async function scrapeFacebookFollowers(url: string): Promise<ScrapeResult> {
  try {
    // Step 1: Resolve share link using facebookexternalhit (follows redirects)
    const crawlerRes = await fetchWithTimeout(url, UA_CRAWLER);

    if (!crawlerRes.ok) {
      return {
        success: false,
        reason: `HTTP ${crawlerRes.status} من Facebook عند جلب الرابط`,
      };
    }

    const resolvedUrl = crawlerRes.resolvedUrl;

    // Step 2: Try parsing from crawler HTML
    const count1 = parseFollowers(crawlerRes.html);
    if (count1 !== null) {
      logger.info({ url, resolvedUrl, count: count1 }, "Facebook scrape: نجح مع UA الزاحف");
      return { success: true, count: count1, resolvedUrl };
    }

    // Step 3: Try with browser UA on resolved URL (if different from original)
    if (resolvedUrl && resolvedUrl !== url) {
      try {
        const browserRes = await fetchWithTimeout(resolvedUrl, UA_BROWSER);
        if (browserRes.ok) {
          const count2 = parseFollowers(browserRes.html);
          if (count2 !== null) {
            logger.info({ url, resolvedUrl, count: count2 }, "Facebook scrape: نجح مع UA المتصفح");
            return { success: true, count: count2, resolvedUrl };
          }
        }
      } catch {
        // ignore; fall through to final failure
      }
    }

    logger.warn({ url, resolvedUrl }, "Facebook scrape: عدد المتابعين غير موجود في HTML");
    return {
      success: false,
      resolvedUrl,
      reason: "عدد المتابعين يُحمَّل بـ JavaScript ولا يظهر في HTML الثابت",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.includes("abort") || msg.includes("timeout") || msg.includes("ETIMEDOUT");
    logger.warn({ url, error: msg }, "Facebook scrape: خطأ في الاتصال");
    return {
      success: false,
      reason: isTimeout
        ? `انتهت مهلة الاتصال (${TIMEOUT_MS / 1000} ثانية)`
        : `خطأ في الشبكة: ${msg.slice(0, 100)}`,
    };
  }
}
