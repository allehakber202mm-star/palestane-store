import { AdminLayout } from "@/components/layout/AdminLayout";
import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Phone, ExternalLink, BarChart2, TrendingUp } from "lucide-react";
import { SiTiktok, SiInstagram, SiFacebook } from "react-icons/si";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const PLT_ICON: Record<string, React.ReactNode> = {
  tiktok:           <SiTiktok className="w-3.5 h-3.5" />,
  tiktok_monetized: <SiTiktok className="w-3.5 h-3.5 text-green-600" />,
  instagram:        <SiInstagram className="w-3.5 h-3.5 text-pink-500" />,
  facebook:         <SiFacebook className="w-3.5 h-3.5 text-blue-500" />,
};

type TopItem = { id: number; name: string; platform: string; imageUrl: string | null; count: number };
type StatsData = {
  totals: { pageViews: number; whatsappClicks: number; accountUrlClicks: number };
  topByPageViews: TopItem[];
  topByWhatsapp: TopItem[];
  topByAccountUrlClick: TopItem[];
};

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color: string }) {
  return (
    <div className={`rounded-2xl border p-5 flex items-center gap-4 bg-card shadow-sm`}>
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

function TopList({ title, icon, items, emptyMsg }: { title: string; icon: React.ReactNode; items: TopItem[]; emptyMsg: string }) {
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

export default function AdminStats() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl mx-auto">

        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-primary" />
            الإحصائيات
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">إحصائيات حقيقية مسجّلة من استخدام الموقع الفعلي</p>
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
            {/* Total cards */}
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

            {/* Top lists */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
    </AdminLayout>
  );
}
