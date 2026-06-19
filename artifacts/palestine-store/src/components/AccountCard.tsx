import { Account, useTrackAccountClick, useGetSettings } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
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
      account.platform === "tiktok" ? "تيك توك" :
      account.platform === "instagram" ? "انستغرام" : "فيسبوك";
      
    const message = `مرحبا، أود شراء حساب ${platformAr} باسم "${account.name}". السعر: ${account.price} شيكل. المتابعين: ${account.followers}.`;
    
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const PlatformIcon = 
    account.platform === "tiktok" ? SiTiktok :
    account.platform === "instagram" ? SiInstagram : SiFacebook;

  const platformColors = {
    tiktok: "text-black dark:text-white",
    instagram: "text-pink-600",
    facebook: "text-blue-600"
  };

  const guarantees = [
    "متابعين حقيقيين",
    "نظيف بدون انتهاكات",
    "شغال لايف",
    "نظيف بالكامل"
  ];

  return (
    <div className="group overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:shadow-md hover:border-primary/50 flex flex-col h-full">
      <div className="relative aspect-[4/3] bg-muted overflow-hidden flex items-center justify-center">
        {account.imageUrl ? (
          <img 
            src={account.imageUrl} 
            alt={account.name} 
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <PlatformIcon className={`w-16 h-16 opacity-20`} />
        )}
        
        {/* Followers Badge */}
        <div className="absolute top-3 left-3 flex flex-col gap-2">
          <Badge className="bg-black/70 hover:bg-black/80 text-white backdrop-blur-sm border-none shadow-sm font-semibold">
            {account.followers >= 1000 
              ? `${(account.followers / 1000).toFixed(1)}k متابع` 
              : `${account.followers} متابع`}
          </Badge>
          {account.featured && (
            <Badge className="bg-accent/90 hover:bg-accent text-white backdrop-blur-sm border-none shadow-sm">
              مميز
            </Badge>
          )}
        </div>
        
        {/* Status Badge */}
        <div className="absolute top-3 right-3">
          <Badge className={
            account.status === "available" 
              ? "bg-green-500/90 hover:bg-green-500 text-white" 
              : "bg-destructive/90 hover:bg-destructive text-white"
          }>
            {account.status === "available" ? "متاح" : "تم البيع"}
          </Badge>
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <PlatformIcon className={`w-4 h-4 ${platformColors[account.platform]}`} />
            <h3 className="font-bold text-lg line-clamp-1" dir="ltr">{account.name}</h3>
          </div>
          <span className="font-bold text-lg text-primary">{account.price} ₪</span>
        </div>

        {account.description && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            {account.description}
          </p>
        )}

        <div className="space-y-1 mb-4 flex-1">
          {guarantees.map((g, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check className="w-3.5 h-3.5 text-primary" />
              <span>{g}</span>
            </div>
          ))}
        </div>

        {account.status === "available" ? (
          <Button 
            className="w-full font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm hover:shadow"
            onClick={handleBuyClick}
          >
            اشتري الآن
          </Button>
        ) : (
          <Button disabled className="w-full font-bold" variant="secondary">
            غير متوفر
          </Button>
        )}
      </div>
    </div>
  );
}