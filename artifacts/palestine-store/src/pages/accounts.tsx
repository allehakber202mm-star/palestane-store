import { useState, useEffect } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { AccountCard } from "@/components/AccountCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useListAccounts, ListAccountsPlatform, ListAccountsSort } from "@workspace/api-client-react";
import { SiTiktok, SiInstagram, SiFacebook } from "react-icons/si";
import { DollarSign, ArrowUpDown } from "lucide-react";

type Platform = "tiktok" | "instagram" | "facebook" | "tiktok_monetized";

const filters: { value: Platform; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "tiktok",           label: "تيك توك",     icon: <SiTiktok className="w-4 h-4" />,                      color: "text-foreground" },
  { value: "tiktok_monetized", label: "تيك توك أرباح", icon: <DollarSign className="w-4 h-4 text-green-500" />,     color: "text-green-600" },
  { value: "instagram",        label: "انستغرام",     icon: <SiInstagram className="w-4 h-4 text-pink-500" />,     color: "text-pink-500" },
  { value: "facebook",         label: "فيسبوك",       icon: <SiFacebook className="w-4 h-4 text-blue-600" />,      color: "text-blue-600" },
];

type SortOption = {
  value: ListAccountsSort;
  label: string;
};

const SORT_OPTIONS: SortOption[] = [
  { value: "followers_desc", label: "الأكثر متابعين" },
  { value: "followers_asc",  label: "الأقل متابعين" },
  { value: "newest",         label: "الأحدث" },
  { value: "oldest",         label: "الأقدم" },
  { value: "price_desc",     label: "الأعلى سعراً" },
  { value: "price_asc",      label: "الأقل سعراً" },
];

export default function Accounts() {
  const params = new URLSearchParams(window.location.search);
  const urlPlatform = params.get("platform") as Platform | null;
  const validPlatforms: Platform[] = ["tiktok", "instagram", "facebook", "tiktok_monetized"];
  const initialPlatform: Platform = (urlPlatform && validPlatforms.includes(urlPlatform))
    ? urlPlatform
    : "tiktok";

  const [active, setActive] = useState<Platform>(initialPlatform);
  const [sort, setSort]     = useState<ListAccountsSort>("followers_desc");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("platform") as Platform | null;
    if (p && validPlatforms.includes(p) && p !== active) setActive(p);
  }, []);

  const { data: accounts, isLoading } = useListAccounts({
    platform: active as ListAccountsPlatform,
    sort,
  });

  const activeFilter = filters.find((f) => f.value === active)!;

  return (
    <PublicLayout>
      {/* Page Header */}
      <div className="bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-8 sm:py-12">
          <h1 className="text-2xl sm:text-4xl font-black mb-2">جميع الحسابات</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            تصفح مجموعتنا الواسعة من الحسابات المميزة والجاهزة للبدء
          </p>
        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 py-5 sm:py-8">
        {/* Platform Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setActive(f.value)}
              className={`flex items-center justify-center gap-2 px-3 py-3 rounded-2xl font-bold text-sm transition-all border ${
                active === f.value
                  ? f.value === "tiktok_monetized"
                    ? "bg-green-600 text-white border-green-600 shadow-md shadow-green-200 dark:shadow-none"
                    : "bg-primary text-primary-foreground border-primary shadow-md"
                  : "bg-background text-foreground border-border hover:border-primary/40 hover:bg-muted/60"
              }`}
            >
              {f.icon}
              {f.label}
              {f.value === "tiktok_monetized" && active !== f.value && (
                <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">
                  💰
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Sort bar */}
        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          {/* Results count */}
          {!isLoading && accounts && (
            <p className="text-xs text-muted-foreground">
              <span className={activeFilter.color}>{activeFilter.label}</span>
              {" — "}
              {accounts.length} حساب
            </p>
          )}
          {isLoading && <div className="h-4 w-28 bg-muted rounded animate-pulse" />}

          {/* Sort selector */}
          <div className="flex items-center gap-2 ms-auto">
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as ListAccountsSort)}
              className="text-xs border rounded-lg px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-40 w-full rounded-xl" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-7 w-full mt-1" />
              </div>
            ))}
          </div>
        ) : !accounts || accounts.length === 0 ? (
          <div className="text-center py-20 bg-muted/20 rounded-xl border border-dashed">
            <p className="text-lg font-bold mb-1">لا يوجد حسابات</p>
            <p className="text-muted-foreground text-sm">
              لا يتوفر حسابات {activeFilter.label} في الوقت الحالي.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {accounts.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
