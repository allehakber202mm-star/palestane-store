import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trackSiteVisit } from "@workspace/api-client-react";

// ── Persistent visitor ID (survives sessions) ────────────────────────────────
function getVisitorId(): string {
  const KEY = "ps_vid";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

// ── Per-session ID (resets each new browser session) ────────────────────────
function getSessionId(): string {
  const KEY = "ps_sid";
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

// ── Hook: fires once per route change (client-side dedup + server dedup) ─────
export function useSiteTracking() {
  const [location] = useLocation();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    // Skip admin pages — we only track public visitors
    if (location.startsWith("/admin")) return;

    // Client-side dedup: same path already sent in this effect cycle
    if (lastTracked.current === location) return;
    lastTracked.current = location;

    const visitorId = getVisitorId();
    const sessionId = getSessionId();

    // Fire-and-forget — don't block rendering
    trackSiteVisit({ visitorId, sessionId, page: location }).catch(() => {
      // Silently ignore network errors — analytics must never break the app
    });
  }, [location]);
}
