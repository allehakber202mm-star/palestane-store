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
// AdCard
// Detects the thumbnail's natural aspect ratio and adjusts the card height so
// the video is never cropped.  Vertical (9:16) content gets a tall card;
// horizontal (16:9) content gets a wide card. A blurred copy of the thumbnail
// fills any remaining space so there are no black/grey bars.
// ─────────────────────────────────────────────────────────────────────────────
function AdCard({ ad, onClick }: { ad: Ad; onClick: () => void }) {
  const thumbnail = useVideoThumbnail(ad.videoUrl, ad.thumbnailUrl);

  // null = not yet detected, true = vertical (9:16), false = horizontal (16:9)
  const [isVertical, setIsVertical] = useState<boolean | null>(null);

  function handleImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    // Consider "vertical" when taller than wide with ≥10 % margin
    setIsVertical(naturalHeight > naturalWidth * 1.1);
  }

  // Aspect ratio class:
  //   - null / vertical → 9:16  (tall card — no cropping for portrait content)
  //   - horizontal      → 16:9
  const thumbAspect = isVertical === false ? "aspect-video" : "aspect-[9/16]";

  return (
    <div
      className="group bg-card border rounded-2xl overflow-hidden shadow-sm hover:shadow-lg
                 transition-all duration-200 flex flex-col cursor-pointer"
      onClick={onClick}
    >
      {/* ── Thumbnail ───────────────────────────────────────────────────────── */}
      <div className={`relative w-full ${thumbAspect} overflow-hidden bg-zinc-900`}>
        {/* Blurred fill — covers the background behind the contained image */}
        {thumbnail && (
          <img
            src={thumbnail}
            aria-hidden
            className="pointer-events-none select-none
                       absolute inset-0 w-full h-full
                       object-cover scale-110 blur-3xl opacity-55"
          />
        )}

        {/* Actual thumbnail — fully contained, never cropped */}
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={ad.title}
            loading="lazy"
            onLoad={handleImgLoad}
            className="relative z-10 w-full h-full object-contain"
          />
        ) : (
          /* Spinner while extracting */
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-9 h-9 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        )}

        {/* Play button — centred, visible on hover */}
        <div
          className="absolute inset-0 z-20 flex items-center justify-center
                     bg-black/5 group-hover:bg-black/30 transition-colors duration-200"
        >
          <div
            className="bg-white/90 group-hover:bg-white rounded-full shadow-2xl
                       transition-all duration-200 group-hover:scale-110 group-active:scale-95
                       p-4 sm:p-5"
          >
            <Play className="w-8 h-8 sm:w-10 sm:h-10 text-primary fill-primary" />
          </div>
        </div>
      </div>

      {/* ── Info ────────────────────────────────────────────────────────────── */}
      <div className="p-4 flex flex-col flex-1 gap-2">
        <h3 className="font-bold text-base line-clamp-2 leading-snug">{ad.title}</h3>
        {ad.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 flex-1">{ad.description}</p>
        )}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="w-3.5 h-3.5" />
            {formatDate(ad.createdAt)}
          </span>
          <Button
            size="sm"
            className="gap-1.5 h-8 text-xs"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="rounded-2xl aspect-[9/16]" />
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

        {/* Grid
            Using 2 columns on sm and up — vertical cards are wide enough to
            show faces/text clearly without squishing them into 3 narrow cols. */}
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
