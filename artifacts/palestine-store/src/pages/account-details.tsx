import { useParams, useLocation } from "wouter";
import {
  useGetAccount,
  useGetSettings,
  useTrackAccountClick,
} from "@workspace/api-client-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { CheckCircle2, ExternalLink, Users, ArrowRight, Tag } from "lucide-react";
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
      account.platform === "tiktok" ? "تيك توك"
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

  const PlatformIcon =
    account.platform === "tiktok" ? SiTiktok
    : account.platform === "instagram" ? SiInstagram
    : SiFacebook;

  const platformColor =
    account.platform === "tiktok" ? "text-foreground"
    : account.platform === "instagram" ? "text-pink-500"
    : "text-blue-500";

  const platformAr =
    account.platform === "tiktok" ? "تيك توك"
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
      <div className="max-w-lg mx-auto px-4 py-6 pb-24">

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
          {account.featured && (
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

        {/* Account username (from name field) */}
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
