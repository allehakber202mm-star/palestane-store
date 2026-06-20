import { useParams } from "wouter";
import {
  useGetAccount,
  useGetSettings,
  useTrackAccountClick,
} from "@workspace/api-client-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import {
  CheckCircle2, ExternalLink, Users, ArrowRight,
  DollarSign, Globe, Calendar, Tag, Info,
} from "lucide-react";
import { SiTiktok, SiInstagram, SiFacebook } from "react-icons/si";

const PLATFORM_FEATURES = [
  "متابعين حقيقيين",
  "شغال لايف",
  "نظيف بالكامل",
  "بدون انتهاكات",
];

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("ar-EG", {
      year: "numeric", month: "long", day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function AccountDetails() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "", 10);

  const { data: account, isLoading, isError } = useGetAccount(id);
  const { data: settings } = useGetSettings();
  const trackClick = useTrackAccountClick();

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/accounts";
    }
  };

  const handleBuy = () => {
    if (!account) return;
    trackClick.mutate({ id: account.id });
    const phone = settings?.whatsapp?.replace(/\D/g, "") || "972566112031";
    const platformAr =
      account.platform === "tiktok_monetized" ? "تيك توك أرباح المشاهدات"
      : account.platform === "tiktok" ? "تيك توك"
      : account.platform === "instagram" ? "انستغرام"
      : "فيسبوك";
    const msg = `مرحبا، أود شراء حساب ${platformAr} باسم "${account.name}". السعر: ${account.price} شيكل. المتابعين: ${account.followers}.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  /* ── Loading ── */
  if (isLoading) {
    return (
      <PublicLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </PublicLayout>
    );
  }

  /* ── Error ── */
  if (isError || !account) {
    return (
      <PublicLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
          <p className="text-xl font-bold">الحساب غير موجود</p>
          <button onClick={handleBack} className="text-primary underline text-sm">
            العودة للمتجر
          </button>
        </div>
      </PublicLayout>
    );
  }

  /* ── Derived values ── */
  const isMonetized = account.platform === "tiktok_monetized";
  const hasActiveEarnings = isMonetized && account.earningsStatus === "active";
  const isSold = account.status === "sold";

  const PlatformIcon =
    (account.platform === "tiktok" || isMonetized) ? SiTiktok
    : account.platform === "instagram" ? SiInstagram
    : SiFacebook;

  const platformColor =
    (account.platform === "tiktok" || isMonetized) ? "text-foreground"
    : account.platform === "instagram" ? "text-pink-500"
    : "text-blue-500";

  const platformAr =
    account.platform === "tiktok_monetized" ? "تيك توك أرباح المشاهدات"
    : account.platform === "tiktok" ? "تيك توك"
    : account.platform === "instagram" ? "انستغرام"
    : "فيسبوك";

  const followersLabel =
    account.followers >= 1_000_000
      ? `${(account.followers / 1_000_000).toFixed(1)}M`
      : account.followers >= 1000
      ? `${Math.round(account.followers / 1000)}K`
      : `${account.followers}`;

  /* ── Render ── */
  return (
    <PublicLayout>
      <div className="max-w-2xl mx-auto px-4 py-5 pb-32 sm:pb-24">

        {/* Back */}
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowRight className="w-4 h-4" />
          العودة للمتجر
        </button>

        {/* ── Earnings banner (monetized only) ── */}
        {isMonetized && (
          <div className={`flex items-center gap-2 rounded-xl px-4 py-3 mb-4 ${
            hasActiveEarnings
              ? "bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800"
              : "bg-muted/50 border border-border"
          }`}>
            <DollarSign className={`w-4 h-4 shrink-0 ${hasActiveEarnings ? "text-green-600" : "text-muted-foreground"}`} />
            <div>
              <p className={`font-bold text-sm leading-none ${hasActiveEarnings ? "text-green-700 dark:text-green-400" : "text-foreground"}`}>
                {hasActiveEarnings ? "💰 مفعّل أرباح المشاهدات" : "قسم تيك توك أرباح المشاهدات"}
              </p>
              {hasActiveEarnings && account.eligibleCountry && (
                <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">
                  مؤهل في: {account.eligibleCountry}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Image ── */}
        <div className="relative w-full rounded-2xl overflow-hidden bg-muted aspect-[16/9] sm:aspect-[4/3] mb-5">
          {account.imageUrl ? (
            <img
              src={account.imageUrl}
              alt={account.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <PlatformIcon className="w-16 h-16 sm:w-24 sm:h-24 opacity-10" />
            </div>
          )}
          <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />

          {/* Status */}
          <span className={`absolute bottom-3 right-3 text-white text-xs font-bold px-3 py-1 rounded-full ${
            isSold ? "bg-destructive" : "bg-green-500"
          }`}>
            {isSold ? "مباع" : "متاح للبيع"}
          </span>

          {/* Featured */}
          {account.featured && (
            <span className="absolute bottom-3 left-3 text-white text-xs font-bold px-3 py-1 rounded-full bg-yellow-500">
              مميز ★
            </span>
          )}
        </div>

        {/* ── Name + Price ── */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <PlatformIcon className={`w-5 h-5 shrink-0 ${platformColor}`} />
            <div className="min-w-0">
              <h1 className="font-black text-xl sm:text-2xl leading-tight" dir="ltr">
                {account.name}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">{platformAr}</p>
            </div>
          </div>
          <div className="shrink-0 text-left">
            <p className="font-black text-2xl sm:text-3xl text-primary leading-none">{account.price}₪</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 text-right">السعر النهائي</p>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-3">
            <Users className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="font-black text-base sm:text-lg leading-none">{followersLabel}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">متابع</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-3">
            <Tag className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="font-black text-base sm:text-lg leading-none">{account.price}₪</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">السعر</p>
            </div>
          </div>
        </div>

        {/* ── Description ── */}
        {account.description && (
          <div className="mb-5">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">الوصف</h2>
            <p className="text-sm sm:text-base leading-relaxed">{account.description}</p>
          </div>
        )}

        {/* ── Additional info ── */}
        <div className="mb-5 bg-muted/40 rounded-xl overflow-hidden border">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/60">
            <Info className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">معلومات إضافية</span>
          </div>
          <div className="divide-y">
            <InfoRow label="اسم الحساب" value={account.name} ltr />
            <InfoRow label="نوع الحساب" value={platformAr} />
            <InfoRow
              label="الحالة"
              value={isSold ? "مباع" : "متاح للبيع"}
              valueClass={isSold ? "text-destructive font-bold" : "text-green-600 font-bold"}
            />
            {account.createdAt && (
              <InfoRow label="تاريخ الإضافة" value={formatDate(account.createdAt)} />
            )}
            {isMonetized && account.earningsStatus && (
              <InfoRow
                label="حالة الأرباح"
                value={account.earningsStatus === "active" ? "✅ مفعّل" : "⏸️ غير مفعّل"}
                valueClass={account.earningsStatus === "active" ? "text-green-600 font-bold" : "text-muted-foreground"}
              />
            )}
            {isMonetized && account.eligibleCountry && (
              <InfoRow label="الدولة المؤهلة" icon={<Globe className="w-3 h-3" />} value={account.eligibleCountry} />
            )}
            {isMonetized && account.activationDate && (
              <InfoRow label="تاريخ التفعيل" icon={<Calendar className="w-3 h-3" />} value={account.activationDate} />
            )}
          </div>
        </div>

        {/* ── Earnings notes ── */}
        {isMonetized && account.earningsNotes && (
          <div className="mb-5 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800 px-4 py-3">
            <p className="text-xs font-bold text-green-700 dark:text-green-400 mb-1">ملاحظات الأرباح</p>
            <p className="text-sm text-green-700 dark:text-green-300 leading-relaxed">{account.earningsNotes}</p>
          </div>
        )}

        {/* ── Earnings info box ── */}
        {hasActiveEarnings && (
          <div className="mb-5 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800 p-4">
            <div className="flex items-start gap-2">
              <DollarSign className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-green-700 dark:text-green-400 mb-1">
                  هذا الحساب مؤهل لبرنامج أرباح المشاهدات في تيك توك
                </p>
                <p className="text-xs text-green-600 dark:text-green-500 leading-relaxed">
                  يمكن تحقيق أرباح من المشاهدات المؤهلة حسب سياسات تيك توك الحالية.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Features ── */}
        <div className="mb-6">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">مميزات الحساب</h2>
          <ul className="grid grid-cols-2 gap-2">
            {PLATFORM_FEATURES.map((feat) => (
              <li key={feat} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                {feat}
              </li>
            ))}
          </ul>
        </div>

        {/* ── Share URL hint ── */}
        <div className="mb-6 bg-muted/30 rounded-xl px-4 py-3 border border-dashed border-border">
          <p className="text-[10px] text-muted-foreground mb-1">رابط الحساب القابل للمشاركة</p>
          <p className="font-mono text-xs text-foreground break-all" dir="ltr">
            {typeof window !== "undefined" ? window.location.href : `/account/${account.id}`}
          </p>
        </div>

        {/* ── Sticky action buttons ── */}
        <div className="fixed bottom-0 inset-x-0 z-50 bg-background/95 backdrop-blur-sm border-t px-4 py-3 safe-area-inset-bottom">
          <div className="max-w-2xl mx-auto flex flex-col gap-2">
            {account.accountUrl && (
              <a
                href={account.accountUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-muted-foreground hover:text-primary"
              >
                <PlatformIcon className={`w-4 h-4 ${platformColor}`} />
                زيارة الحساب
                <ExternalLink className="w-3.5 h-3.5 opacity-60" />
              </a>
            )}
            <button
              onClick={isSold ? undefined : handleBuy}
              disabled={isSold}
              className={`w-full rounded-xl py-4 text-base font-black transition-colors ${
                isSold
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200 dark:shadow-none"
              }`}
            >
              {isSold ? "غير متوفر حالياً" : "🛒 شراء عبر واتساب"}
            </button>
          </div>
        </div>

      </div>
    </PublicLayout>
  );
}

/* ── Helper component ── */
function InfoRow({
  label, value, icon, ltr, valueClass,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  ltr?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2.5">
      <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
        {icon}
        {label}
      </span>
      <span
        className={`text-xs font-medium truncate max-w-[55%] text-right ${valueClass ?? ""}`}
        dir={ltr ? "ltr" : undefined}
      >
        {value}
      </span>
    </div>
  );
}
