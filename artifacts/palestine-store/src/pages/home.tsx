import { PublicLayout } from "@/components/layout/PublicLayout";
import { AccountCard } from "@/components/AccountCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { ArrowLeft, ArrowLeftCircle, ShieldCheck, Zap, HeadphonesIcon } from "lucide-react";
import { 
  useGetSettings, 
  useListFeaturedAccounts, 
  useListRecentAccounts, 
  useListAccounts 
} from "@workspace/api-client-react";
import { Account } from "@workspace/api-client-react";

function AccountGrid({ accounts, isLoading }: { accounts?: Account[], isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
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
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed">
        <p className="text-muted-foreground">لا يوجد حسابات حالياً في هذا القسم.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {accounts.map(account => (
        <AccountCard key={account.id} account={account} />
      ))}
    </div>
  );
}

export default function Home() {
  const { data: settings } = useGetSettings();
  const { data: featured, isLoading: isLoadingFeatured } = useListFeaturedAccounts();
  const { data: recent, isLoading: isLoadingRecent } = useListRecentAccounts();
  
  const { data: tiktok, isLoading: isLoadingTiktok } = useListAccounts({ platform: "tiktok", status: "available", limit: 4 });
  const { data: instagram, isLoading: isLoadingInstagram } = useListAccounts({ platform: "instagram", status: "available", limit: 4 });
  const { data: facebook, isLoading: isLoadingFacebook } = useListAccounts({ platform: "facebook", status: "available", limit: 4 });

  const phone = settings?.whatsapp?.replace(/\D/g, "") || "972566112031";

  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-primary/5 py-20 lg:py-32">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary via-transparent to-transparent"></div>
        <div className="container relative z-10 px-4 mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-black text-foreground mb-6 tracking-tight max-w-4xl mx-auto">
            {settings?.bannerTitle || "أكبر متجر للحسابات في فلسطين"}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            {settings?.bannerSubtitle || "حسابات موثوقة، تسليم فوري، ودعم فني على مدار الساعة. ابدأ رحلتك في عالم السوشيال ميديا اليوم."}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" className="h-14 px-8 text-lg font-bold rounded-full w-full sm:w-auto" asChild>
              <Link href="/accounts">تصفح الحسابات</Link>
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-bold rounded-full w-full sm:w-auto" onClick={() => window.open(`https://wa.me/${phone}`, "_blank")}>
              تواصل معنا
            </Button>
          </div>
        </div>
      </section>

      {/* Features/Trust Section */}
      <section className="py-12 border-b">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center divide-y md:divide-y-0 md:divide-x md:divide-x-reverse">
            <div className="flex flex-col items-center p-4">
              <ShieldCheck className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-bold mb-2">ضمان أمان 100%</h3>
              <p className="text-muted-foreground text-sm">جميع الحسابات مفحوصة ومضمونة وموثقة بالكامل</p>
            </div>
            <div className="flex flex-col items-center p-4">
              <Zap className="w-12 h-12 text-accent mb-4" />
              <h3 className="text-xl font-bold mb-2">تسليم فوري</h3>
              <p className="text-muted-foreground text-sm">استلم حسابك فور إتمام عملية الدفع مباشرة</p>
            </div>
            <div className="flex flex-col items-center p-4">
              <HeadphonesIcon className="w-12 h-12 text-blue-500 mb-4" />
              <h3 className="text-xl font-bold mb-2">دعم متواصل</h3>
              <p className="text-muted-foreground text-sm">فريق الدعم جاهز لمساعدتك في أي وقت تحتاجنا فيه</p>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-16 space-y-24">
        {/* Featured */}
        {(featured && featured.length > 0) || isLoadingFeatured ? (
          <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-black flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center text-sm">★</span>
                الحسابات المميزة
              </h2>
            </div>
            <AccountGrid accounts={featured} isLoading={isLoadingFeatured} />
          </section>
        ) : null}

        {/* Recent */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black">أحدث الحسابات</h2>
            <Link href="/accounts" className="text-primary font-medium hover:underline flex items-center gap-1">
              عرض الكل
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>
          <AccountGrid accounts={recent} isLoading={isLoadingRecent} />
        </section>

        {/* TikTok */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black flex items-center gap-3">
              <span className="w-4 h-8 bg-black dark:bg-white rounded-sm"></span>
              حسابات تيك توك
            </h2>
            <Link href="/accounts?platform=tiktok" className="text-primary font-medium hover:underline flex items-center gap-1">
              تصفح التيك توك
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>
          <AccountGrid accounts={tiktok} isLoading={isLoadingTiktok} />
        </section>

        {/* Instagram */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black flex items-center gap-3">
              <span className="w-4 h-8 bg-pink-600 rounded-sm"></span>
              حسابات انستغرام
            </h2>
            <Link href="/accounts?platform=instagram" className="text-primary font-medium hover:underline flex items-center gap-1">
              تصفح الانستغرام
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>
          <AccountGrid accounts={instagram} isLoading={isLoadingInstagram} />
        </section>

        {/* Payment Methods */}
        <section className="bg-muted/50 rounded-3xl p-8 md:p-12 border text-center">
          <h2 className="text-2xl font-bold mb-6">طرق الدفع المتاحة</h2>
          <div className="flex flex-wrap justify-center gap-4 mb-6">
            {settings?.paymentMethods && settings.paymentMethods.length > 0 ? (
              settings.paymentMethods.map((method, i) => (
                <div key={i} className="px-6 py-3 bg-background rounded-full font-medium border shadow-sm">
                  {method}
                </div>
              ))
            ) : (
              <>
                <div className="px-6 py-3 bg-background rounded-full font-medium border shadow-sm">بنك فلسطين</div>
                <div className="px-6 py-3 bg-background rounded-full font-medium border shadow-sm">البنك العربي</div>
                <div className="px-6 py-3 bg-background rounded-full font-medium border shadow-sm">Reflect</div>
                <div className="px-6 py-3 bg-background rounded-full font-medium border shadow-sm">بنك هبوعليم</div>
                <div className="px-6 py-3 bg-background rounded-full font-medium border shadow-sm">شركة توصيل</div>
              </>
            )}
          </div>
          {settings?.paymentNote && (
            <p className="text-muted-foreground">{settings.paymentNote}</p>
          )}
        </section>
      </div>
    </PublicLayout>
  );
}