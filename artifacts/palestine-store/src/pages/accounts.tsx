import { useState, useEffect } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { AccountCard } from "@/components/AccountCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useListAccounts } from "@workspace/api-client-react";
import { ListAccountsPlatform } from "@workspace/api-client-react";
import { SiTiktok, SiInstagram, SiFacebook } from "react-icons/si";

type Platform = "tiktok" | "instagram" | "facebook";

const filters: { value: Platform; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "tiktok",    label: "تيك توك",  icon: <SiTiktok className="w-4 h-4" />,                        color: "text-foreground" },
  { value: "instagram", label: "انستغرام", icon: <SiInstagram className="w-4 h-4 text-pink-500" />,        color: "text-pink-500" },
  { value: "facebook",  label: "فيسبوك",   icon: <SiFacebook className="w-4 h-4 text-blue-600" />,         color: "text-blue-600" },
];

export default function Accounts() {
  const params = new URLSearchParams(window.location.search);
  const urlPlatform = params.get("platform") as Platform | null;
  const validPlatforms: Platform[] = ["tiktok", "instagram", "facebook"];
  const initialPlatform: Platform = (urlPlatform && validPlatforms.includes(urlPlatform))
    ? urlPlatform
    : "tiktok";

  const [active, setActive] = useState<Platform>(initialPlatform);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("platform") as Platform | null;
    if (p && validPlatforms.includes(p) && p !== active) setActive(p);
  }, []);

  const { data: accounts, isLoading } = useListAccounts({
    platform: active as ListAccountsPlatform,
    status: "available",
  });

  const activeFilter = filters.find((f) => f.value === active)!;

  return (
    <PublicLayout>
      {/* Page Header */}
      <div className="bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-8 sm:py-12">
          <h1 className="text-2xl sm:text-4xl font-black mb-2">جميع الحسابات المتاحة</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            تصفح مجموعتنا الواسعة من الحسابات المميزة والجاهزة للبدء
          </p>
        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 py-5 sm:py-8">
        {/* Platform Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-6 scrollbar-hide">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setActive(f.value)}
              className={`flex items-center gap-1.5 px-5 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all border ${
                active === f.value
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background text-foreground border-border hover:border-primary/50 hover:bg-muted"
              }`}
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>

        {/* Results count */}
        {!isLoading && accounts && (
          <p className="text-xs text-muted-foreground mb-4">
            <span className={activeFilter.color}>{activeFilter.label}</span>
            {" — "}
            {accounts.length} حساب متاح
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
