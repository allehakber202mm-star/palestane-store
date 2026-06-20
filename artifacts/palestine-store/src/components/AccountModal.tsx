import { Account, useGetSettings, useTrackAccountClick } from "@workspace/api-client-react";
import { CheckCircle2, ExternalLink, Users, X } from "lucide-react";
import { SiTiktok, SiInstagram, SiFacebook } from "react-icons/si";

interface AccountModalProps {
  account: Account | null;
  open: boolean;
  onClose: () => void;
}

const PLATFORM_FEATURES = [
  "متابعين حقيقيين",
  "شغال لايف",
  "نظيف بالكامل",
  "بدون انتهاكات",
];

export function AccountModal({ account, open, onClose }: AccountModalProps) {
  const { data: settings } = useGetSettings();
  const trackClick = useTrackAccountClick();

  if (!open || !account) return null;

  const phone = settings?.whatsapp?.replace(/\D/g, "") || "972566112031";

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

  const handleBuy = () => {
    trackClick.mutate({ id: account.id });
    const message = `مرحبا، أود شراء حساب ${platformAr} باسم "${account.name}". السعر: ${account.price} شيكل. المتابعين: ${account.followers}.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal panel — stop propagation so clicks inside don't close */}
      <div
        className="relative w-full max-w-md bg-card rounded-2xl shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 left-3 z-10 rounded-full bg-black/50 text-white w-8 h-8 flex items-center justify-center hover:bg-black/70 transition-colors"
          aria-label="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Image */}
        <div className="relative h-52 sm:h-64 bg-muted flex items-center justify-center shrink-0">
          {account.imageUrl ? (
            <img
              src={account.imageUrl}
              alt={account.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <PlatformIcon className="w-20 h-20 opacity-10" />
          )}
          {/* Status overlay */}
          <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
          <span className={`absolute bottom-3 right-3 text-white text-xs font-bold px-2.5 py-1 rounded-full ${
            isSold ? "bg-destructive" : "bg-green-500"
          }`}>
            {isSold ? "مباع" : "متاح"}
          </span>
          {account.featured && (
            <span className="absolute bottom-3 left-3 text-white text-xs font-bold px-2.5 py-1 rounded-full bg-yellow-500">
              مميز ★
            </span>
          )}
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-4">

          {/* Platform + Name + Price */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <PlatformIcon className={`w-5 h-5 shrink-0 ${platformColor}`} />
              <div className="min-w-0">
                <p className="font-black text-base leading-snug truncate" dir="ltr">{account.name}</p>
                <p className="text-xs text-muted-foreground">{platformAr}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-black text-xl text-primary">{account.price}₪</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-4 py-3">
            <Users className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-bold">{followersLabel} متابع</span>
          </div>

          {/* Description */}
          {account.description && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">الوصف</p>
              <p className="text-sm leading-relaxed">{account.description}</p>
            </div>
          )}

          {/* Features */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">المميزات</p>
            <ul className="grid grid-cols-2 gap-1.5">
              {PLATFORM_FEATURES.map((feat) => (
                <li key={feat} className="flex items-center gap-1.5 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  {feat}
                </li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1">
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
              className={`w-full rounded-xl py-3 text-sm font-bold transition-colors ${
                isSold
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground"
              }`}
            >
              {isSold ? "غير متوفر" : "اشتري عبر واتساب"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
