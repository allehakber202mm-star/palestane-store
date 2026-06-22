import { useParams } from "wouter";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  useGetAccount,
  useGetSettings,
  useTrackAccountClick,
} from "@workspace/api-client-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import {
  CheckCircle2, ExternalLink, Users, ArrowRight,
  DollarSign, Globe, Calendar, Tag, Info,
  ZoomIn, ZoomOut, X, Maximize2,
} from "lucide-react";
import { SiTiktok, SiInstagram, SiFacebook } from "react-icons/si";

const TIKTOK_FEATURES = [
  "متابعين حقيقيين 100%",
  "جمهور نشط ومتفاعل",
  "بدون متابعين وهميين أو بوتات",
  "نمو طبيعي وآمن للحساب",
  "مناسب للإعلانات والتسويق",
  "جاهز للاستخدام مباشرة",
];

const MONETIZED_EARNINGS_LINES = [
  "💰 فيه أرباح المشاهدات",
  "💰 كل 10ك مشاهدات على الفيديو بتربح 2.1$",
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

/* ════════════════════════════════════════════════════════
   Lightbox — full-screen image viewer with pinch/zoom
   ════════════════════════════════════════════════════════ */
function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [origin, setOrigin] = useState({ x: 50, y: 50 }); // transform-origin in %
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const lastTouchDist = useRef<number | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const MIN = 1;
  const MAX = 5;
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const zoomIn  = () => setScale(s => clamp(s + 0.5, MIN, MAX));
  const zoomOut = () => { setScale(s => { const ns = clamp(s - 0.5, MIN, MAX); if (ns === 1) setTranslate({ x: 0, y: 0 }); return ns; }); };
  const reset   = () => { setScale(1); setTranslate({ x: 0, y: 0 }); setOrigin({ x: 50, y: 50 }); };

  /* close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", handler); document.body.style.overflow = ""; };
  }, [onClose]);

  /* double-click to zoom to clicked point */
  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (scale > 1) { reset(); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const ox = ((e.clientX - rect.left) / rect.width) * 100;
    const oy = ((e.clientY - rect.top) / rect.height) * 100;
    setOrigin({ x: ox, y: oy });
    setScale(2.5);
  };

  /* mouse drag */
  const onMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, tx: translate.x, ty: translate.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    setTranslate({
      x: dragStart.current.tx + (e.clientX - dragStart.current.x),
      y: dragStart.current.ty + (e.clientY - dragStart.current.y),
    });
  };
  const onMouseUp = () => { isDragging.current = false; };

  /* touch pinch-to-zoom & drag */
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      lastTouchDist.current = d;
    } else if (e.touches.length === 1 && scale > 1) {
      isDragging.current = true;
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, tx: translate.x, ty: translate.y };
    }
  };
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastTouchDist.current !== null) {
      e.preventDefault();
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const ratio = d / lastTouchDist.current;
      lastTouchDist.current = d;
      setScale(s => clamp(s * ratio, MIN, MAX));
    } else if (e.touches.length === 1 && isDragging.current) {
      setTranslate({
        x: dragStart.current.tx + (e.touches[0].clientX - dragStart.current.x),
        y: dragStart.current.ty + (e.touches[0].clientY - dragStart.current.y),
      });
    }
  }, []);
  const onTouchEnd = () => { isDragging.current = false; lastTouchDist.current = null; };

  /* wheel zoom */
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setScale(s => { const ns = clamp(s + delta, MIN, MAX); if (ns === 1) setTranslate({ x: 0, y: 0 }); return ns; });
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* toolbar */}
      <div className="flex items-center justify-between px-4 py-3 gap-3 bg-black/60 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={zoomOut} disabled={scale <= MIN}
            className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors">
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-white/70 text-xs min-w-[3.5rem] text-center font-mono">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} disabled={scale >= MAX}
            className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors">
            <ZoomIn className="w-5 h-5" />
          </button>
          <button onClick={reset} className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors text-xs">
            إعادة
          </button>
        </div>
        <p className="text-white/50 text-xs hidden sm:block">انقر مزدوجاً للتكبير • اسحب للتحريك</p>
        <button onClick={onClose}
          className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* image area */}
      <div
        className="flex-1 overflow-hidden flex items-center justify-center"
        style={{ cursor: scale > 1 ? "grab" : "zoom-in" }}
        onDoubleClick={handleDoubleClick}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onWheel={onWheel}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          style={{
            transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
            transformOrigin: scale === 1 ? "center center" : `${origin.x}% ${origin.y}%`,
            transition: isDragging.current ? "none" : "transform 0.15s ease",
            maxWidth: "100%",
            maxHeight: "100%",
            width: "auto",
            height: "auto",
            objectFit: "contain",
            userSelect: "none",
          } as React.CSSProperties}
          className="select-none"
        />
      </div>

      {/* hint */}
      <p className="text-center text-white/30 text-xs py-2 shrink-0 sm:hidden">
        انقر مزدوجاً للتكبير
      </p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   Main page
   ════════════════════════════════════════════════════════ */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function trackEvent(eventType: "page_view" | "whatsapp_click" | "account_url_click", accountId: number) {
  fetch(`${BASE}/api/stats/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, accountId }),
  }).catch(() => {});
}

export default function AccountDetails() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "", 10);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const { data: account, isLoading, isError } = useGetAccount(id);
  const { data: settings } = useGetSettings();
  const trackClick = useTrackAccountClick();

  // Track page view on load (fire-and-forget)
  useEffect(() => {
    if (!isNaN(id) && id > 0) trackEvent("page_view", id);
  }, [id]);

  const handleBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.href = "/accounts";
  };

  const handleBuy = () => {
    if (!account) return;
    trackClick.mutate({ id: account.id });
    trackEvent("whatsapp_click", account.id);
    const phone = settings?.whatsapp?.replace(/\D/g, "") || "972566112031";
    const platformAr =
      account.platform === "tiktok_monetized" ? "تيك توك أرباح المشاهدات"
      : account.platform === "tiktok" ? "تيك توك"
      : account.platform === "instagram" ? "انستغرام"
      : "فيسبوك";
    const msg = `مرحبا، أود شراء حساب ${platformAr} باسم "${account.name}". السعر: ${account.price} شيكل. المتابعين: ${account.followers}.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
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
          <button onClick={handleBack} className="text-primary underline text-sm">العودة للمتجر</button>
        </div>
      </PublicLayout>
    );
  }

  const isMonetized       = account.platform === "tiktok_monetized";
  const hasActiveEarnings = isMonetized && account.earningsStatus === "active";
  const isSold            = account.status === "sold";

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
    account.followers >= 1_000_000 ? `${(account.followers / 1_000_000).toFixed(1)}M`
    : account.followers >= 1000    ? `${Math.round(account.followers / 1000)}K`
    : `${account.followers}`;

  return (
    <PublicLayout>
      {/* Lightbox */}
      {lightboxOpen && account.imageUrl && (
        <Lightbox src={account.imageUrl} alt={account.name} onClose={() => setLightboxOpen(false)} />
      )}

      <div className="max-w-2xl mx-auto px-4 py-5 pb-32 sm:pb-24">

        {/* Back */}
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowRight className="w-4 h-4" />
          العودة للمتجر
        </button>

        {/* Earnings banner */}
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
                <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">مؤهل في: {account.eligibleCountry}</p>
              )}
            </div>
          </div>
        )}

        {/* ── Image — full natural size, zero crop ── */}
        <div className="relative w-full rounded-2xl bg-muted mb-5 group">
          {account.imageUrl ? (
            <>
              {/* Image: natural width/height, no clipping */}
              <img
                src={account.imageUrl}
                alt={account.name}
                onClick={() => setLightboxOpen(true)}
                className="w-full h-auto block rounded-2xl cursor-zoom-in"
                loading="eager"
                decoding="sync"
              />

              {/* Zoom hint — appears on hover, centered */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl">
                <div className="bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5 text-white" />
                  <span className="text-white text-xs font-medium">عرض كامل</span>
                </div>
              </div>

              {/* Badges — top corners, outside image flow */}
              <span className={`absolute top-3 right-3 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm ${
                isSold ? "bg-destructive" : "bg-green-500"
              }`}>
                {isSold ? "مباع" : "متاح للبيع"}
              </span>
            </>
          ) : (
            /* Placeholder when no image */
            <div className="w-full flex items-center justify-center rounded-2xl border border-border" style={{ minHeight: "200px" }}>
              <PlatformIcon className="w-20 h-20 opacity-10" />
              <span className={`absolute top-3 right-3 text-white text-xs font-bold px-3 py-1 rounded-full ${
                isSold ? "bg-destructive" : "bg-green-500"
              }`}>
                {isSold ? "مباع" : "متاح للبيع"}
              </span>
            </div>
          )}
        </div>

        {/* ── Name + Price ── */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <PlatformIcon className={`w-5 h-5 shrink-0 ${platformColor}`} />
            <div className="min-w-0">
              <h1 className="font-black text-xl sm:text-2xl leading-tight" dir="ltr">{account.name}</h1>
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

        {/* ── Description block — all platforms ── */}
        <div className="mb-5 rounded-2xl border border-border bg-muted/30 overflow-hidden">
          {/* Earnings header — tiktok_monetized only */}
          {isMonetized && (
            <div className="bg-green-50 dark:bg-green-950/40 border-b border-green-200 dark:border-green-800 px-4 py-3">
              {MONETIZED_EARNINGS_LINES.map((line, i) => (
                <p key={i} className="font-bold text-sm text-green-700 dark:text-green-400 leading-snug">
                  {line}
                </p>
              ))}
            </div>
          )}

          {/* Actual description from DB (if present) */}
          {account.description ? (
            <div className="px-4 py-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">وصف الحساب</p>
              <p className="text-sm leading-relaxed whitespace-pre-line text-foreground">
                {account.description}
              </p>
            </div>
          ) : (
            /* Fallback: platform feature bullets */
            <div className="px-4 py-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">مميزات الحساب</p>
              <ul className="space-y-2">
                {TIKTOK_FEATURES.map((feat) => (
                  <li key={feat} className="flex items-center gap-2 text-sm font-medium">
                    <span className="text-green-500 text-base leading-none shrink-0">✓</span>
                    {feat}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

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
            {isMonetized && account.avgEarningsPer10k != null && (
              <InfoRow
                label="متوسط الربح / 10,000 مشاهدة"
                icon={<DollarSign className="w-3 h-3" />}
                value={`${account.avgEarningsPer10k}₪`}
                valueClass="text-green-600 font-bold"
              />
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


        {/* ── Share URL ── */}
        <div className="mb-6 bg-muted/30 rounded-xl px-4 py-3 border border-dashed border-border">
          <p className="text-[10px] text-muted-foreground mb-1">رابط الحساب القابل للمشاركة</p>
          <p className="font-mono text-xs text-foreground break-all" dir="ltr">
            {typeof window !== "undefined" ? window.location.href : `/account/${account.id}`}
          </p>
        </div>

        {/* ── Sticky action buttons ── */}
        <div className="fixed bottom-0 inset-x-0 z-50 bg-background/95 backdrop-blur-sm border-t px-4 py-3">
          <div className="max-w-2xl mx-auto flex flex-col gap-2">
            {account.accountUrl && (
              <a
                href={account.accountUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent("account_url_click", account.id)}
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

/* ── InfoRow helper ── */
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
        {icon}{label}
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
