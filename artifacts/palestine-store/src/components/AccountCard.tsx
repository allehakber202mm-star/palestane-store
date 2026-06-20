import { Account, useTrackAccountClick, useGetSettings } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { SiTiktok, SiInstagram, SiFacebook } from "react-icons/si";

interface AccountCardProps {
  account: Account;
}

export function AccountCard({ account }: AccountCardProps) {
  const { data: settings } = useGetSettings();
  const trackClick = useTrackAccountClick();

  const handleBuyClick = () => {
    trackClick.mutate({ id: account.id });
    const phone = settings?.whatsapp?.replace(/\D/g, "") || "972566112031";
    const platformAr =
      account.platform === "tiktok" ? "تيك توك"
      : account.platform === "instagram" ? "انستغرام"
      : "فيسبوك";
    const message = `مرحبا، أود شراء حساب ${platformAr} باسم "${account.name}". السعر: ${account.price} شيكل. المتابعين: ${account.followers}.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const PlatformIcon =
    account.platform === "tiktok" ? SiTiktok
    : account.platform === "instagram" ? SiInstagram
    : SiFacebook;

  const platformColor =
    account.platform === "tiktok" ? "text-foreground"
    : account.platform === "instagram" ? "text-pink-600"
    : "text-blue-600";

  const isSold = account.status === "sold";

  const followersLabel =
    account.followers >= 1_000_000
      ? `${(account.followers / 1_000_000).toFixed(1)}M`
      : account.followers >= 1000
      ? `${(account.followers / 1000).toFixed(0)}K`
      : `${account.followers}`;

  return (
    <div className="group overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:shadow-md hover:border-primary/40 flex flex-col">
      {/* ── Image ── */}
      <div className="relative h-[140px] sm:h-[180px] bg-muted overflow-hidden flex items-center justify-center shrink-0">
        {account.imageUrl ? (
          <img
            src={account.imageUrl}
            alt={account.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <PlatformIcon className="w-10 h-10 sm:w-14 sm:h-14 opacity-15" />
        )}

        {/* Top-left: followers */}
        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
          <Badge className="bg-black/65 hover:bg-black/70 text-white border-none text-[10px] px-1.5 py-0 leading-5">
            {followersLabel} متابع
          </Badge>
          {account.featured && (
            <Badge className="bg-yellow-500/90 text-white border-none text-[10px] px-1.5 py-0 leading-5">
              مميز ★
            </Badge>
          )}
        </div>

        {/* Top-right: status */}
        <div className="absolute top-1.5 right-1.5">
          <Badge className={`border-none text-[10px] px-1.5 py-0 leading-5 ${
            isSold
              ? "bg-destructive/90 text-white"
              : "bg-green-500/90 text-white"
          }`}>
            {isSold ? "مباع" : "متاح"}
          </Badge>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-2.5 sm:p-3.5 flex flex-col gap-1.5 sm:gap-2 flex-1">
        {/* Name + Price row */}
        <div className="flex items-start justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <PlatformIcon className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${platformColor}`} />
            <span className="font-bold text-xs sm:text-sm line-clamp-1 leading-tight" dir="ltr">
              {account.name}
            </span>
          </div>
          <span className="font-black text-xs sm:text-sm text-primary shrink-0 whitespace-nowrap">
            {account.price}₪
          </span>
        </div>

        {/* Description — hidden on mobile, 2 lines on sm+ */}
        {account.description && (
          <p className="hidden sm:block text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
            {account.description}
          </p>
        )}

        {/* Buy button */}
        <button
          onClick={isSold ? undefined : handleBuyClick}
          disabled={isSold}
          className={`w-full mt-auto rounded-lg py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold transition-colors ${
            isSold
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary hover:bg-primary/90 text-primary-foreground"
          }`}
        >
          {isSold ? "غير متوفر" : "اشتري عبر واتساب"}
        </button>
      </div>
    </div>
  );
}
