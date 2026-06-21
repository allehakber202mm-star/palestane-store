import { useLocation } from "wouter";
import { Account } from "@workspace/api-client-react";
import { CheckCircle2, ExternalLink, DollarSign } from "lucide-react";
import { SiTiktok, SiInstagram, SiFacebook } from "react-icons/si";

interface AccountCardProps {
  account: Account;
}

const PLATFORM_FEATURES = [
  "متابعين حقيقيين",
  "شغال لايف",
  "نظيف بالكامل",
  "بدون انتهاكات",
];

export function AccountCard({ account }: AccountCardProps) {
  const [, navigate] = useLocation();

  const isMonetized = account.platform === "tiktok_monetized";

  const PlatformIcon =
    (account.platform === "tiktok" || isMonetized) ? SiTiktok
    : account.platform === "instagram" ? SiInstagram
    : SiFacebook;

  const platformColor =
    (account.platform === "tiktok" || isMonetized) ? "text-foreground"
    : account.platform === "instagram" ? "text-pink-600"
    : "text-blue-600";

  const isSold = account.status === "sold";

  const followersLabel =
    account.followers >= 1_000_000
      ? `${(account.followers / 1_000_000).toFixed(1)}M`
      : account.followers >= 1000
      ? `${Math.round(account.followers / 1000)}K`
      : `${account.followers}`;

  const goToDetails = () => navigate(`/account/${account.id}`);

  return (
    <div
      onClick={goToDetails}
      className="group overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:shadow-md hover:border-primary/40 flex flex-col h-full cursor-pointer"
    >
      {/* ── Image ── */}
      <div className="relative w-full shrink-0 bg-muted overflow-hidden" style={{ aspectRatio: "4/3" }}>
        {account.imageUrl ? (
          <img
            src={account.imageUrl}
            alt={account.name}
            className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <PlatformIcon className="w-10 h-10 sm:w-14 sm:h-14 opacity-10" />
          </div>
        )}

        {/* Hover hint */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-bold bg-black/50 px-2 py-0.5 rounded-full">
            عرض التفاصيل
          </span>
        </div>

        {/* Top-right: Status badge */}
        <div className="absolute top-2 right-2">
          <span className={`text-[11px] sm:text-xs px-2 py-0.5 rounded-full font-bold shadow-sm leading-none ${
            isSold ? "bg-destructive text-white" : "bg-green-500 text-white"
          }`}>
            {isSold ? "مباع" : "متاح"}
          </span>
        </div>

        {/* Top-left: Followers + featured + monetized stacked */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
          <span className="bg-black/70 text-white text-xs sm:text-[13px] font-bold px-2 py-1 rounded-full leading-none shadow-sm">
            {followersLabel} متابع
          </span>
          {account.featured && (
            <span className="bg-yellow-500 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full leading-none shadow-sm">
              مميز ★
            </span>
          )}
          {isMonetized && account.earningsStatus === "active" && (
            <span className="bg-green-600 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full leading-none flex items-center gap-0.5 shadow-sm">
              <DollarSign className="w-2.5 h-2.5" />مفعّل الأرباح
            </span>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-2.5 sm:p-3 flex flex-col gap-2 flex-1">

        {/* Price — most prominent element */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <PlatformIcon className={`w-3 h-3 sm:w-4 sm:h-4 shrink-0 ${platformColor}`} />
            <span className="font-bold text-[11px] sm:text-xs leading-tight truncate text-muted-foreground" dir="ltr">
              {account.name}
            </span>
          </div>
          {/* Price: bigger, bolder, primary color */}
          <span className="font-black text-base sm:text-lg text-primary shrink-0 whitespace-nowrap leading-none">
            {account.price}₪
          </span>
        </div>

        {/* Description */}
        {account.description && (
          <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {account.description}
          </p>
        )}

        {/* Features */}
        <ul className="grid grid-cols-2 gap-x-1 gap-y-0.5">
          {PLATFORM_FEATURES.map((feat) => (
            <li key={feat} className="flex items-center gap-0.5 text-[9px] sm:text-[10px] text-muted-foreground">
              <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-green-500 shrink-0" />
              <span className="truncate">{feat}</span>
            </li>
          ))}
        </ul>

        <div className="flex-1" />

        {/* Visit link */}
        {account.accountUrl && (
          <a
            href={account.accountUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="w-full flex items-center justify-center gap-1 rounded-lg py-1.5 text-[10px] sm:text-xs font-bold border border-border hover:border-primary/60 hover:bg-primary/5 transition-colors text-muted-foreground hover:text-primary"
          >
            <PlatformIcon className={`w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 ${platformColor}`} />
            زيارة الحساب
            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
          </a>
        )}

        {/* CTA button */}
        <button
          onClick={goToDetails}
          className={`w-full rounded-lg py-2 sm:py-2.5 text-[11px] sm:text-xs font-bold transition-colors ${
            isSold
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary hover:bg-primary/90 text-primary-foreground"
          }`}
        >
          {isSold ? "غير متوفر" : "عرض التفاصيل"}
        </button>
      </div>
    </div>
  );
}
