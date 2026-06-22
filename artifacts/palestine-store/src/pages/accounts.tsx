import { useState, useEffect } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { AccountCard } from "@/components/AccountCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useListAccounts } from "@workspace/api-client-react";
import { ListAccountsPlatform } from "@workspace/api-client-react";
import { SiTiktok, SiInstagram, SiFacebook } from "react-icons/si";
import { DollarSign } from "lucide-react";

type Platform = "tiktok" | "instagram" | "facebook" | "tiktok_monetized";

const filters: { value: Platform; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "tiktok",           label: "تيك توك",              icon: <SiTiktok className="w-4 h-4" />,                              color: "text-foreground" },
  { value: "tiktok_monetized", label: "تيك توك أرباح",         icon: <DollarSign className="w-4 h-4 text-green-500" />,             color: "text-green-600" },
  { value: "instagram",        label: "انستغرام",              icon: <SiInstagram className="w-4 h-4 text-pink-500" />,             color: "text-pink-500" },
  { value: "facebook",         label: "فيسبوك",                icon: <SiFacebook className="w-4 h-4 text-blue-600" />,              color: "text-blue-600" },
];

export default function Accounts() {
  const params = new URLSearchParams(window.location.search);
  const urlPlatform = params.get("platform") as Platform | null;
  const validPlatforms: Platform[] = ["tiktok", "instagram", "facebook", "tiktok_monetized"];
  const initialPlatform: Platform = (urlPlatform && validPlatforms.includes(urlPlatform))
    ? urlPlatform
    : "tiktok";

  const [active, setActive] = useState<Platform>(initialPlatform);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("platform") as Platform | null;
    if (p && validPlatforms.includes(p) && p !== active) setActive(p);
  }, []);

  const { data: rawAccounts, isLoading } = useListAccounts({
    platform: active as ListAccountsPlatform,
  });

  const accounts = rawAccounts
    ? [...rawAccounts].sort((a, b) => b.followers - a.followers)
    : undefined;

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
        {/* Platform Tabs — grid, no horizontal scroll */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
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

        {/* Results count */}
        {!isLoading && accounts && (
          <p className="text-xs text-muted-foreground mb-4">
            <span className={activeFilter.color}>{activeFilter.label}</span>
            {" — "}
            {accounts.length} حساب
          </p>
        )}

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
