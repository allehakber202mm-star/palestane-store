import { AdminLayout } from "@/components/layout/AdminLayout";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Eye, Phone, ExternalLink, BarChart2, Globe, Activity,
  Users2, TrendingUp, BarChart3, Calendar, Smartphone,
  Monitor, Tablet, Search, ArrowUpDown, ChevronUp, ChevronDown,
  ChevronRight, ChevronLeft, Clock, Zap, MousePointer2, RefreshCw,
  Route,
} from "lucide-react";
import { SiTiktok, SiInstagram, SiFacebook } from "react-icons/si";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer,
  Legend,
} from "recharts";
import { useGetSiteOverview } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Auth header helper ───────────────────────────────────────────────────────
function authHeader() {
  const token = localStorage.getItem("admin_token") ?? "";
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

// ── Date helpers ─────────────────────────────────────────────────────────────
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function subDays(d: Date, n: number) {
  return new Date(d.getTime() - n * 24 * 60 * 60 * 1000);
}
function getFromTo(range: string, customFrom: string, customTo: string) {
  const now = new Date();
  if (range === "today")  return { from: startOfDay(now).toISOString(), to: now.toISOString() };
  if (range === "7d")     return { from: subDays(now, 7).toISOString(),  to: now.toISOString() };
  if (range === "30d")    return { from: subDays(now, 30).toISOString(), to: now.toISOString() };
  if (range === "custom" && customFrom && customTo)
    return { from: new Date(customFrom).toISOString(), to: new Date(customTo + "T23:59:59").toISOString() };
  return { from: subDays(now, 30).toISOString(), to: now.toISOString() };
}
function formatDateShort(s: string) {
  return new Date(s).toLocaleDateString("ar-EG", { month: "short", day: "numeric" });
}
function formatRelTime(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `منذ ${diff} ث`;
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} س`;
  return formatDateShort(iso);
}

// ── Page display names ───────────────────────────────────────────────────────
const PAGE_LABELS: Record<string, string> = {
  "/":              "🏠 الصفحة الرئيسية",
  "/accounts":      "📋 الحسابات",
  "/about":         "ℹ️ من نحن",
  "/feedback":      "💬 آراء العملاء",
  "/contact":       "📞 تواصل معنا",
  "/celebrity-ads": "🌟 إعلانات المشاهير",
};
function pageLabel(p: string) {
  if (PAGE_LABELS[p]) return PAGE_LABELS[p];
  if (p.startsWith("/account/")) return `👤 حساب #${p.split("/")[2]}`;
  return p;
}

const PLT_ICON: Record<string, React.ReactNode> = {
  tiktok:           <SiTiktok className="w-3.5 h-3.5" />,
  tiktok_monetized: <SiTiktok className="w-3.5 h-3.5 text-green-600" />,
  instagram:        <SiInstagram className="w-3.5 h-3.5 text-pink-500" />,
  facebook:         <SiFacebook className="w-3.5 h-3.5 text-blue-500" />,
};
function platformAr(p: string) {
  if (p === "tiktok_monetized") return "تيك توك أرباح";
  if (p === "tiktok")    return "تيك توك";
  if (p === "instagram") return "إنستغرام";
  if (p === "facebook")  return "فيسبوك";
  return p;
}

// ── Types ────────────────────────────────────────────────────────────────────
type ActivityItem =
  | { id: string; type: "visit"; page: string; timestamp: string; device: string; source: string }
  | { id: string; type: "event"; eventType: string; accountId?: number; accountName?: string; timestamp: string };

type JourneyItem = {
  sessionId: string;
  pages: { page: string; time: string }[];
  startTime: string;
  device: string;
  source: string;
  pageCount: number;
};

type AdvancedData = {
  visitCount:     number;
  uniqueVisitors: number;
  pageViews:      number;
  waClicks:       number;
  urlClicks:      number;
  dailyChart:     { date: string; count: number }[];
  topPages:       { page: string; count: number }[];
  devices:        { type: string; count: number }[];
  browsers:       { name: string; count: number }[];
  sources:        { source: string; count: number }[];
  platforms:      { platform: string; count: number }[];
  hourlyChart:    { hour: number; count: number }[];
  heatmap:        { day: number; hour: number; count: number }[];
  buttonClicks:   { button: string; label: string; count: number }[];
  recentActivity: ActivityItem[];
  journeys:       JourneyItem[];
  avgSessionPages: number;
};

type EngagementRow = {
  id: number; name: string; platform: string;
  imageUrl: string | null; status: string;
  followers: number; price: string;
  pageViews: number; whatsappClicks: number; urlClicks: number;
  conversionRate: number; lastActivity: string | null;
};

