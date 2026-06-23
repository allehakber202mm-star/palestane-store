import { PublicLayout } from "@/components/layout/PublicLayout";
import { useListCelebrityAds, CelebrityAd } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Play, Video, CalendarDays, X } from "lucide-react";
import { useState } from "react";
import { VideoEmbed } from "@/components/VideoEmbed";
import { useVideoThumbnail } from "@/hooks/useVideoThumbnail";

type Ad = CelebrityAd;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ar-EG", {
    year: "numeric", month: "long", day: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// VideoModal — opens the full video when a card is clicked
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
// AdCard
// Fixed 4:3 thumbnail area — same proportion as AccountCard.
// The thumbnail (any aspect ratio) sits inside with object-contain + blurred
// background so vertical videos show without black bars and cards stay uniform.
// ─────────────────────────────────────────────────────────────────────────────
function AdCard({ ad, onClick }: { ad: Ad; onClick: () => void }) {
  const thumbnail = useVideoThumbnail(ad.videoUrl, ad.thumbnailUrl);

  return (
    <div
      className="group overflow-hidden rounded-xl border bg-card shadow-sm
                 transition-all hover:shadow-md hover:border-primary/40
                 flex flex-col h-full cursor-pointer"
      onClick={onClick}
    >
      {/* ── Thumbnail — fixed 4:3, same as AccountCard ─────────────────────── */}
      <div
        className="relative w-full shrink-0 overflow-hidden bg-zinc-900"
        style={{ aspectRatio: "4/3" }}
      >
        {/* Blurred fill — same image stretched to cover, blurred heavily */}
        {thumbnail && (
          <img
            src={thumbnail}
            aria-hidden
            className="pointer-events-none select-none
                       absolute inset-0 w-full h-full
                       object-cover scale-110 blur-3xl opacity-60"
          />
        )}

        {/* Contained thumbnail — never cropped, preserves original aspect ratio */}
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
            <div className="w-9 h-9 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />

        {/* Play button — centred, always visible, larger on hover */}
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div
            className="bg-white/90 group-hover:bg-white rounded-full shadow-2xl
                       transition-all duration-200 group-hover:scale-110 group-active:scale-95
                       p-3 sm:p-4"
          >
            <Play className="w-7 h-7 sm:w-9 sm:h-9 text-primary fill-primary" />
          </div>
        </div>
      </div>

      {/* ── Info ─────────────────────────────────────────────────────────────── */}
      <div className="p-2.5 sm:p-3 flex flex-col gap-2 flex-1">
        <h3 className="font-bold text-sm sm:text-base line-clamp-2 leading-snug">{ad.title}</h3>
        {ad.description && (
          <p className="text-[11px] sm:text-xs text-muted-foreground line-clamp-2 flex-1 leading-relaxed">
            {ad.description}
          </p>
        )}

        <div className="flex-1" />

        <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
          <span className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
            <CalendarDays className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            {formatDate(ad.createdAt)}
          </span>
          <Button
            size="sm"
            className="gap-1.5 h-7 sm:h-8 text-[11px] sm:text-xs"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
          >
            <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
            مشاهدة
          </Button>
        </div>
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

      <div className="container mx-auto px-4 py-10 max-w-6xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <span className="text-5xl">🎥</span>
          <h1 className="text-3xl sm:text-4xl font-black">إعلانات المشاهير لمتجرنا</h1>
          <p className="text-muted-foreground text-base max-w-2xl mx-auto leading-relaxed">
            نفخر بتعاوننا مع العديد من صناع المحتوى والمشاهير، ويمكنكم مشاهدة بعض الإعلانات والتوصيات الخاصة بمتجر فلسطين للحسابات.
          </p>
          {!isLoading && ads && ads.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {ads.length} {ads.length === 1 ? "فيديو" : "فيديوهات"}
            </p>
          )}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="rounded-xl" style={{ aspectRatio: "4/3" }} />
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && (!ads || ads.length === 0) && (
          <div className="text-center py-24 text-muted-foreground">
            <Video className="w-14 h-14 mx-auto mb-4 opacity-25" />
            <p className="font-medium">لا يوجد فيديوهات حتى الآن.</p>
          </div>
        )}

        {/* Grid — 3 columns, uniform card height */}
        {!isLoading && ads && ads.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {ads.map((ad) => (
              <AdCard key={ad.id} ad={ad} onClick={() => setActiveAd(ad)} />
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
