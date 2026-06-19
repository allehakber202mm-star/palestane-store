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
  Sparkles,
  MessageCircle,
} from "lucide-react";
import { SiTiktok, SiInstagram, SiFacebook } from "react-icons/si";
import {
  useGetSettings,
  useListFeaturedAccounts,
  useListRecentAccounts,
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="aspect-[4/3] w-full rounded-xl" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-9 w-full mt-1" />
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
    <div className="flex items-center justify-between mb-6">
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
    <section
      className={`bg-card border rounded-2xl shadow-sm p-5 sm:p-8 ${className}`}
    >
      {children}
    </section>
  );
}

const features = [
  {
    icon: <ShieldCheck className="w-7 h-7 text-green-500" />,
    title: "ضمان أمان 100%",
    desc: "جميع الحسابات مفحوصة ومضمونة وموثقة بالكامل",
    color: "bg-green-500/10 border-green-500/20",
  },
  {
    icon: <Users className="w-7 h-7 text-blue-500" />,
    title: "متابعين حقيقيين",
    desc: "متابعون حقيقيون وفعليون بدون أي بوتات أو حسابات وهمية",
    color: "bg-blue-500/10 border-blue-500/20",
  },
  {
    icon: <CheckCircle2 className="w-7 h-7 text-emerald-500" />,
    title: "نظيف بدون انتهاكات",
    desc: "حسابات نظيفة بالكامل خالية من أي انتهاكات أو تحذيرات",
    color: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    icon: <Video className="w-7 h-7 text-purple-500" />,
    title: "شغال لايف",
    desc: "جميع الحسابات مفعّلة لميزة البث المباشر",
    color: "bg-purple-500/10 border-purple-500/20",
  },
  {
    icon: <Zap className="w-7 h-7 text-yellow-500" />,
    title: "تسليم فوري",
    desc: "استلم حسابك فور إتمام عملية الدفع مباشرةً عبر واتساب",
    color: "bg-yellow-500/10 border-yellow-500/20",
  },
  {
    icon: <HeadphonesIcon className="w-7 h-7 text-primary" />,
    title: "دعم متواصل",
    desc: "فريق الدعم جاهز لمساعدتك على مدار الساعة",
    color: "bg-primary/10 border-primary/20",
  },
];

