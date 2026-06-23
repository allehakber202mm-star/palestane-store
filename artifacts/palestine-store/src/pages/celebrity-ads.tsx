import { PublicLayout } from "@/components/layout/PublicLayout";
import { useListCelebrityAds, CelebrityAd } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Video, X } from "lucide-react";
import { useState } from "react";
import { VideoEmbed } from "@/components/VideoEmbed";
import { useVideoThumbnail } from "@/hooks/useVideoThumbnail";

type Ad = CelebrityAd;

// ─────────────────────────────────────────────────────────────────────────────
// VideoModal
// ─────────────────────────────────────────────────────────────────────────────
function VideoModal({ ad, onClose }: { ad: Ad; onClose: () => void }) {
  const thumbnail = useVideoThumbnail(ad.videoUrl, ad.thumbnailUrl);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-3"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-30 bg-black/60 hover:bg-black/90 text-white rounded-full p-1.5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <VideoEmbed url={ad.videoUrl} thumbnail={thumbnail} autoPlay />
        <div className="p-4 bg-background border-t">
          <h3 className="font-bold text-base leading-snug">{ad.title}</h3>
          {ad.description && (
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed line-clamp-3">
              {ad.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AdCard — identical layout and dimensions to AccountCard
// ─────────────────────────────────────────────────────────────────────────────
function AdCard({ ad, onClick }: { ad: Ad; onClick: () => void }) {
  const thumbnail = useVideoThumbnail(ad.videoUrl, ad.thumbnailUrl);

  return (
    <div
      onClick={onClick}
      className="group overflow-hidden rounded-xl border bg-card shadow-sm
                 transition-all hover:shadow-md hover:border-primary/40
                 flex flex-col h-full cursor-pointer"
    >
      {/* ── Thumbnail — same aspectRatio:"4/3" and bg-muted as AccountCard ─── */}
      <div className="relative w-full shrink-0 bg-muted overflow-hidden" style={{ aspectRatio: "4/3" }}>

        {/* Blurred fill behind contained image (fills gaps for vertical videos) */}
        {thumbnail && (
          <img
            src={thumbnail}
            aria-hidden
            className="pointer-events-none select-none
                       absolute inset-0 w-full h-full
                       object-cover scale-110 blur-3xl opacity-60"
          />
        )}

        {/* Contained thumbnail — never cropped */}
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={ad.title}
            loading="lazy"
            className="relative z-10 w-full h-full object-contain
                       transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-muted-foreground/20 border-t-muted-foreground/60 rounded-full animate-spin" />
          </div>
        )}

        {/* Hover overlay — pointer-events-none: never blocks card click */}
        <div className="pointer-events-none absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-white/90 rounded-full shadow-2xl p-2.5 sm:p-3">
              <Play className="w-5 h-5 sm:w-7 sm:h-7 text-primary fill-primary" />
            </div>
          </span>
        </div>

        {/* Play badge — pointer-events-none (card onClick handles it) */}
        <div className="pointer-events-none absolute top-2 right-2 z-20">
          <span className="bg-black/60 text-white text-[10px] sm:text-[11px]
                           px-2 py-0.5 rounded-full font-bold shadow-sm
                           flex items-center gap-1 leading-none">
            <Play className="w-2.5 h-2.5 fill-white" />
            فيديو
          </span>
        </div>
      </div>

      {/* ── Body — same padding as AccountCard ──────────────────────────────── */}
      <div className="p-2.5 sm:p-3 flex flex-col gap-2 flex-1">

        {/* Title */}
        <p className="font-bold text-[11px] sm:text-xs leading-tight line-clamp-2 text-foreground">
          {ad.title}
        </p>

        {/* Description (if any) */}
        {ad.description && (
          <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
            {ad.description}
          </p>
        )}

        <div className="flex-1" />

        {/* Watch button — same style as AccountCard CTA */}
        <button
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className="w-full rounded-lg py-2 sm:py-2.5 text-[11px] sm:text-xs font-bold
                     bg-primary hover:bg-primary/90 text-primary-foreground
                     transition-colors"
        >
          مشاهدة الفيديو
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function CelebrityAds() {
  const { data: ads, isLoading } = useListCelebrityAds();
  const [activeAd, setActiveAd] = useState<Ad | null>(null);

  return (
    <PublicLayout>
      {activeAd && <VideoModal ad={activeAd} onClose={() => setActiveAd(null)} />}

      {/* Page Header — same style as accounts.tsx */}
      <div className="bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-8 sm:py-12">
          <h1 className="text-2xl sm:text-4xl font-black mb-2">إعلانات المشاهير</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            شاهد توصيات وإعلانات صناع المحتوى والمشاهير لمتجر فلسطين للحسابات
          </p>
        </div>
      </div>

      {/* Content — same container/padding as accounts.tsx */}
      <div className="container mx-auto px-3 sm:px-4 py-5 sm:py-8">

        {/* Count bar */}
        {!isLoading && ads && ads.length > 0 && (
          <p className="text-xs text-muted-foreground mb-5">
            {ads.length} {ads.length === 1 ? "فيديو" : "فيديوهات"}
          </p>
        )}

        {/* Loading — same grid + skeleton style as accounts.tsx */}
        {isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="w-full rounded-xl" style={{ aspectRatio: "4/3" }} />
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-7 w-full mt-1" />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && (!ads || ads.length === 0) && (
          <div className="text-center py-20 bg-muted/20 rounded-xl border border-dashed">
            <Video className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-lg font-bold mb-1">لا يوجد فيديوهات</p>
            <p className="text-muted-foreground text-sm">لا يتوفر إعلانات في الوقت الحالي.</p>
          </div>
        )}

        {/* Grid — exactly same as accounts.tsx */}
        {!isLoading && ads && ads.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {ads.map((ad) => (
              <AdCard key={ad.id} ad={ad} onClick={() => setActiveAd(ad)} />
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
