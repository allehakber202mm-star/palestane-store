import { AdminLayout } from "@/components/layout/AdminLayout";
import { useEffect, useState, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Eye, Phone, ExternalLink, BarChart2, Globe, Activity,
  Users2, Calendar, TrendingUp, BarChart3,
} from "lucide-react";
import { SiTiktok, SiInstagram, SiFacebook } from "react-icons/si";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer,
} from "recharts";
import { useGetSiteOverview } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Platform icons ─────────────────────────────────────────────────────────
const PLT_ICON: Record<string, React.ReactNode> = {
  tiktok:           <SiTiktok className="w-3.5 h-3.5" />,
  tiktok_monetized: <SiTiktok className="w-3.5 h-3.5 text-green-600" />,
  instagram:        <SiInstagram className="w-3.5 h-3.5 text-pink-500" />,
  facebook:         <SiFacebook className="w-3.5 h-3.5 text-blue-500" />,
};

// ── Page display names ─────────────────────────────────────────────────────
const PAGE_LABELS: Record<string, string> = {
  "/":              "🏠 الصفحة الرئيسية",
  "/accounts":      "📋 الحسابات",
  "/about":         "ℹ️ من نحن",
  "/feedback":      "💬 آراء العملاء",
  "/contact":       "📞 تواصل معنا",
  "/celebrity-ads": "🌟 إعلانات المشاهير",
};
function pageLabel(p: string): string {
  if (PAGE_LABELS[p]) return PAGE_LABELS[p];
  if (p.startsWith("/account/")) return "👤 تفاصيل حساب";
  return p;
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ar-EG", { month: "short", day: "numeric" });
}

// ── Types ──────────────────────────────────────────────────────────────────
type TopItem = {
  id: number; name: string; platform: string;
  imageUrl: string | null; count: number;
};
type StatsData = {
  totals: { pageViews: number; whatsappClicks: number; accountUrlClicks: number };
  topByPageViews: TopItem[];
  topByWhatsapp: TopItem[];
  topByAccountUrlClick: TopItem[];
};

