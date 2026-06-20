import { useState } from "react";
import { Account, useTrackAccountClick, useGetSettings } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { SiTiktok, SiInstagram, SiFacebook } from "react-icons/si";
import { AccountModal } from "./AccountModal";

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
  const [modalOpen, setModalOpen] = useState(false);
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
      ? `${Math.round(account.followers / 1000)}K`
      : `${account.followers}`;

  return (
    <>
      <AccountModal
        account={account}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />

      <div className="group overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:shadow-md hover:border-primary/40 flex flex-col">

        {/* ── Image (click to open modal) ── */}
        <button
          className="relative bg-muted overflow-hidden flex items-center justify-center shrink-0 w-full cursor-pointer"
          style={{ height: "160px" }}
          onClick={() => setModalOpen(true)}
          aria-label={`عرض تفاصيل ${account.name}`}
          type="button"
        >
          {account.imageUrl ? (
            <img
              src={account.imageUrl}
              alt={account.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <PlatformIcon className="w-12 h-12 opacity-10" />
          )}

          {/* Hover overlay hint */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-bold bg-black/50 px-2 py-1 rounded-full">
              عرض التفاصيل
            </span>
          </div>

          {/* Followers badge */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            <Badge className="bg-black/65 hover:bg-black/70 text-white border-none text-[10px] px-1.5 py-0 leading-5">
              {followersLabel} متابع
            </Badge>
            {account.featured && (
              <Badge className="bg-yellow-500/90 text-white border-none text-[10px] px-1.5 py-0 leading-5">
                مميز ★
              </Badge>
            )}
          </div>

          {/* Status badge */}
          <div className="absolute top-2 right-2">
            <Badge className={`border-none text-[10px] px-1.5 py-0 leading-5 ${
              isSold ? "bg-destructive/90 text-white" : "bg-green-500/90 text-white"
            }`}>
              {isSold ? "مباع" : "متاح"}
            </Badge>
          </div>
        </button>

        {/* ── Body ── */}
        <div className="p-3 sm:p-4 flex flex-col gap-2.5 flex-1">

          {/* Name + Price */}
          <div className="flex items-start justify-between gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <PlatformIcon className={`w-3.5 h-3.5 shrink-0 ${platformColor}`} />
              <span className="font-bold text-sm leading-tight truncate" dir="ltr">
                {account.name}
              </span>
            </div>
            <span className="font-black text-sm text-primary shrink-0 whitespace-nowrap">
              {account.price}₪
            </span>
          </div>

          {/* Description — always visible, no clamp */}
          {account.description && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {account.description}
            </p>
          )}

          {/* Features with ✓ — always visible */}
          <ul className="flex flex-col gap-1">
            {PLATFORM_FEATURES.map((feat) => (
              <li key={feat} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                {feat}
              </li>
            ))}
          </ul>

          {/* Visit account */}
          {account.accountUrl && (
            <a
              href={account.accountUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold border border-border hover:border-primary/60 hover:bg-primary/5 transition-colors text-muted-foreground hover:text-primary"
            >
              <PlatformIcon className={`w-3 h-3 shrink-0 ${platformColor}`} />
              زيارة الحساب
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          )}

          {/* Buy button */}
          <button
            onClick={isSold ? undefined : handleBuyClick}
            disabled={isSold}
            className={`w-full mt-auto rounded-lg py-2.5 text-xs font-bold transition-colors ${
              isSold
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-primary hover:bg-primary/90 text-primary-foreground"
            }`}
          >
            {isSold ? "غير متوفر" : "اشتري عبر واتساب"}
          </button>
        </div>
      </div>
    </>
  );
}
