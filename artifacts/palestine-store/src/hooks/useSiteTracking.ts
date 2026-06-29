import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getVisitorId(): string {
  const KEY = "ps_vid";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

function getSessionId(): string {
  const KEY = "ps_sid";
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

export function useSiteTracking() {
  const [location] = useLocation();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (location.startsWith("/admin")) return;
    if (lastTracked.current === location) return;
    lastTracked.current = location;

    const visitorId = getVisitorId();
    const sessionId = getSessionId();
    const referrer  = document.referrer || null;

    fetch(`${BASE}/api/stats/site-visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, sessionId, page: location, referrer }),
    }).catch(() => {});
  }, [location]);
}
