import { PublicLayout } from "@/components/layout/PublicLayout";
import { AccountCard } from "@/components/AccountCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useListAccounts } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { ListAccountsPlatform } from "@workspace/api-client-react";

export default function Accounts() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const platform = searchParams.get("platform") as ListAccountsPlatform | undefined;

  const { data: accounts, isLoading } = useListAccounts({ 
    platform: platform || undefined,
    status: "available"
  });

  const setPlatformFilter = (newPlatform: string | null) => {
    if (newPlatform) {
      setLocation(`/accounts?platform=${newPlatform}`);
    } else {
      setLocation(`/accounts`);
    }
  };

  return (
    <PublicLayout>
      <div className="bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-12">
          <h1 className="text-4xl font-black mb-4">جميع الحسابات المتاحة</h1>
          <p className="text-lg text-muted-foreground">
            تصفح مجموعتنا الواسعة من الحسابات المميزة والجاهزة للبدء
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex overflow-x-auto pb-4 mb-8 gap-2 hide-scrollbar">
          <Button 
            variant={!platform ? "default" : "outline"}
            className="rounded-full whitespace-nowrap px-6 font-bold"
            onClick={() => setPlatformFilter(null)}
          >
            الكل
          </Button>
          <Button 
            variant={platform === "tiktok" ? "default" : "outline"}
            className="rounded-full whitespace-nowrap px-6 font-bold"
            onClick={() => setPlatformFilter("tiktok")}
          >
            تيك توك
          </Button>
          <Button 
            variant={platform === "instagram" ? "default" : "outline"}
            className="rounded-full whitespace-nowrap px-6 font-bold"
            onClick={() => setPlatformFilter("instagram")}
          >
            انستغرام
          </Button>
          <Button 
            variant={platform === "facebook" ? "default" : "outline"}
            className="rounded-full whitespace-nowrap px-6 font-bold"
            onClick={() => setPlatformFilter("facebook")}
          >
            فيسبوك
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex flex-col gap-3">
                <Skeleton className="aspect-[4/3] w-full rounded-xl" />
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <div className="space-y-2 mt-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-full" />
                </div>
                <Skeleton className="h-10 w-full mt-2" />
              </div>
            ))}
          </div>
        ) : !accounts || accounts.length === 0 ? (
          <div className="text-center py-24 bg-muted/20 rounded-xl border border-dashed">
            <h3 className="text-2xl font-bold mb-2">لا يوجد حسابات</h3>
            <p className="text-muted-foreground">عذراً، لا يتوفر حسابات مطابقة لبحثك في الوقت الحالي.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {accounts.map(account => (
              <AccountCard key={account.id} account={account} />
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}