type SortKey = "pageViews" | "whatsappClicks" | "urlClicks" | "conversionRate" | "name" | "followers";

type DetailData = {
  pageViews: number; uniqueVisitors: number; urlClicks: number;
  whatsappClicks: number; conversionRate: number;
  lastSeen: string | null;
  dailyChart: { date: string; views: number; clicks: number }[];
};

type TopItem = { id: number; name: string; platform: string; imageUrl: string | null; count: number };
type AdminDetailData = {
  totals: { pageViews: number; whatsappClicks: number; accountUrlClicks: number };
  topByPageViews: TopItem[];
  topByWhatsapp: TopItem[];
  topByAccountUrlClick: TopItem[];
};

// ── Sub-components ───────────────────────────────────────────────────────────
function SummaryCard({ icon, label, value, sub, color, bg }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string;
  color: string; bg: string;
}) {
  return (
    <div className={`${bg} rounded-2xl border p-4 flex items-start gap-3 shadow-sm`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color} bg-current/10`}>
        <span className={color}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium leading-none mb-1">{label}</p>
        <p className="text-2xl font-black leading-none">{typeof value === "number" ? value.toLocaleString("ar-EG") : value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold shrink-0 w-8 text-left">{value.toLocaleString("ar-EG")}</span>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="font-bold text-sm">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function TopList({ title, icon, items, emptyMsg, onSelect }: {
  title: string; icon: React.ReactNode; items: TopItem[];
  emptyMsg: string; onSelect?: (id: number) => void;
}) {
  return (
    <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b bg-muted/30">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="font-bold text-sm">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-center text-muted-foreground text-sm py-8">{emptyMsg}</p>
      ) : (
        <ol className="divide-y">
          {items.map((item, i) => (
            <li
              key={item.id}
              onClick={() => onSelect?.(item.id)}
              className={`flex items-center gap-3 px-5 py-3 ${onSelect ? "cursor-pointer hover:bg-muted/30 transition-colors" : ""}`}
            >
              <span className="text-muted-foreground/50 font-black text-xs w-4 shrink-0">{i + 1}</span>
              {item.imageUrl ? (
                <img src={item.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover border shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                  {PLT_ICON[item.platform] ?? <SiTiktok className="w-3.5 h-3.5" />}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate" dir="ltr">{item.name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {PLT_ICON[item.platform]} {platformAr(item.platform)}
                </p>
              </div>
              <span className="font-black text-base text-primary shrink-0">{item.count.toLocaleString("ar-EG")}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
  return dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
}

// ── Heatmap ──────────────────────────────────────────────────────────────────
const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function Heatmap({ data }: { data: { day: number; hour: number; count: number }[] }) {
  const map: Record<string, number> = {};
  let maxVal = 0;
  for (const d of data) {
    const key = `${d.day}-${d.hour}`;
    map[key] = (map[key] ?? 0) + d.count;
    if (map[key] > maxVal) maxVal = map[key];
  }

  function cellColor(val: number): string {
    if (!val) return "bg-muted/40";
    const pct = val / maxVal;
    if (pct > 0.75) return "bg-blue-600";
    if (pct > 0.5)  return "bg-blue-500";
    if (pct > 0.25) return "bg-blue-400";
    if (pct > 0.1)  return "bg-blue-300";
    return "bg-blue-200";
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Hour labels */}
        <div className="flex mb-1 gap-0.5 mr-16">
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="flex-1 text-center text-[9px] text-muted-foreground">
              {h % 4 === 0 ? `${h}:00` : ""}
            </div>
          ))}
        </div>
        {/* Grid */}
        {DAYS_AR.map((day, d) => (
          <div key={d} className="flex items-center gap-0.5 mb-0.5">
            <div className="w-16 text-[11px] text-muted-foreground shrink-0 text-left pl-1">{day}</div>
            {Array.from({ length: 24 }, (_, h) => {
              const val = map[`${d}-${h}`] ?? 0;
              return (
                <div
                  key={h}
                  title={`${day} ${h}:00 — ${val} زيارة`}
                  className={`flex-1 h-5 rounded-sm ${cellColor(val)} transition-all`}
                />
              );
            })}
          </div>
        ))}
        <div className="flex items-center gap-2 mt-3 justify-end text-[10px] text-muted-foreground">
          <span>أقل</span>
          {["bg-muted/40", "bg-blue-200", "bg-blue-300", "bg-blue-400", "bg-blue-500", "bg-blue-600"].map((c, i) => (
            <div key={i} className={`w-4 h-4 rounded-sm ${c}`} />
          ))}
          <span>أكثر</span>
        </div>
      </div>
    </div>
  );
}

// ── Activity feed item ───────────────────────────────────────────────────────
function ActivityRow({ item }: { item: ActivityItem }) {
  const isVisit = item.type === "visit";
  const icon = isVisit ? "🌐"
    : item.type === "event" && item.eventType === "whatsapp_click"   ? "💬"
    : item.type === "event" && item.eventType === "account_url_click"? "🔗"
    : item.type === "event" && item.eventType === "page_view"        ? "👁️"
    : "📌";

  const label = isVisit
    ? `زيارة: ${pageLabel(item.page)}`
    : item.type === "event" && item.eventType === "whatsapp_click"    ? `واتساب${item.accountName ? ` ← ${item.accountName}` : ""}`
    : item.type === "event" && item.eventType === "account_url_click" ? `زيارة الحساب${item.accountName ? ` ← ${item.accountName}` : ""}`
    : item.type === "event" && item.eventType === "page_view"         ? `فتح حساب${item.accountName ? `: ${item.accountName}` : ""}`
    : item.type === "event" ? item.eventType : "";

  const sub = isVisit
    ? `${item.device} · ${item.source}`
    : "";

  return (
    <div className="flex items-start gap-3 py-2.5 border-b last:border-0">
      <span className="text-base mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-none">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{formatRelTime(item.timestamp)}</span>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function AdminStats() {
  // ── Time range state ──
  const [timeRange, setTimeRange] = useState<"today" | "7d" | "30d" | "custom">("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo]   = useState("");

  // ── Table state ──
  const [platformFilter, setPlatformFilter] = useState("all");
  const [search, setSearch]   = useState("");
  const [sortBy, setSortBy]   = useState<SortKey>("pageViews");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [tablePage, setTablePage] = useState(1);
  const PAGE_SIZE = 10;

  // ── Data state ──
  const [advanced, setAdvanced]     = useState<AdvancedData | null>(null);
  const [advLoading, setAdvLoading] = useState(true);
  const [engagement, setEngagement] = useState<EngagementRow[]>([]);
  const [engLoading, setEngLoading] = useState(true);
  const [adminDetail, setAdminDetail] = useState<AdminDetailData | null>(null);
  const [selectedId, setSelectedId]   = useState<number | null>(null);
  const [detail, setDetail]           = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedJourney, setExpandedJourney] = useState<string | null>(null);

  // ── Computed from/to ──
  const { from, to } = useMemo(
    () => getFromTo(timeRange, customFrom, customTo),
    [timeRange, customFrom, customTo],
  );

  // ── Site overview (auto-refreshed by hook) ──
  const { data: siteOverview, isLoading: siteLoading, refetch: refetchSite } = useGetSiteOverview();

  // ── Fetch advanced ──
  const fetchAdvanced = useCallback(() => {
    setAdvLoading(true);
    const params = new URLSearchParams({
      from:     from,
      to:       to,
      platform: platformFilter,
    });
    fetch(`${BASE}/api/stats/advanced?${params}`, { headers: authHeader() })
      .then(r => r.json() as Promise<AdvancedData>)
      .then(d => { setAdvanced(d); setAdvLoading(false); })
      .catch(() => setAdvLoading(false));
  }, [from, to, platformFilter]);

  // ── Fetch engagement ──
  const fetchEngagement = useCallback(() => {
    setEngLoading(true);
    const params = new URLSearchParams({
      from:     from,
      to:       to,
      platform: platformFilter,
    });
    fetch(`${BASE}/api/stats/accounts-engagement?${params}`, { headers: authHeader() })
      .then(r => r.json() as Promise<EngagementRow[]>)
      .then(d => { setEngagement(d); setEngLoading(false); })
      .catch(() => setEngLoading(false));
  }, [from, to, platformFilter]);

  // ── Fetch admin detail (top lists) ──
  const fetchAdminDetail = useCallback(() => {
    const params = new URLSearchParams({
      from:     from,
      to:       to,
      platform: platformFilter,
    });
    fetch(`${BASE}/api/stats/admin-detail?${params}`, { headers: authHeader() })
      .then(r => r.json() as Promise<AdminDetailData>)
      .then(setAdminDetail)
      .catch(() => {});
  }, [from, to, platformFilter]);

  // ── Initial + refresh every 30s ──
  useEffect(() => {
    fetchAdvanced();
    fetchEngagement();
    fetchAdminDetail();
    const id = setInterval(() => {
      void refetchSite();
      fetchAdvanced();
      fetchAdminDetail();
    }, 30_000);
    return () => clearInterval(id);
  }, [fetchAdvanced, fetchEngagement, fetchAdminDetail, refetchSite]);

  // ── Account detail ──
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    setDetailLoading(true);
    fetch(`${BASE}/api/stats/account/${selectedId}/details`, { headers: authHeader() })
      .then(r => r.json() as Promise<DetailData>)
      .then(d => { setDetail(d); setDetailLoading(false); })
      .catch(() => setDetailLoading(false));
  }, [selectedId]);

  // ── Summary card values (all from advanced, filtered by from/to/platform) ──
  const visitsInRange  = advanced?.visitCount      ?? 0;
  const uniqueInRange  = advanced?.uniqueVisitors  ?? 0;
  const pvInRange      = advanced?.pageViews        ?? 0;
  const waInRange      = advanced?.waClicks         ?? 0;
  const urlInRange     = advanced?.urlClicks        ?? 0;
  const convRate       = pvInRange > 0 ? Math.round(((waInRange + urlInRange) / pvInRange) * 100) : 0;

  // ── Table filtering / sorting / pagination (platform already filtered server-side) ──
  const filteredRows = useMemo(() => {
    let rows = [...engagement];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(r => r.name.toLowerCase().includes(q));
    }
    rows.sort((a, b) => {
      let av: string | number = a[sortBy as keyof EngagementRow] as string | number;
      let bv: string | number = b[sortBy as keyof EngagementRow] as string | number;
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return rows;
  }, [engagement, search, sortBy, sortDir]);

  const totalPages  = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows   = filteredRows.slice((tablePage - 1) * PAGE_SIZE, tablePage * PAGE_SIZE);

  function handleSort(col: SortKey) {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
    setTablePage(1);
  }

  const selectedAcc = engagement.find(r => r.id === selectedId) ?? null;

  // ── Active now pulse ──
  const activeNow = siteOverview?.activeNow ?? 0;

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    timerRef.current = setInterval(() => forceUpdate(n => n + 1), 10_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <AdminLayout>
      <div className="space-y-8 max-w-6xl mx-auto">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <BarChart2 className="w-6 h-6 text-primary" />
              لوحة الإحصائيات
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">تحليلات حقيقية · تتحدث تلقائياً كل 30 ثانية</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              {activeNow} متصل الآن
            </span>
            <button
              onClick={() => { fetchAdvanced(); fetchAdminDetail(); fetchEngagement(); void refetchSite(); }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border rounded-lg px-3 py-1.5 transition-colors hover:bg-muted/40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${advLoading ? "animate-spin" : ""}`} />
              تحديث
            </button>
          </div>
        </div>

        {/* ── Filter Bar ──────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3 p-4 bg-card border rounded-2xl shadow-sm">
          <span className="text-sm font-bold text-muted-foreground">الفترة:</span>
          {(["today", "7d", "30d", "custom"] as const).map(r => (
            <button
              key={r}
              onClick={() => { setTimeRange(r); setTablePage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                timeRange === r
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 hover:bg-muted text-muted-foreground"
              }`}
            >
              {r === "today" ? "اليوم" : r === "7d" ? "7 أيام" : r === "30d" ? "30 يوم" : "مخصص"}
            </button>
          ))}
          {timeRange === "custom" && (
            <>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="border rounded-lg px-2 py-1 text-sm bg-background" />
              <span className="text-muted-foreground text-sm">←</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="border rounded-lg px-2 py-1 text-sm bg-background" />
            </>
          )}
          <div className="h-5 w-px bg-border mx-1 hidden sm:block" />
          <span className="text-sm font-bold text-muted-foreground">المنصة:</span>
          {[
            { v: "all", label: "الكل" },
            { v: "tiktok", label: "تيك توك" },
            { v: "tiktok_monetized", label: "أرباح" },
            { v: "instagram", label: "إنستغرام" },
            { v: "facebook", label: "فيسبوك" },
          ].map(({ v, label }) => (
            <button
              key={v}
              onClick={() => { setPlatformFilter(v); setTablePage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                platformFilter === v
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 hover:bg-muted text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Summary Cards ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <SummaryCard icon={<Globe className="w-5 h-5" />}        label="إجمالي الزيارات"        value={advLoading ? "…" : visitsInRange}        color="text-blue-600"    bg="bg-blue-500/5 border-blue-500/20" />
          <SummaryCard icon={<Users2 className="w-5 h-5" />}       label="زوار فريدون"            value={advLoading ? "…" : uniqueInRange}        color="text-violet-600"  bg="bg-violet-500/5 border-violet-500/20" />
          <SummaryCard icon={<Eye className="w-5 h-5" />}          label="فتح صفحات الحسابات"     value={advLoading ? "…" : pvInRange}            color="text-sky-600"     bg="bg-sky-500/5 border-sky-500/20" />
          <SummaryCard icon={<Phone className="w-5 h-5" />}        label="نقرات واتساب"           value={advLoading ? "…" : waInRange}            color="text-green-600"   bg="bg-green-500/5 border-green-500/20" />
          <SummaryCard icon={<ExternalLink className="w-5 h-5" />} label="زيارات الحساب"          value={advLoading ? "…" : urlInRange}           color="text-purple-600"  bg="bg-purple-500/5 border-purple-500/20" />
          <SummaryCard icon={<TrendingUp className="w-5 h-5" />}   label="معدل التحويل"           value={advLoading ? "…" : `${convRate}%`}       color="text-orange-600"  bg="bg-orange-500/5 border-orange-500/20" sub="(واتساب + زيارة) / فتح حساب" />
          <SummaryCard icon={<BarChart3 className="w-5 h-5" />}    label="متوسط صفحات/جلسة"      value={advLoading ? "…" : (advanced?.avgSessionPages ?? 0)} color="text-teal-600" bg="bg-teal-500/5 border-teal-500/20" />
          <SummaryCard icon={<Zap className="w-5 h-5" />}          label="نشطون الآن"             value={siteLoading ? "…" : activeNow}           color="text-emerald-600" bg="bg-emerald-500/5 border-emerald-500/20" sub="آخر 5 دقائق" />
        </div>

        {/* ── Daily + Hourly Charts ────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Daily */}
          <div className="lg:col-span-3 bg-card border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-semibold">الزيارات اليومية — الفترة المحددة</span>
            </div>
            {advLoading ? <Skeleton className="h-44 w-full rounded-lg" /> :
            (advanced?.dailyChart ?? []).length === 0 ? (
              <p className="text-center text-muted-foreground text-sm h-44 flex items-center justify-center">لا توجد بيانات للفترة المحددة</p>
            ) : (
              <ResponsiveContainer width="100%" height={176}>
                <AreaChart data={advanced?.dailyChart ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                  <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fontSize: 10, fill: "currentColor" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: "currentColor" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <ReTooltip contentStyle={{ fontSize: 12, borderRadius: 8, direction: "rtl" }} formatter={(v: number) => [v.toLocaleString("ar-EG"), "زيارة"]} labelFormatter={formatDateShort} />
                  <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fill="url(#vg)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Hourly */}
          <div className="lg:col-span-2 bg-card border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-violet-500" />
              <span className="text-sm font-semibold">توزيع الزيارات بالساعة</span>
            </div>
            {advLoading ? <Skeleton className="h-44 w-full rounded-lg" /> : (
              <ResponsiveContainer width="100%" height={176}>
                <BarChart data={advanced?.hourlyChart ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                  <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "currentColor" }} tickLine={false} axisLine={false}
                    tickFormatter={h => h % 6 === 0 ? `${h}:00` : ""} />
                  <YAxis tick={{ fontSize: 9, fill: "currentColor" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <ReTooltip contentStyle={{ fontSize: 12, borderRadius: 8, direction: "rtl" }}
                    formatter={(v: number) => [v.toLocaleString("ar-EG"), "زيارة"]}
                    labelFormatter={(h: number) => `الساعة ${h}:00`} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[3, 3, 0, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Heatmap ─────────────────────────────────────────────────── */}
        <div className="bg-card border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-semibold">خريطة النشاط — أيام وساعات</span>
          </div>
          {advLoading ? <Skeleton className="h-36 w-full rounded-lg" /> : (
            <Heatmap data={advanced?.heatmap ?? []} />
          )}
        </div>

        {/* ── Sources / Devices / Browsers ────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Sources */}
          <Panel title="مصادر الزيارات" icon={<Globe className="w-4 h-4" />}>
            {advLoading ? <Skeleton className="h-32 w-full" /> : (
              <div className="space-y-2">
                {(advanced?.sources ?? []).slice(0, 8).map(s => (
                  <div key={s.source}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="font-medium">{s.source}</span>
                    </div>
                    <MiniBar value={s.count} max={advanced?.sources[0]?.count ?? 1} color="bg-blue-500" />
                  </div>
                ))}
                {!advanced?.sources.length && <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات</p>}
              </div>
            )}
          </Panel>

          {/* Devices */}
          <Panel title="توزيع الأجهزة" icon={<Smartphone className="w-4 h-4" />}>
            {advLoading ? <Skeleton className="h-32 w-full" /> : (
              <div className="space-y-3">
                {(advanced?.devices ?? []).map(d => {
                  const Icon = d.type === "هاتف" ? Smartphone : d.type === "لوحي" ? Tablet : Monitor;
                  const total = (advanced?.devices ?? []).reduce((s, x) => s + x.count, 0);
                  const pct   = total > 0 ? Math.round((d.count / total) * 100) : 0;
                  return (
                    <div key={d.type} className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="font-medium">{d.type}</span>
                          <span className="text-muted-foreground">{pct}%</span>
                        </div>
                        <MiniBar value={d.count} max={advanced?.devices[0]?.count ?? 1} color="bg-violet-500" />
                      </div>
                    </div>
                  );
                })}
                {!advanced?.devices.length && <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات</p>}
              </div>
            )}
          </Panel>

          {/* Browsers */}
          <Panel title="المتصفحات" icon={<MousePointer2 className="w-4 h-4" />}>
            {advLoading ? <Skeleton className="h-32 w-full" /> : (
              <div className="space-y-2">
                {(advanced?.browsers ?? []).slice(0, 6).map(b => (
                  <div key={b.name}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="font-medium">{b.name}</span>
                    </div>
                    <MiniBar value={b.count} max={advanced?.browsers[0]?.count ?? 1} color="bg-teal-500" />
                  </div>
                ))}
                {!advanced?.browsers.length && <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات</p>}
              </div>
            )}
          </Panel>
        </div>

        {/* ── Platform + Buttons ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Panel title="أكثر المنصات مشاهدة" icon={<SiTiktok className="w-4 h-4" />}>
            {advLoading ? <Skeleton className="h-24 w-full" /> : (
              <div className="space-y-2">
                {(advanced?.platforms ?? []).map(p => (
                  <div key={p.platform} className="flex items-center gap-3">
                    <span className="text-muted-foreground shrink-0">{PLT_ICON[p.platform] ?? <SiTiktok className="w-3.5 h-3.5" />}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="font-medium">{platformAr(p.platform)}</span>
                      </div>
                      <MiniBar value={p.count} max={advanced?.platforms[0]?.count ?? 1} color="bg-pink-500" />
                    </div>
                  </div>
                ))}
                {!advanced?.platforms.length && <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات بعد</p>}
              </div>
            )}
          </Panel>

          <Panel title="أكثر الأزرار استخداماً" icon={<MousePointer2 className="w-4 h-4" />}>
            {advLoading ? <Skeleton className="h-24 w-full" /> : (
              <div className="space-y-2">
                {(advanced?.buttonClicks ?? []).map(b => (
                  <div key={b.button}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="font-medium">{b.label}</span>
                    </div>
                    <MiniBar value={b.count} max={advanced?.buttonClicks[0]?.count ?? 1} color="bg-orange-500" />
                  </div>
                ))}
                {!advanced?.buttonClicks.length && <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات بعد</p>}
              </div>
            )}
          </Panel>
        </div>

        {/* ── Top Lists ───────────────────────────────────────────────── */}
        <div>
          <h2 className="text-base font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> أكثر الحسابات تفاعلاً
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TopList title="أكثر مشاهدة"          icon={<Eye className="w-4 h-4" />}          items={adminDetail?.topByPageViews ?? []}       emptyMsg="لا توجد بيانات" onSelect={setSelectedId} />
            <TopList title="أكثر نقرات واتساب"    icon={<Phone className="w-4 h-4" />}         items={adminDetail?.topByWhatsapp ?? []}         emptyMsg="لا توجد بيانات" onSelect={setSelectedId} />
            <TopList title="أكثر نقرات زيارة"    icon={<ExternalLink className="w-4 h-4" />}  items={adminDetail?.topByAccountUrlClick ?? []}  emptyMsg="لا توجد بيانات" onSelect={setSelectedId} />
          </div>
        </div>

        {/* ── Top Pages ───────────────────────────────────────────────── */}
        <Panel title="أكثر الصفحات زيارة" icon={<Eye className="w-4 h-4" />}>
          {advLoading ? <Skeleton className="h-24 w-full" /> : (
            <div className="space-y-2">
              {(advanced?.topPages ?? []).slice(0, 8).map(p => (
                <div key={p.page} className="flex items-center gap-3 text-xs">
                  <span className="flex-1 min-w-0 font-medium truncate">{pageLabel(p.page)}</span>
                  <MiniBar value={p.count} max={advanced!.topPages[0]?.count ?? 1} color="bg-blue-400" />
                </div>
              ))}
              {!(advanced?.topPages?.length) && <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات للفترة المحددة</p>}
            </div>
          )}
        </Panel>

        {/* ── Account Engagement Table ─────────────────────────────────── */}
        <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-bold text-sm">تفاعل الحسابات</h3>
              <Badge variant="secondary">{filteredRows.length}</Badge>
            </div>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setTablePage(1); }}
                placeholder="بحث عن حساب…"
                className="border rounded-lg pr-9 pl-3 py-1.5 text-sm bg-background w-48 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {engLoading ? (
            <div className="p-5 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                    <th className="text-right px-4 py-3 font-semibold">الحساب</th>
                    {([
                      { key: "pageViews",      label: "مشاهدات" },
                      { key: "whatsappClicks", label: "واتساب" },
                      { key: "urlClicks",      label: "زيارة الحساب" },
                      { key: "conversionRate", label: "تحويل %" },
                      { key: "followers",      label: "متابعون" },
                    ] as { key: SortKey; label: string }[]).map(col => (
                      <th key={col.key} className="text-center px-3 py-3 font-semibold cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort(col.key)}>
                        <div className="flex items-center justify-center gap-1">
                          {col.label}
                          <SortIcon active={sortBy === col.key} dir={sortDir} />
                        </div>
                      </th>
                    ))}
                    <th className="text-center px-3 py-3 font-semibold">آخر نشاط</th>
                    <th className="text-center px-3 py-3 font-semibold">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pagedRows.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">لا توجد نتائج</td></tr>
                  ) : pagedRows.map(row => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedId(row.id)}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {row.imageUrl
                            ? <img src={row.imageUrl} alt="" className="w-7 h-7 rounded object-cover border shrink-0" />
                            : <div className="w-7 h-7 rounded bg-muted flex items-center justify-center shrink-0 text-muted-foreground">{PLT_ICON[row.platform]}</div>
                          }
                          <div className="min-w-0">
                            <p className="font-semibold text-xs truncate max-w-[120px]" dir="ltr">{row.name}</p>
                            <p className="text-[10px] text-muted-foreground">{platformAr(row.platform)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-center px-3 py-3 font-black text-blue-600">{row.pageViews.toLocaleString("ar-EG")}</td>
                      <td className="text-center px-3 py-3 font-black text-green-600">{row.whatsappClicks.toLocaleString("ar-EG")}</td>
                      <td className="text-center px-3 py-3 font-black text-purple-600">{row.urlClicks.toLocaleString("ar-EG")}</td>
                      <td className="text-center px-3 py-3">
                        <span className={`font-bold text-xs ${row.conversionRate > 20 ? "text-green-600" : row.conversionRate > 5 ? "text-yellow-600" : "text-muted-foreground"}`}>
                          {row.conversionRate}%
                        </span>
                      </td>
                      <td className="text-center px-3 py-3 text-xs text-muted-foreground">
                        {(row.followers >= 1_000_000 ? `${(row.followers / 1_000_000).toFixed(1)}M` : row.followers >= 1000 ? `${Math.round(row.followers / 1000)}K` : String(row.followers))}
                      </td>
                      <td className="text-center px-3 py-3 text-[10px] text-muted-foreground">
                        {row.lastActivity ? formatRelTime(row.lastActivity) : "—"}
                      </td>
                      <td className="text-center px-3 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${row.status === "available" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}>
                          {row.status === "available" ? "متاح" : "مباع"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t bg-muted/10">
              <span className="text-xs text-muted-foreground">
                {(tablePage - 1) * PAGE_SIZE + 1}–{Math.min(tablePage * PAGE_SIZE, filteredRows.length)} من {filteredRows.length}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setTablePage(p => Math.max(1, p - 1))} disabled={tablePage === 1}
                  className="p-1.5 rounded border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="text-xs px-2 font-medium">{tablePage} / {totalPages}</span>
                <button onClick={() => setTablePage(p => Math.min(totalPages, p + 1))} disabled={tablePage === totalPages}
                  className="p-1.5 rounded border text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── User Journeys ────────────────────────────────────────────── */}
        <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b bg-muted/30">
            <Route className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-bold text-sm">مسار المستخدم — آخر الجلسات</h3>
          </div>
          <div className="divide-y">
            {advLoading ? (
              <div className="p-5 space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded" />)}</div>
            ) : !(advanced?.journeys?.length) ? (
              <p className="text-center text-muted-foreground text-sm py-8">لا توجد جلسات مسجّلة بعد</p>
            ) : (advanced.journeys as JourneyItem[]).map((j, i) => (
              <div key={i} className="px-5 py-3">
                <button
                  onClick={() => setExpandedJourney(expandedJourney === j.sessionId ? null : j.sessionId)}
                  className="w-full flex items-center justify-between gap-3 text-right"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded shrink-0">{j.sessionId}</span>
                    <span className="text-xs text-muted-foreground">{j.device} · {j.source} · {j.pageCount} صفحة</span>
                    <span className="text-[10px] text-muted-foreground">{formatRelTime(j.startTime)}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${expandedJourney === j.sessionId ? "rotate-180" : ""}`} />
                </button>
                {expandedJourney === j.sessionId && (
                  <div className="mt-3 flex items-center gap-0 flex-wrap">
                    {j.pages.map((p, pi) => (
                      <div key={pi} className="flex items-center gap-0">
                        <span className="text-[11px] bg-primary/10 text-primary px-2 py-1 rounded-lg font-medium">{pageLabel(p.page)}</span>
                        {pi < j.pages.length - 1 && <ChevronLeft className="w-3 h-3 text-muted-foreground mx-1" />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Activity Feed ────────────────────────────────────────────── */}
        <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b bg-muted/30">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <h3 className="font-bold text-sm">آخر النشاطات — Real-Time</h3>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto px-5">
            {advLoading ? (
              <div className="py-5 space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded" />)}</div>
            ) : !(advanced?.recentActivity?.length) ? (
              <p className="text-center text-muted-foreground text-sm py-8">لا توجد نشاطات بعد</p>
            ) : (advanced.recentActivity as ActivityItem[]).map(item => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </div>
        </div>

      </div>

      {/* ── Account Detail Modal ─────────────────────────────────────── */}
      <Dialog open={!!selectedId} onOpenChange={open => { if (!open) setSelectedId(null); }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAcc && (
                <>
                  {selectedAcc.imageUrl
                    ? <img src={selectedAcc.imageUrl} alt="" className="w-8 h-8 rounded-lg object-cover border" />
                    : <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">{PLT_ICON[selectedAcc.platform]}</div>
                  }
                  <div>
                    <p className="font-bold text-sm leading-none" dir="ltr">{selectedAcc.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{platformAr(selectedAcc.platform)}</p>
                  </div>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-3 py-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded" />)}</div>
          ) : detail ? (
            <div className="space-y-4">
              {/* Stat cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-blue-600">{detail.pageViews.toLocaleString("ar-EG")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">مشاهدة</p>
                </div>
                <div className="bg-violet-500/8 border border-violet-500/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-violet-600">{detail.uniqueVisitors.toLocaleString("ar-EG")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">زائر فريد</p>
                </div>
                <div className="bg-green-500/8 border border-green-500/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-green-600">{detail.whatsappClicks.toLocaleString("ar-EG")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">نقرة واتساب</p>
                </div>
                <div className="bg-purple-500/8 border border-purple-500/20 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black text-purple-600">{detail.urlClicks.toLocaleString("ar-EG")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">زيارة الحساب</p>
                </div>
              </div>

              <div className="flex items-center justify-between px-4 py-3 bg-muted/40 rounded-xl text-sm">
                <span className="text-muted-foreground">معدل التحويل</span>
                <span className="font-black text-lg">{detail.conversionRate}%</span>
              </div>
              {detail.lastSeen && (
                <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground border rounded-xl">
                  <span>آخر زيارة</span>
                  <span>{formatRelTime(detail.lastSeen)}</span>
                </div>
              )}

              {/* Mini daily chart */}
              {detail.dailyChart.some(d => d.views > 0 || d.clicks > 0) && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">النشاط اليومي — آخر 30 يوم</p>
                  <ResponsiveContainer width="100%" height={100}>
                    <BarChart data={detail.dailyChart} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                      <XAxis dataKey="date" hide />
                      <YAxis tick={{ fontSize: 8 }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <ReTooltip contentStyle={{ fontSize: 10, borderRadius: 6 }}
                        formatter={(v: number, n: string) => [v, n === "views" ? "مشاهدة" : "نقرة"]}
                        labelFormatter={formatDateShort} />
                      <Legend formatter={(n: string) => n === "views" ? "مشاهدات" : "نقرات"} wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="views"  fill="#3b82f6" radius={[2, 2, 0, 0]} maxBarSize={12} />
                      <Bar dataKey="clicks" fill="#8b5cf6" radius={[2, 2, 0, 0]} maxBarSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