// ── Sub-components ─────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-2xl border p-5 flex items-center gap-4 bg-card shadow-sm">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <p className="text-2xl font-black mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function TopList({ title, icon, items, emptyMsg }: {
  title: string; icon: React.ReactNode; items: TopItem[]; emptyMsg: string;
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
            <li key={item.id} className="flex items-center gap-3 px-5 py-3">
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
                  {PLT_ICON[item.platform]}
                  {item.platform === "tiktok_monetized" ? "تيك توك أرباح" : item.platform}
                </p>
              </div>
              <span className="font-black text-base text-primary shrink-0">{item.count}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function AdminStats() {
  // Existing account-level stats (manual fetch to keep auth header pattern)
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    const token = localStorage.getItem("admin_token");
    fetch(`${BASE}/api/stats/admin-detail`, {
      headers: { Authorization: `Bearer ${token ?? ""}` },
    })
      .then(r => {
        if (!r.ok) throw new Error("فشل التحميل");
        return r.json() as Promise<StatsData>;
      })
      .then(setData)
      .catch(() => setError("تعذّر تحميل الإحصائيات"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  // New: site-level analytics via generated hook
  const { data: siteOverview, isLoading: siteLoading, refetch: refetchSite } = useGetSiteOverview();

  useEffect(() => {
    const id = setInterval(() => void refetchSite(), 30_000);
    return () => clearInterval(id);
  }, [refetchSite]);

  // ── Site analytics stat cards definition ──────────────────────────────
  const siteCards = [
    { icon: <Globe className="w-5 h-5" />,    label: "إجمالي الزيارات", val: siteOverview?.total,          color: "text-blue-600",   bg: "bg-blue-500/8",   border: "border-blue-500/20" },
    { icon: <Calendar className="w-5 h-5" />, label: "زيارات اليوم",    val: siteOverview?.today,           color: "text-emerald-600", bg: "bg-emerald-500/8", border: "border-emerald-500/20" },
    { icon: <BarChart3 className="w-5 h-5" />, label: "آخر 7 أيام",     val: siteOverview?.last7days,       color: "text-violet-600", bg: "bg-violet-500/8", border: "border-violet-500/20" },
    { icon: <TrendingUp className="w-5 h-5" />, label: "آخر 30 يوم",    val: siteOverview?.last30days,      color: "text-orange-600", bg: "bg-orange-500/8", border: "border-orange-500/20" },
    { icon: <Users2 className="w-5 h-5" />,   label: "زوار فريدون",     val: siteOverview?.uniqueVisitors,  color: "text-pink-600",   bg: "bg-pink-500/8",   border: "border-pink-500/20" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-5xl mx-auto">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-primary" />
            الإحصائيات
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            إحصائيات حقيقية مسجّلة من استخدام الموقع الفعلي · تتحدث كل 30 ثانية
          </p>
        </div>

        {/* ════════════════════════════════════════════════════════════
            SECTION 1 — زيارات الموقع (site-level analytics)
        ════════════════════════════════════════════════════════════ */}
        <div>
          {/* Section header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-500" />
              <h2 className="text-base font-bold">زيارات الموقع 👁️</h2>
            </div>
            {/* Active now badge */}
            {!siteLoading && siteOverview !== undefined && (
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                الزوار الآن: {siteOverview.activeNow}
              </span>
            )}
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
            {siteCards.map((s, i) => (
              <div key={i} className={`${s.bg} border ${s.border} rounded-xl p-4 flex flex-col gap-2 shadow-sm`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{s.label}</span>
                  <span className={`${s.color} opacity-70`}>{s.icon}</span>
                </div>
                {siteLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className={`text-3xl font-black ${s.color}`}>
                    {(s.val ?? 0).toLocaleString("ar-EG")}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Chart + Top pages */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Area chart */}
            <div className="lg:col-span-2 bg-card border rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-semibold">الزيارات اليومية — آخر 30 يوم</span>
              </div>
              {siteLoading ? (
                <Skeleton className="h-44 w-full rounded-lg" />
              ) : !siteOverview?.dailyChart.length ? (
                <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">
                  لا توجد بيانات بعد — ستظهر هنا فور بدء الزيارات
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={176}>
                  <AreaChart
                    data={siteOverview.dailyChart}
                    margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
                  >
                    <defs>
                      <linearGradient id="visitGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.06} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDateShort}
                      tick={{ fontSize: 10, fill: "currentColor" }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "currentColor" }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <ReTooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, direction: "rtl" }}
                      formatter={(v: number) => [v.toLocaleString("ar-EG"), "زيارة"]}
                      labelFormatter={formatDateShort}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#visitGrad)"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top pages */}
            <div className="bg-card border rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-semibold">أكثر الصفحات زيارة</span>
              </div>
              {siteLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full rounded" />)}
                </div>
              ) : !siteOverview?.topPages.length ? (
                <p className="text-sm text-muted-foreground text-center py-6">لا توجد بيانات بعد</p>
              ) : (
                <ol className="space-y-2">
                  {siteOverview.topPages.map((p, i) => {
                    const maxCount = siteOverview.topPages[0]?.count ?? 1;
                    const pct = Math.round((p.count / maxCount) * 100);
                    return (
                      <li key={p.page} className="flex items-start gap-2 text-xs">
                        <span className={`w-5 text-center font-black shrink-0 mt-0.5 ${
                          i === 0 ? "text-yellow-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-muted-foreground/40"
                        }`}>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="truncate text-[11px] font-medium">{pageLabel(p.page)}</span>
                            <span className="font-black text-blue-500 shrink-0 mr-2">
                              {p.count.toLocaleString("ar-EG")}
                            </span>
                          </div>
                          <div className="h-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════
            SECTION 2 — نقرات الحسابات (account-level stats)
        ════════════════════════════════════════════════════════════ */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-primary" />
            <h2 className="text-base font-bold">تفاعل الزوار مع الحسابات</h2>
          </div>

          {loading && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
              </div>
            </div>
          )}

          {error && (
            <div className="text-center py-16 text-muted-foreground border rounded-xl bg-muted/30">
              <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>{error}</p>
            </div>
          )}

          {data && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                  icon={<Eye className="w-5 h-5 text-white" />}
                  label="زيارات صفحات الحسابات"
                  value={data.totals.pageViews.toLocaleString("ar-EG")}
                  color="bg-blue-500"
                />
                <StatCard
                  icon={<Phone className="w-5 h-5 text-white" />}
                  label="نقرات واتساب"
                  value={data.totals.whatsappClicks.toLocaleString("ar-EG")}
                  color="bg-green-500"
                />
                <StatCard
                  icon={<ExternalLink className="w-5 h-5 text-white" />}
                  label="نقرات زيارة الحساب"
                  value={data.totals.accountUrlClicks.toLocaleString("ar-EG")}
                  color="bg-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <TopList
                  title="أكثر الحسابات مشاهدة"
                  icon={<Eye className="w-4 h-4" />}
                  items={data.topByPageViews}
                  emptyMsg="لا توجد زيارات مسجّلة بعد"
                />
                <TopList
                  title="أكثر نقرات واتساب"
                  icon={<Phone className="w-4 h-4" />}
                  items={data.topByWhatsapp}
                  emptyMsg="لا توجد نقرات واتساب مسجّلة"
                />
                <TopList
                  title="أكثر نقرات زيارة الحساب"
                  icon={<ExternalLink className="w-4 h-4" />}
                  items={data.topByAccountUrlClick}
                  emptyMsg="لا توجد نقرات زيارة مسجّلة"
                />
              </div>

              <p className="text-center text-xs text-muted-foreground pt-2">
                يتم تسجيل كل نقرة فعلية تلقائياً. البيانات تُحدَّث في الوقت الفعلي.
              </p>
            </>
          )}
        </div>

      </div>
    </AdminLayout>
  );
}
