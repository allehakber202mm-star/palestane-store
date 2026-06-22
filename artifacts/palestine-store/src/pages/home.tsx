import { PublicLayout } from "@/components/layout/PublicLayout";
import { AccountCard } from "@/components/AccountCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  ArrowLeft,
  ShieldCheck,
  Zap,
  HeadphonesIcon,
  Users,
  CheckCircle2,
  Video,
  MessageCircle,
} from "lucide-react";
import { SiTiktok, SiInstagram, SiFacebook } from "react-icons/si";
import {
  useGetSettings,
  useListAccounts,
} from "@workspace/api-client-react";
import { Account } from "@workspace/api-client-react";

function AccountGrid({
  accounts,
  isLoading,
}: {
  accounts?: Account[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-7 w-full mt-1" />
          </div>
        ))}
      </div>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <div className="text-center py-10 bg-muted/30 rounded-xl border border-dashed">
        <p className="text-muted-foreground text-sm">لا يوجد حسابات حالياً.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
      {accounts.map((account) => (
        <AccountCard key={account.id} account={account} />
      ))}
    </div>
  );
}

function SectionHeader({
  title,
  icon,
  linkHref,
  linkLabel,
}: {
  title: string;
  icon: React.ReactNode;
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {linkHref && (
        <Link
          href={linkHref}
          className="text-primary font-medium hover:underline flex items-center gap-1 text-sm shrink-0"
        >
          {linkLabel || "عرض الكل"}
          <ArrowLeft className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}

function Section({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-card border rounded-2xl shadow-sm p-5 sm:p-8 ${className}`}>
      {children}
    </section>
  );
}

const features = [
  {
    icon: <ShieldCheck className="w-6 h-6 text-green-500" />,
    title: "ضمان أمان 100%",
    desc: "جميع الحسابات مفحوصة ومضمونة وموثقة بالكامل",
    color: "bg-green-500/10 border-green-500/20",
  },
  {
    icon: <Users className="w-6 h-6 text-blue-500" />,
    title: "متابعين حقيقيين",
    desc: "متابعون حقيقيون وفعليون بدون أي بوتات أو حسابات وهمية",
    color: "bg-blue-500/10 border-blue-500/20",
  },
  {
    icon: <CheckCircle2 className="w-6 h-6 text-emerald-500" />,
    title: "نظيف بدون انتهاكات",
    desc: "حسابات نظيفة بالكامل خالية من أي انتهاكات أو تحذيرات",
    color: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    icon: <Video className="w-6 h-6 text-purple-500" />,
    title: "شغال لايف",
    desc: "جميع الحسابات مفعّلة لميزة البث المباشر",
    color: "bg-purple-500/10 border-purple-500/20",
  },
  {
    icon: <Zap className="w-6 h-6 text-yellow-500" />,
    title: "تسليم فوري",
    desc: "استلم حسابك فور إتمام عملية الدفع مباشرةً عبر واتساب",
    color: "bg-yellow-500/10 border-yellow-500/20",
  },
  {
    icon: <HeadphonesIcon className="w-6 h-6 text-primary" />,
    title: "دعم متواصل",
    desc: "فريق الدعم جاهز لمساعدتك على مدار الساعة",
    color: "bg-primary/10 border-primary/20",
  },
];

export default function Home() {
  const { data: settings } = useGetSettings();

  const { data: rawTiktok, isLoading: isLoadingTiktok } = useListAccounts({ platform: "tiktok", limit: 8 });
  const { data: rawMonetized, isLoading: isLoadingMonetized } = useListAccounts({ platform: "tiktok_monetized", limit: 8 });
  const { data: rawInstagram, isLoading: isLoadingInstagram } = useListAccounts({ platform: "instagram", limit: 8 });
  const { data: rawFacebook, isLoading: isLoadingFacebook } = useListAccounts({ platform: "facebook", limit: 8 });

  const sortByStatus = (arr?: typeof rawTiktok) =>
    arr ? [...arr].sort((a, b) => (a.status === b.status ? 0 : a.status === "available" ? -1 : 1)) : undefined;

  const tiktok = sortByStatus(rawTiktok);
  const monetized = sortByStatus(rawMonetized);
  const instagram = sortByStatus(rawInstagram);
  const facebook = sortByStatus(rawFacebook);

  const phone = settings?.whatsapp?.replace(/\D/g, "") || "972566112031";

  return (
    <PublicLayout>
      {/* ── Hero ── */}
      <section className="relative bg-primary/5 py-10 sm:py-16 lg:py-20">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary via-transparent to-transparent" />
        <div className="container relative z-10 px-4 mx-auto text-center">
          <h1 className="text-2xl sm:text-4xl lg:text-6xl font-black text-foreground mb-4 tracking-tight max-w-3xl mx-auto leading-tight">
            {settings?.bannerTitle || "أكبر متجر للحسابات في فلسطين"}
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-7 max-w-xl mx-auto leading-relaxed">
            {settings?.bannerSubtitle ||
              "حسابات موثوقة، تسليم فوري، ودعم فني على مدار الساعة."}
          </p>
          {/* ── Platform quick-access grid ── */}
          <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto mt-2 w-full">
            <Link href="/accounts?platform=tiktok"
              className="flex flex-col items-center gap-2 bg-background/80 hover:bg-background border border-border hover:border-foreground/20 rounded-2xl py-4 px-3 transition-all shadow-sm hover:shadow-md group">
              <SiTiktok className="w-8 h-8 text-foreground" />
              <span className="font-bold text-sm">تيك توك</span>
            </Link>
            <Link href="/accounts?platform=tiktok_monetized"
              className="flex flex-col items-center gap-2 bg-background/80 hover:bg-background border border-green-200 hover:border-green-400 dark:border-green-800 dark:hover:border-green-600 rounded-2xl py-4 px-3 transition-all shadow-sm hover:shadow-md group">
              <div className="relative">
                <SiTiktok className="w-8 h-8 text-green-600 dark:text-green-400" />
                <span className="absolute -bottom-1 -left-1 bg-green-500 text-white text-[8px] font-black px-1 rounded-full leading-tight">$</span>
              </div>
              <span className="font-bold text-sm text-green-700 dark:text-green-400">تيك توك أرباح</span>
            </Link>
            <Link href="/accounts?platform=instagram"
              className="flex flex-col items-center gap-2 bg-background/80 hover:bg-background border border-border hover:border-pink-300 dark:hover:border-pink-700 rounded-2xl py-4 px-3 transition-all shadow-sm hover:shadow-md group">
              <SiInstagram className="w-8 h-8 text-pink-600 dark:text-pink-400" />
              <span className="font-bold text-sm text-pink-600 dark:text-pink-400">إنستغرام</span>
            </Link>
            <Link href="/accounts?platform=facebook"
              className="flex flex-col items-center gap-2 bg-background/80 hover:bg-background border border-border hover:border-blue-300 dark:hover:border-blue-700 rounded-2xl py-4 px-3 transition-all shadow-sm hover:shadow-md group">
              <SiFacebook className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <span className="font-bold text-sm text-blue-600 dark:text-blue-400">فيسبوك</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Main content ── */}
      <div className="container mx-auto px-4 py-6 sm:py-8 space-y-5 sm:space-y-6">

        {/* ── TikTok ── */}
        <Section>
          <SectionHeader
            title="حسابات تيك توك"
            icon={<SiTiktok className="w-5 h-5" />}
            linkHref="/accounts?platform=tiktok"
            linkLabel="تصفح التيك توك"
          />
          <AccountGrid accounts={tiktok} isLoading={isLoadingTiktok} />
        </Section>

        {/* ── TikTok Monetized ── */}
        {(isLoadingMonetized || (monetized && monetized.length > 0)) && (
          <Section>
            <SectionHeader
              title="💰 تيك توك أرباح المشاهدات"
              icon={<span className="text-green-500 font-black text-base">₪</span>}
              linkHref="/accounts?platform=tiktok_monetized"
              linkLabel="تصفح حسابات الأرباح"
            />
            <AccountGrid accounts={monetized} isLoading={isLoadingMonetized} />
          </Section>
        )}

        {/* ── Instagram ── */}
        <Section>
          <SectionHeader
            title="حسابات انستغرام"
            icon={<SiInstagram className="w-5 h-5 text-pink-600" />}
            linkHref="/accounts?platform=instagram"
            linkLabel="تصفح الانستغرام"
          />
          <AccountGrid accounts={instagram} isLoading={isLoadingInstagram} />
        </Section>

        {/* ── Facebook ── */}
        <Section>
          <SectionHeader
            title="حسابات فيسبوك"
            icon={<SiFacebook className="w-5 h-5 text-blue-600" />}
            linkHref="/accounts?platform=facebook"
            linkLabel="تصفح الفيسبوك"
          />
          <AccountGrid accounts={facebook} isLoading={isLoadingFacebook} />
        </Section>

        {/* ── Payment Methods ── */}
        <Section className="text-center">
          <h2 className="text-xl sm:text-2xl font-bold mb-5">طرق الدفع المتاحة</h2>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-4">
            {settings?.paymentMethods && settings.paymentMethods.length > 0 ? (
              settings.paymentMethods.map((method, i) => (
                <div
                  key={i}
                  className="px-4 sm:px-5 py-2 sm:py-2.5 bg-background rounded-full font-medium border shadow-sm text-sm"
                >
                  {method}
                </div>
              ))
            ) : (
              <>
                {["بنك فلسطين", "البنك العربي", "Reflect", "بنك هبوعليم", "شركة توصيل"].map((m) => (
                  <div
                    key={m}
                    className="px-4 sm:px-5 py-2 sm:py-2.5 bg-background rounded-full font-medium border shadow-sm text-sm"
                  >
                    {m}
                  </div>
                ))}
              </>
            )}
          </div>
          {settings?.paymentNote && (
            <p className="text-muted-foreground text-sm">{settings.paymentNote}</p>
          )}
        </Section>

        {/* ── لماذا متجر فلسطين؟ — Features (أسفل الصفحة قبل الفوتر) ── */}
        <section>
          <div className="text-center mb-5">
            <h2 className="text-xl sm:text-3xl font-black mb-1">لماذا متجر فلسطين؟</h2>
            <p className="text-muted-foreground text-sm">نضمن لك تجربة شراء آمنة وموثوقة</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {features.map((f, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 p-4 rounded-2xl border shadow-sm ${f.color}`}
              >
                <div className="shrink-0 mt-0.5">{f.icon}</div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base mb-0.5">{f.title}</h3>
                  <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed hidden sm:block">
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Contact ── */}
        <Section className="text-center bg-primary/5 border-primary/20">
          <MessageCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
          <h2 className="text-xl sm:text-2xl font-bold mb-2">تواصل معنا</h2>
          <p className="text-muted-foreground text-sm mb-5 max-w-md mx-auto">
            هل لديك سؤال أو تريد شراء حساب؟ تواصل معنا عبر واتساب وسنرد عليك فوراً.
          </p>
          <Button
            size="lg"
            className="bg-green-500 hover:bg-green-600 text-white font-bold rounded-full h-12 px-8 w-full sm:w-auto"
            onClick={() => window.open(`https://wa.me/${phone}`, "_blank")}
          >
            واتساب الآن
          </Button>
        </Section>

      </div>
    </PublicLayout>
  );
}
