import { useParams, useLocation } from "wouter";
import {
  useGetAccount,
  useGetSettings,
  useTrackAccountClick,
} from "@workspace/api-client-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { CheckCircle2, ExternalLink, Users, ArrowRight, Tag, DollarSign, Globe, Calendar } from "lucide-react";
import { SiTiktok, SiInstagram, SiFacebook } from "react-icons/si";

const PLATFORM_FEATURES = [
  "متابعين حقيقيين",
  "شغال لايف",
  "نظيف بالكامل",
  "بدون انتهاكات",
];

export default function AccountDetails() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const id = parseInt(params.id ?? "", 10);

  const { data: account, isLoading, isError } = useGetAccount(id);
  const { data: settings } = useGetSettings();
  const trackClick = useTrackAccountClick();

  const handleBuy = () => {
    if (!account) return;
    trackClick.mutate({ id: account.id });
    const phone = settings?.whatsapp?.replace(/\D/g, "") || "972566112031";
    const platformAr =
      account.platform === "tiktok_monetized" ? "تيك توك أرباح المشاهدات"
      : account.platform === "tiktok" ? "تيك توك"
      : account.platform === "instagram" ? "انستغرام"
      : "فيسبوك";
    const message = `مرحبا، أود شراء حساب ${platformAr} باسم "${account.name}". السعر: ${account.price} شيكل. المتابعين: ${account.followers}.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  if (isLoading) {
    return (
      <PublicLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </PublicLayout>
    );
  }

  if (isError || !account) {
    return (
      <PublicLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4">
          <p className="text-xl font-bold">الحساب غير موجود</p>
          <button
            onClick={() => navigate("/accounts")}
            className="text-primary underline text-sm"
          >
            العودة للمتجر
          </button>
        </div>
      </PublicLayout>
    );
  }

  const isMonetized = account.platform === "tiktok_monetized";
  const hasEarnings = isMonetized && account.earningsStatus === "active";

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

  const isSold = account.status === "sold";

  return (
    <PublicLayout>
      <div className="max-w-lg mx-auto px-4 py-6 pb-28">

        {/* Back button */}
        <button
          onClick={() => navigate("/accounts")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5"
        >
          <ArrowRight className="w-4 h-4" />
          العودة للمتجر
        </button>

        {/* Image */}
        <div className="relative w-full rounded-2xl overflow-hidden bg-muted aspect-[4/3] mb-5">
          {account.imageUrl ? (
            <img
              src={account.imageUrl}
              alt={account.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <PlatformIcon className="w-20 h-20 opacity-10" />
            </div>
          )}
          {/* Gradient overlay */}
          <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-black/60 to-transparent" />
          {/* Status badge */}
          <span className={`absolute bottom-3 right-3 text-white text-xs font-bold px-3 py-1 rounded-full ${
            isSold ? "bg-destructive" : "bg-green-500"
          }`}>
            {isSold ? "مباع" : "متاح"}
          </span>
          {/* Monetized badge */}
          {isMonetized && (
            <span className="absolute bottom-3 left-3 text-white text-xs font-bold px-3 py-1 rounded-full bg-green-700 flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              مفعّل الأرباح
            </span>
          )}
          {account.featured && !isMonetized && (
            <span className="absolute bottom-3 left-3 text-white text-xs font-bold px-3 py-1 rounded-full bg-yellow-500">
              مميز ★
            </span>
          )}
        </div>

        {/* Header: name + price */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <PlatformIcon className={`w-5 h-5 shrink-0 ${platformColor}`} />
            <div className="min-w-0">
              <h1 className="font-black text-lg leading-snug" dir="ltr">{account.name}</h1>
              <p className="text-xs text-muted-foreground">{platformAr}</p>
            </div>
          </div>
          <div className="shrink-0 text-left">
            <p className="font-black text-2xl text-primary leading-none">{account.price}₪</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">السعر</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-3 mb-5">
          <div className="flex-1 flex items-center gap-2 bg-muted/50 rounded-xl px-4 py-3">
            <Users className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="font-black text-base leading-none">{followersLabel}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">متابع</p>
            </div>
          </div>
          <div className="flex-1 flex items-center gap-2 bg-muted/50 rounded-xl px-4 py-3">
            <Tag className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="font-black text-base leading-none">{account.price}₪</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">السعر</p>
            </div>
          </div>
        </div>

        {/* Description */}
        {account.description && (
          <div className="mb-5">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">الوصف</h2>
            <p className="text-sm leading-relaxed">{account.description}</p>
          </div>
        )}

        {/* Earnings info box — only for monetized accounts with active earnings */}
        {isMonetized && (
          <div className={`mb-5 rounded-xl border p-4 ${
            hasEarnings
              ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
              : "bg-muted/30 border-border"
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className={`w-4 h-4 shrink-0 ${hasEarnings ? "text-green-600" : "text-muted-foreground"}`} />
              <h3 className={`font-bold text-sm ${hasEarnings ? "text-green-700 dark:text-green-400" : "text-foreground"}`}>
                {hasEarnings ? "هذا الحساب مفعّل لبرنامج أرباح المشاهدات" : "برنامج أرباح المشاهدات"}
              </h3>
            </div>
            {hasEarnings ? (
              <>
                <p className="text-xs text-green-700 dark:text-green-300 leading-relaxed mb-3">
                  💰 هذا الحساب مؤهل لبرنامج أرباح المشاهدات في تيك توك.<br />
                  يمكن تحقيق أرباح من المشاهدات المؤهلة حسب سياسات تيك توك الحالية.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {account.eligibleCountry && (
                    <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-300">
                      <Globe className="w-3 h-3 shrink-0" />
                      <span>الدولة: <strong>{account.eligibleCountry}</strong></span>
                    </div>
                  )}
                  {account.activationDate && (
                    <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-300">
                      <Calendar className="w-3 h-3 shrink-0" />
                      <span>التفعيل: <strong>{account.activationDate}</strong></span>
                    </div>
                  )}
                </div>
                {account.earningsNotes && (
                  <p className="mt-2 text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 rounded-lg px-3 py-2">
                    {account.earningsNotes}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed">
                هذا الحساب في قسم تيك توك أرباح المشاهدات. تحقق من التفاصيل مع البائع.
              </p>
            )}
          </div>
        )}

        {/* Platform features */}
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">المميزات</h2>
          <ul className="grid grid-cols-2 gap-2">
            {PLATFORM_FEATURES.map((feat) => (
              <li key={feat} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                {feat}
              </li>
            ))}
          </ul>
        </div>

        {/* Account username */}
        <div className="mb-6 bg-muted/40 rounded-xl px-4 py-3">
          <p className="text-xs text-muted-foreground mb-1">اسم المستخدم</p>
          <p className="font-bold text-sm" dir="ltr">{account.name}</p>
        </div>

        {/* Action buttons — sticky at bottom */}
        <div className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur-sm border-t px-4 py-3 flex flex-col gap-2 max-w-lg mx-auto">
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
            className={`w-full rounded-xl py-3.5 text-sm font-bold transition-colors ${
              isSold
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-primary hover:bg-primary/90 text-primary-foreground"
            }`}
          >
            {isSold ? "غير متوفر حالياً" : "🛒 اشتري عبر واتساب"}
          </button>
        </div>
      </div>
    </PublicLayout>
  );
}
