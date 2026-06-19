import { Account, useTrackAccountClick, useGetSettings } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { SiTiktok, SiInstagram, SiFacebook } from "react-icons/si";

interface AccountCardProps {
  account: Account;
}

const guarantees = [
  "متابعين حقيقيين",
  "نظيف بدون انتهاكات",
  "شغال لايف",
];

export function AccountCard({ account }: AccountCardProps) {
  const { data: settings } = useGetSettings();
  const trackClick = useTrackAccountClick();

  const handleBuyClick = () => {
    trackClick.mutate({ id: account.id });
    const phone = settings?.whatsapp?.replace(/\D/g, "") || "972566112031";

    const platformAr =
      account.platform === "tiktok"
        ? "تيك توك"
        : account.platform === "instagram"
        ? "انستغرام"
        : "فيسبوك";

    const message = `مرحبا، أود شراء حساب ${platformAr} باسم "${account.name}". السعر: ${account.price} شيكل. المتابعين: ${account.followers}.`;

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank"
    );
  };

  const PlatformIcon =
    account.platform === "tiktok"
      ? SiTiktok
      : account.platform === "instagram"
      ? SiInstagram
      : SiFacebook;

  const platformColors: Record<string, string> = {
    tiktok: "text-black dark:text-white",
    instagram: "text-pink-600",
    facebook: "text-blue-600",
  };

  const isSold = account.status === "sold";

  return (
    <div className="group overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:shadow-md hover:border-primary/40 flex flex-col">
      {/* Image */}
      <div className="relative h-40 sm:h-48 bg-muted overflow-hidden flex items-center justify-center">
        {account.imageUrl ? (
          <img
            src={account.imageUrl}
            alt={account.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <PlatformIcon className="w-12 h-12 opacity-15" />
        )}

        {/* Top-left: followers + featured */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          <Badge className="bg-black/65 hover:bg-black/75 text-white backdrop-blur-sm border-none text-[11px] px-2 py-0.5">
            {account.followers >= 1000
              ? `${(account.followers / 1000).toFixed(0)}k متابع`
              : `${account.followers} متابع`}
          </Badge>
          {account.featured && (
            <Badge className="bg-yellow-500/90 text-white border-none text-[10px] px-2 py-0.5">
              مميز ★
            </Badge>
          )}
        </div>

        {/* Top-right: status */}
        <div className="absolute top-2 right-2">
          <Badge
            className={
              isSold
                ? "bg-destructive/90 text-white border-none text-[11px] px-2 py-0.5"
                : "bg-green-500/90 text-white border-none text-[11px] px-2 py-0.5"
            }
          >
            {isSold ? "مباع" : "متاح"}
          </Badge>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 sm:p-4 flex flex-col flex-1 gap-2">
        {/* Name + Price */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <PlatformIcon
              className={`w-3.5 h-3.5 shrink-0 ${platformColors[account.platform]}`}
            />
            <h3
              className="font-bold text-sm sm:text-base line-clamp-1"
              dir="ltr"
            >
              {account.name}
            </h3>
          </div>
          <span className="font-black text-sm sm:text-base text-primary shrink-0">
            {account.price} ₪
          </span>
        </div>

        {/* Description */}
        {account.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {account.description}
          </p>
        )}

        {/* Guarantees */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {guarantees.map((g) => (
            <div
              key={g}
              className="flex items-center gap-1 text-[11px] text-muted-foreground"
            >
              <Check className="w-3 h-3 text-primary shrink-0" />
              <span>{g}</span>
            </div>
          ))}
        </div>

        {/* Button */}
        {isSold ? (
          <Button
            disabled
            size="sm"
            variant="secondary"
            className="w-full text-xs mt-auto"
          >
            غير متوفر
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full font-bold text-xs bg-primary hover:bg-primary/90 mt-auto"
            onClick={handleBuyClick}
          >
            اشتري الآن عبر واتساب
          </Button>
        )}
      </div>
    </div>
  );
}
