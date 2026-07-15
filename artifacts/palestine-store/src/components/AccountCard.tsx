import { useLocation } from "wouter";
import { Account } from "@workspace/api-client-react";
import { CheckCircle2, DollarSign, Link2 } from "lucide-react";
import { SiTiktok, SiInstagram, SiFacebook, SiSnapchat } from "react-icons/si";

interface AccountCardProps {
  account: Account;
}

const TIKTOK_FEATURES = ["متابعين حقيقيين 100%", "جمهور نشط ومتفاعل", "نمو طبيعي وآمن", "جاهز للاستخدام"];
const TIKTOK_MONETIZED_FEATURES = ["💰 فيه أرباح المشاهدات", "متابعين حقيقيين 100%", "جمهور نشط ومتفاعل", "جاهز للاستخدام"];
const INSTAGRAM_FEATURES = ["متابعين حقيقيين 100%", "جمهور نشط ومتفاعل", "بدون بوتات", "جاهز للاستخدام"];
const FACEBOOK_FEATURES = ["متابعين حقيقيين 100%", "جمهور نشط ومتفاعل", "بدون بوتات", "جاهز للاستخدام"];
const SNAPCHAT_FEATURES = ["متابعين حقيقيين 100%", "جمهور نشط ومتفاعل", "بدون بوتات", "جاهز للاستخدام"];

// Get or create a persistent visitor ID — same key as useSiteTracking ("ps_vid")
function getVisitorId(): string {
  const KEY = "ps_vid";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

// Build a profile URL from accountUrl (stored) or username (fallback)
function buildProfileUrl(
  platform: string,
  username: string | null | undefined,
  accountUrl: string | null | undefined,
): string | null {
  if (accountUrl) return accountUrl;
  if (!username) return null;
  const u = username.replace(/^@/, "");
  if (platform === "tiktok" || platform === "tiktok_monetized") return `https://www.tiktok.com/@${u}`;
  if (platform === "instagram") return `https://www.instagram.com/${u}`;
  if (platform === "facebook") return `https://www.facebook.com/${u}`;
  if (platform === "snapchat") return `https://www.snapchat.com/add/${u}`;
  return null;
}

export function AccountCard({ account }: AccountCardProps) {
  const [, navigate] = useLocation();

  const isMonetized = account.platform === "tiktok_monetized";

  const cardFeatures =
    isMonetized ? TIKTOK_MONETIZED_FEATURES
    : account.platform === "tiktok" ? TIKTOK_FEATURES
    : account.platform === "instagram" ? INSTAGRAM_FEATURES
    : account.platform === "snapchat" ? SNAPCHAT_FEATURES
    : FACEBOOK_FEATURES;

  const PlatformIcon =
    (account.platform === "tiktok" || isMonetized) ? SiTiktok
    : account.platform === "instagram" ? SiInstagram
    : account.platform === "snapchat" ? SiSnapchat
    : SiFacebook;

  const platformColor =
    (account.platform === "tiktok" || isMonetized) ? "text-foreground"
    : account.platform === "instagram" ? "text-pink-600"
    : account.platform === "snapchat" ? "text-yellow-400"
    : "text-blue-600";

  const isSold = account.status === "sold";

  const followersLabel =
    account.followers >= 1_000_000
      ? `${(account.followers / 1_000_000).toFixed(1)}M`
      : account.followers >= 1000
      ? `${Math.round(account.followers / 1000)}K`
      : `${account.followers}`;

  const goToDetails = () => navigate(`/account/${account.id}`);

  // Effective URL: stored accountUrl takes priority, then auto-built from username
  const effectiveUrl = buildProfileUrl(account.platform, account.username, account.accountUrl);

  // Track visit: POST to API first (fire-and-forget), then open the URL
  const handleVisitClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!effectiveUrl) return;

    try {
      await fetch(`/api/accounts/${account.id}/visit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: getVisitorId() }),
      });
    } catch {
      // Don't block navigation on tracking failure
    }

    // Also record in stats table for analytics
    fetch("/api/stats/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: "account_url_click", accountId: account.id }),
    }).catch(() => {});

    window.open(effectiveUrl, "_blank", "noopener,noreferrer");
  };

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

        {/* Hover hint — pointer-events-none so it never blocks clicks under it */}
        <div className="pointer-events-none absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors flex items-center justify-center">
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

        {/* Top-left: Followers + monetized stacked */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
          <span className="bg-black/70 text-white text-xs sm:text-[13px] font-bold px-2 py-1 rounded-full leading-none shadow-sm">
            {followersLabel} متابع
          </span>
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

        {/* Description — real DB value if present, else platform features */}
        {account.description ? (
          <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed line-clamp-3">
            {account.description}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-1 gap-y-0.5">
            {cardFeatures.map((feat) => (
              <li key={feat} className="flex items-center gap-0.5 text-[9px] sm:text-[10px] text-muted-foreground">
                <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-green-500 shrink-0" />
                <span className="truncate">{feat}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex-1" />

        {/* Buttons row */}
        <div className="flex gap-1.5 mt-auto">
          {/* Visit account — always shown for Snapchat, or when URL/username available */}
          {(effectiveUrl || account.platform === "snapchat") && (
            effectiveUrl ? (
              <a
                href={effectiveUrl}
                onClick={handleVisitClick}
                className="flex-1 flex items-center justify-center gap-1 rounded-lg py-2 sm:py-2.5 text-[11px] sm:text-xs font-bold border-2 border-yellow-400/60 hover:border-yellow-400 bg-yellow-50/60 hover:bg-yellow-50 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/30 transition-colors text-yellow-600 dark:text-yellow-400"
              >
                <Link2 className="w-3 h-3 shrink-0" />
                زيارة الحساب
              </a>
            ) : (
              <button
                onClick={goToDetails}
                className="flex-1 flex items-center justify-center gap-1 rounded-lg py-2 sm:py-2.5 text-[11px] sm:text-xs font-bold border-2 border-yellow-400/60 hover:border-yellow-400 bg-yellow-50/60 hover:bg-yellow-50 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/30 transition-colors text-yellow-600 dark:text-yellow-400"
              >
                <Link2 className="w-3 h-3 shrink-0" />
                زيارة الحساب
              </button>
            )
          )}
          {/* Non-Snapchat visit button */}
          {effectiveUrl && account.platform !== "snapchat" && (
            <a
              href={effectiveUrl}
              onClick={handleVisitClick}
              className="flex-1 flex items-center justify-center gap-1 rounded-lg py-2 sm:py-2.5 text-[11px] sm:text-xs font-bold border-2 border-primary/40 hover:border-primary bg-primary/5 hover:bg-primary/10 transition-colors text-primary"
            >
              <Link2 className="w-3 h-3 shrink-0" />
              زيارة الحساب
            </a>
          )}

          {/* CTA — details */}
          <button
            onClick={goToDetails}
            className={`flex-1 rounded-lg py-2 sm:py-2.5 text-[11px] sm:text-xs font-bold transition-colors ${
              isSold
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-primary hover:bg-primary/90 text-primary-foreground"
            }`}
          >
            {isSold ? "غير متوفر" : "عرض التفاصيل"}
          </button>
        </div>
      </div>
    </div>
  );
}