export default function Home() {
  const { data: settings } = useGetSettings();
  const { data: featured, isLoading: isLoadingFeatured } =
    useListFeaturedAccounts();
  const { data: recent, isLoading: isLoadingRecent } = useListRecentAccounts();

  const { data: tiktok, isLoading: isLoadingTiktok } = useListAccounts({
    platform: "tiktok",
    status: "available",
    limit: 4,
  });
  const { data: instagram, isLoading: isLoadingInstagram } = useListAccounts({
    platform: "instagram",
    status: "available",
    limit: 4,
  });
  const { data: facebook, isLoading: isLoadingFacebook } = useListAccounts({
    platform: "facebook",
    status: "available",
    limit: 4,
  });

  const phone =
    settings?.whatsapp?.replace(/\D/g, "") || "972566112031";

  return (
    <PublicLayout>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-primary/5 py-10 sm:py-16 lg:py-20">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary via-transparent to-transparent" />
        <div className="container relative z-10 px-4 mx-auto text-center">
          <h1 className="text-2xl sm:text-4xl lg:text-6xl font-black text-foreground mb-4 tracking-tight max-w-3xl mx-auto leading-tight">
            {settings?.bannerTitle || "أكبر متجر للحسابات في فلسطين"}
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-7 max-w-xl mx-auto leading-relaxed">
            {settings?.bannerSubtitle ||
              "حسابات موثوقة، تسليم فوري، ودعم فني على مدار الساعة."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <Button
              size="lg"
              className="h-12 px-7 text-base font-bold rounded-full w-full sm:w-auto"
              asChild
            >
              <Link href="/accounts">تصفح الحسابات</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-7 text-base font-bold rounded-full w-full sm:w-auto"
              onClick={() =>
                window.open(`https://wa.me/${phone}`, "_blank")
              }
            >
              تواصل معنا
            </Button>
          </div>
        </div>
      </section>

      {/* ── Main content ── */}
      <div className="container mx-auto px-4 py-8 space-y-6">

        {/* Featured */}
        {((featured && featured.length > 0) || isLoadingFeatured) && (
          <Section>
            <SectionHeader
              title="الحسابات المميزة"
              icon={<Sparkles className="w-5 h-5 text-yellow-500" />}
              linkHref="/accounts"
              linkLabel="عرض الكل"
            />
            <AccountGrid accounts={featured} isLoading={isLoadingFeatured} />
          </Section>
        )}

        {/* Recent */}
        <Section>
          <SectionHeader
            title="أحدث الحسابات"
            icon={<Zap className="w-5 h-5 text-accent" />}
            linkHref="/accounts"
            linkLabel="عرض الكل"
          />
          <AccountGrid accounts={recent} isLoading={isLoadingRecent} />
        </Section>

        {/* TikTok */}
        <Section>
          <SectionHeader
            title="حسابات تيك توك"
            icon={<SiTiktok className="w-5 h-5" />}
            linkHref="/accounts?platform=tiktok"
            linkLabel="تصفح التيك توك"
          />
          <AccountGrid accounts={tiktok} isLoading={isLoadingTiktok} />
        </Section>

        {/* Instagram */}
        <Section>
          <SectionHeader
            title="حسابات انستغرام"
            icon={<SiInstagram className="w-5 h-5 text-pink-600" />}
            linkHref="/accounts?platform=instagram"
            linkLabel="تصفح الانستغرام"
          />
          <AccountGrid accounts={instagram} isLoading={isLoadingInstagram} />
        </Section>

        {/* Facebook */}
        <Section>
          <SectionHeader
            title="حسابات فيسبوك"
            icon={<SiFacebook className="w-5 h-5 text-blue-600" />}
            linkHref="/accounts?platform=facebook"
            linkLabel="تصفح الفيسبوك"
          />
          <AccountGrid accounts={facebook} isLoading={isLoadingFacebook} />
        </Section>

        {/* Payment Methods */}
        <Section className="text-center">
          <h2 className="text-xl sm:text-2xl font-bold mb-5">
            طرق الدفع المتاحة
          </h2>
          <div className="flex flex-wrap justify-center gap-3 mb-4">
            {settings?.paymentMethods && settings.paymentMethods.length > 0 ? (
              settings.paymentMethods.map((method, i) => (
                <div
                  key={i}
                  className="px-5 py-2.5 bg-background rounded-full font-medium border shadow-sm text-sm"
                >
                  {method}
                </div>
              ))
            ) : (
              <>
                {[
                  "بنك فلسطين",
                  "البنك العربي",
                  "Reflect",
                  "بنك هبوعليم",
                  "شركة توصيل",
                ].map((m) => (
                  <div
                    key={m}
                    className="px-5 py-2.5 bg-background rounded-full font-medium border shadow-sm text-sm"
                  >
                    {m}
                  </div>
                ))}
              </>
            )}
          </div>
          {settings?.paymentNote && (
            <p className="text-muted-foreground text-sm">
              {settings.paymentNote}
            </p>
          )}
        </Section>

        {/* Contact */}
        <Section className="text-center bg-primary/5 border-primary/20">
          <MessageCircle className="w-10 h-10 text-green-500 mx-auto mb-3" />
          <h2 className="text-xl sm:text-2xl font-bold mb-2">تواصل معنا</h2>
          <p className="text-muted-foreground text-sm mb-5 max-w-md mx-auto">
            هل لديك سؤال أو تريد شراء حساب؟ تواصل معنا عبر واتساب وسنرد عليك
            فوراً.
          </p>
          <Button
            size="lg"
            className="bg-green-500 hover:bg-green-600 text-white font-bold rounded-full h-12 px-8 w-full sm:w-auto"
            onClick={() => window.open(`https://wa.me/${phone}`, "_blank")}
          >
            واتساب الآن
          </Button>
        </Section>

        {/* Why Palestine Store — Features */}
        <section className="py-2">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-black mb-2">
              لماذا متجر فلسطين؟
            </h2>
            <p className="text-muted-foreground text-sm">
              نضمن لك تجربة شراء آمنة وموثوقة
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <div
                key={i}
                className={`flex items-start gap-4 p-5 rounded-2xl border shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ${f.color}`}
              >
                <div className="shrink-0 mt-0.5">{f.icon}</div>
                <div>
                  <h3 className="font-bold text-base mb-1">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </PublicLayout>
  );
}
