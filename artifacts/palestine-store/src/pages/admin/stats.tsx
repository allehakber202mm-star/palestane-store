import { AdminLayout } from "@/components/layout/AdminLayout";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Eye, Phone, ExternalLink, BarChart2, Globe,
  Users2, TrendingUp, BarChart3, Search, ArrowUpDown,
  ChevronUp, ChevronDown, ChevronRight, ChevronLeft,
  Zap, RefreshCw, Calendar,
} from "lucide-react";
import { SiTiktok, SiInstagram, SiFacebook, SiSnapchat } from "react-icons/si";
import {
  BarChart, Bar, XAxis, YAxis,
  Tooltip as ReTooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useGetSiteOverview } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Auth header ───────────────────────────────────────────────────────────────
function authHeader() {
  const token = localStorage.getItem("admin_token") ?? "";
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

// ── Date helpers ──────────────────────────────────────────────────────────────
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

// ── Platform helpers ──────────────────────────────────────────────────────────
const PLT_ICON: Record<string, React.ReactNode> = {
  tiktok:           <SiTiktok className="w-3.5 h-3.5" />,
  tiktok_monetized: <SiTiktok className="w-3.5 h-3.5 text-green-600" />,
  instagram:        <SiInstagram className="w-3.5 h-3.5 text-pink-500" />,
  facebook:         <SiFacebook className="w-3.5 h-3.5 text-blue-500" />,
  snapchat:         <SiSnapchat className="w-3.5 h-3.5 text-yellow-500" />,
};
function platformAr(p: string) {
  if (p === "tiktok_monetized") return "تيك توك أرباح";
  if (p === "tiktok")    return "تيك توك";
  if (p === "instagram") return "إنستغرام";
  if (p === "facebook")  return "فيسبوك";
  return p;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type AdvancedData = {
  visitCount:      number;
  uniqueVisitors:  number;
  pageViews:       number;
  waClicks:        number;
  urlClicks:       number;
  avgSessionPages: number;
  platforms:       { platform: string; count: number }[];
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
  topByPageViews:       TopItem[];
  topByWhatsapp:        TopItem[];
  topByAccountUrlClick: TopItem[];
};

type PeriodStats = { siteVisits: number; pageViews: number; urlClicks: number; waClicks: number };
type PlatformSummaryRow = {
  platform: string;
  accounts: number;
  today: PeriodStats;
  week:  PeriodStats;
  month: PeriodStats;
};

// ── Sub-components ────────────────────────────────────────────────────────────
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminStats() {
  // ── Time range ──
  const [timeRange, setTimeRange] = useState<"today" | "7d" | "30d" | "custom">("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo]   = useState("");

  // ── Platform + table ──
  const [platformFilter, setPlatformFilter] = useState("all");
  const [search, setSearch]   = useState("");
  const [sortBy, setSortBy]   = useState<SortKey>("pageViews");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [tablePage, setTablePage] = useState(1);
  const PAGE_SIZE = 10;

  // ── Data ──
  const [advanced, setAdvanced]     = useState<AdvancedData | null>(null);
  const [advLoading, setAdvLoading] = useState(true);
  const [engagement, setEngagement] = useState<EngagementRow[]>([]);
  const [engLoading, setEngLoading] = useState(true);
  const [adminDetail, setAdminDetail] = useState<AdminDetailData | null>(null);
  const [selectedId, setSelectedId]   = useState<number | null>(null);
  const [detail, setDetail]           = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [platformSummary, setPlatformSummary] = useState<PlatformSummaryRow[]>([]);
  const [pltLoading, setPltLoading] = useState(true);

  // ── Computed from/to ──
  const { from, to } = useMemo(
    () => getFromTo(timeRange, customFrom, customTo),
    [timeRange, customFrom, customTo],
  );

  // ── Site overview (activeNow only) ──
  const { data: siteOverview, isLoading: siteLoading, refetch: refetchSite } = useGetSiteOverview();

  // ── Fetch advanced ──
  const fetchAdvanced = useCallback(() => {
    setAdvLoading(true);
    const params = new URLSearchParams({ from, to, platform: platformFilter });
    fetch(`${BASE}/api/stats/advanced?${params}`, { headers: authHeader() })
      .then(r => r.json() as Promise<AdvancedData>)
      .then(d => { setAdvanced(d); setAdvLoading(false); })
      .catch(() => setAdvLoading(false));
  }, [from, to, platformFilter]);

  // ── Fetch engagement ──
  const fetchEngagement = useCallback(() => {
    setEngLoading(true);
    const params = new URLSearchParams({ from, to, platform: platformFilter });
    fetch(`${BASE}/api/stats/accounts-engagement?${params}`, { headers: authHeader() })
      .then(r => r.json() as Promise<EngagementRow[]>)
      .then(d => { setEngagement(d); setEngLoading(false); })
      .catch(() => setEngLoading(false));
  }, [from, to, platformFilter]);

  // ── Fetch top lists ──
  const fetchAdminDetail = useCallback(() => {
    const params = new URLSearchParams({ from, to, platform: platformFilter });
    fetch(`${BASE}/api/stats/admin-detail?${params}`, { headers: authHeader() })
      .then(r => r.json() as Promise<AdminDetailData>)
      .then(setAdminDetail)
      .catch(() => {});
  }, [from, to, platformFilter]);

  // ── Fetch platform summary ──
  const fetchPlatformSummary = useCallback(() => {
    setPltLoading(true);
    fetch(`${BASE}/api/stats/platform-summary`, { headers: authHeader() })
      .then(r => r.json() as Promise<PlatformSummaryRow[]>)
      .then(d => { setPlatformSummary(d); setPltLoading(false); })
      .catch(() => setPltLoading(false));
  }, []);

  // ── Initial load + auto-refresh 30s ──
  useEffect(() => {
    fetchAdvanced();
    fetchEngagement();
    fetchAdminDetail();
    fetchPlatformSummary();
    const id = setInterval(() => {
      void refetchSite();
      fetchAdvanced();
      fetchAdminDetail();
      fetchPlatformSummary();
    }, 30_000);
    return () => clearInterval(id);
  }, [fetchAdvanced, fetchEngagement, fetchAdminDetail, fetchPlatformSummary, refetchSite]);

  // ── Account detail modal ──
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    setDetailLoading(true);
    fetch(`${BASE}/api/stats/account/${selectedId}/details`, { headers: authHeader() })
      .then(r => r.json() as Promise<DetailData>)
      .then(d => { setDetail(d); setDetailLoading(false); })
      .catch(() => setDetailLoading(false));
  }, [selectedId]);

  // ── Summary values ──
  const visitsInRange  = advanced?.visitCount      ?? 0;
  const uniqueInRange  = advanced?.uniqueVisitors  ?? 0;
  const pvInRange      = advanced?.pageViews        ?? 0;
  const waInRange      = advanced?.waClicks         ?? 0;
  const urlInRange     = advanced?.urlClicks        ?? 0;
  const convRate       = pvInRange > 0 ? Math.round(((waInRange + urlInRange) / pvInRange) * 100) : 0;
  const activeNow      = siteOverview?.activeNow ?? 0;

  // ── Table ──
  const filteredRows = useMemo(() => {
    let rows = [...engagement];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(r => r.name.toLowerCase().includes(q));
    }
    rows.sort((a, b) => {
      const av = a[sortBy as keyof EngagementRow] as string | number;
      const bv = b[sortBy as keyof EngagementRow] as string | number;
      if (typeof av === "string" && typeof bv === "string")
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return rows;
  }, [engagement, search, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows  = filteredRows.slice((tablePage - 1) * PAGE_SIZE, tablePage * PAGE_SIZE);

  function handleSort(col: SortKey) {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
    setTablePage(1);
  }

  const selectedAcc = engagement.find(r => r.id === selectedId) ?? null;

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
                timeRange === r ? "bg-primary text-primary-foreground" : "bg-muted/60 hover:bg-muted text-muted-foreground"
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
                platformFilter === v ? "bg-primary text-primary-foreground" : "bg-muted/60 hover:bg-muted text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Summary Cards ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <SummaryCard icon={<Globe className="w-5 h-5" />}        label="إجمالي الزيارات"       value={advLoading ? "…" : visitsInRange}        color="text-blue-600"    bg="bg-blue-500/5 border-blue-500/20" />
          <SummaryCard icon={<Users2 className="w-5 h-5" />}       label="زوار فريدون"           value={advLoading ? "…" : uniqueInRange}        color="text-violet-600"  bg="bg-violet-500/5 border-violet-500/20" />
          <SummaryCard icon={<Eye className="w-5 h-5" />}          label="فتح صفحات الحسابات"    value={advLoading ? "…" : pvInRange}            color="text-sky-600"     bg="bg-sky-500/5 border-sky-500/20" />
          <SummaryCard icon={<Phone className="w-5 h-5" />}        label="نقرات واتساب"          value={advLoading ? "…" : waInRange}            color="text-green-600"   bg="bg-green-500/5 border-green-500/20" />
          <SummaryCard icon={<ExternalLink className="w-5 h-5" />} label="زيارات الحساب"         value={advLoading ? "…" : urlInRange}           color="text-purple-600"  bg="bg-purple-500/5 border-purple-500/20" />
          <SummaryCard icon={<TrendingUp className="w-5 h-5" />}   label="معدل التحويل"          value={advLoading ? "…" : `${convRate}%`}       color="text-orange-600"  bg="bg-orange-500/5 border-orange-500/20" sub="(واتساب + زيارة) / فتح حساب" />
          <SummaryCard icon={<BarChart3 className="w-5 h-5" />}    label="متوسط صفحات/جلسة"     value={advLoading ? "…" : (advanced?.avgSessionPages ?? 0)} color="text-teal-600" bg="bg-teal-500/5 border-teal-500/20" />
          <SummaryCard icon={<Zap className="w-5 h-5" />}          label="نشطون الآن"            value={siteLoading ? "…" : activeNow}           color="text-emerald-600" bg="bg-emerald-500/5 border-emerald-500/20" sub="آخر 5 دقائق" />
        </div>

        {/* ── Platform Summary: Today / Week / Month ──────────────────── */}
        <div>
          <h2 className="text-base font-bold mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> إحصاءات كل منصة — اليوم / الأسبوع / الشهر
          </h2>
          {pltLoading ? (
            <div className="grid grid-cols-1 gap-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {platformSummary.map(row => {
                const PLT_COLOR: Record<string, { bg: string; border: string; text: string; bar: string }> = {
                  tiktok:           { bg: "bg-slate-500/5",  border: "border-slate-500/20",  text: "text-slate-700 dark:text-slate-300",  bar: "bg-slate-500" },
                  tiktok_monetized: { bg: "bg-green-500/5",  border: "border-green-500/20",  text: "text-green-700 dark:text-green-400",  bar: "bg-green-500" },
                  instagram:        { bg: "bg-pink-500/5",   border: "border-pink-500/20",   text: "text-pink-700 dark:text-pink-400",    bar: "bg-pink-500"  },
                  facebook:         { bg: "bg-blue-500/5",   border: "border-blue-500/20",   text: "text-blue-700 dark:text-blue-400",    bar: "bg-blue-500"  },
                  snapchat:         { bg: "bg-yellow-500/5", border: "border-yellow-500/20", text: "text-yellow-700 dark:text-yellow-400", bar: "bg-yellow-500" },
                };
                const c = PLT_COLOR[row.platform] ?? PLT_COLOR.tiktok;
                const maxViews = Math.max(row.month.pageViews, 1);
                const maxClicks = Math.max(row.month.urlClicks + row.month.waClicks, 1);

                const Cell = ({ label, period }: { label: string; period: PeriodStats }) => (
                  <div className="flex flex-col items-center gap-0.5 text-center min-w-0">
                    <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
                    <span className="text-lg font-black leading-none">{period.pageViews.toLocaleString("ar-EG")}</span>
                    <span className="text-[10px] text-muted-foreground">مشاهدة</span>
                    <span className="text-xs font-bold text-purple-600 mt-0.5">{(period.urlClicks + period.waClicks).toLocaleString("ar-EG")} نقرة</span>
                  </div>
                );

                return (
                  <div key={row.platform} className={`${c.bg} ${c.border} border rounded-2xl p-4`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={c.text}>{PLT_ICON[row.platform] ?? <SiTiktok className="w-4 h-4" />}</span>
                        <span className={`font-bold text-sm ${c.text}`}>{platformAr(row.platform)}</span>
                        <span className="text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">{row.accounts} حساب</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-muted-foreground">الشهر: </span>
                        <span className="font-black text-sm">{row.month.pageViews.toLocaleString("ar-EG")}</span>
                        <span className="text-xs text-muted-foreground"> مشاهدة · </span>
                        <span className="font-bold text-xs text-purple-600">{(row.month.urlClicks + row.month.waClicks).toLocaleString("ar-EG")} نقرة</span>
                      </div>
                    </div>

                    {/* مقارنة اليوم/الأسبوع/الشهر */}
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <Cell label="اليوم" period={row.today} />
                      <Cell label="7 أيام" period={row.week} />
                      <Cell label="30 يوم" period={row.month} />
                    </div>

                    {/* شريط مرئي */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <Eye className="w-3 h-3" />
                        <span>مشاهدات</span>
                        <div className="flex-1 h-1.5 bg-muted/60 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${c.bar} opacity-70`}
                            style={{ width: `${Math.round((row.month.pageViews / maxViews) * 100)}%` }} />
                        </div>
                        <span className="font-bold w-6 text-left">{row.month.pageViews}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <ExternalLink className="w-3 h-3" />
                        <span>نقرات</span>
                        <div className="flex-1 h-1.5 bg-muted/60 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-purple-500 opacity-70"
                            style={{ width: `${Math.round(((row.month.urlClicks + row.month.waClicks) / maxClicks) * 100)}%` }} />
                        </div>
                        <span className="font-bold w-6 text-left">{row.month.urlClicks + row.month.waClicks}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Platform breakdown (existing — keeps the period-filtered view) ─ */}
        {platformFilter === "all" && (advanced?.platforms?.length ?? 0) > 0 && (
          <Panel title="أكثر المنصات مشاهدة (الفترة المحددة)" icon={<SiTiktok className="w-4 h-4" />}>
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
              </div>
            )}
          </Panel>
        )}

        {/* ── Top Lists ───────────────────────────────────────────────── */}
        <div>
          <h2 className="text-base font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> أكثر الحسابات تفاعلاً
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <TopList title="أكثر مشاهدة"       icon={<Eye className="w-4 h-4" />}          items={adminDetail?.topByPageViews ?? []}       emptyMsg="لا توجد بيانات" onSelect={setSelectedId} />
            <TopList title="أكثر نقرات واتساب"  icon={<Phone className="w-4 h-4" />}         items={adminDetail?.topByWhatsapp ?? []}         emptyMsg="لا توجد بيانات" onSelect={setSelectedId} />
            <TopList title="أكثر نقرات زيارة"  icon={<ExternalLink className="w-4 h-4" />}  items={adminDetail?.topByAccountUrlClick ?? []}  emptyMsg="لا توجد بيانات" onSelect={setSelectedId} />
          </div>
        </div>

        {/* ── Account Engagement Table ─────────────────────────────────── */}
        <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
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
                      <th
                        key={col.key}
                        className="text-center px-3 py-3 font-semibold cursor-pointer hover:text-foreground transition-colors"
                        onClick={() => handleSort(col.key)}
                      >
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
                        {row.followers >= 1_000_000
                          ? `${(row.followers / 1_000_000).toFixed(1)}M`
                          : row.followers >= 1000
                          ? `${Math.round(row.followers / 1000)}K`
                          : String(row.followers)}
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
