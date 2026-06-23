import { PublicLayout } from "@/components/layout/PublicLayout";
import { useListCelebrityAds, CelebrityAd } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Play, Video, CalendarDays, X } from "lucide-react";
import { useState } from "react";
import { VideoEmbed } from "@/components/VideoEmbed";
import { useVideoThumbnail } from "@/hooks/useVideoThumbnail";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ar-EG", {
    year: "numeric", month: "long", day: "numeric",
  });
}

type Ad = CelebrityAd;

// ── Blurred thumbnail frame ────────────────────────────────────────────────────
// Shows the image contained, with a blurred copy filling the surrounding space.
// Works great for vertical (9:16) videos inside a 16:9 card.
interface BlurredThumbnailProps {
  src: string | null;
  alt: string;
  loading?: boolean;
}
function BlurredThumbnail({ src, alt, loading }: BlurredThumbnailProps) {
  return (
    <div className="relative w-full h-full overflow-hidden bg-zinc-900">
      {/* Blurred fill layer */}
      {src && (
        <img
          src={src}
          aria-hidden
          className="pointer-events-none select-none absolute inset-0 w-full h-full object-cover scale-110 blur-3xl opacity-60"
        />
      )}
      {/* Contained actual thumbnail */}
      {src ? (
        <img
          src={src}
          alt={alt}
          className="relative z-10 w-full h-full object-contain"
          loading="lazy"
        />
      ) : (
        /* Gradient placeholder while extracting / no thumbnail yet */
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
          {loading && (
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          )}
        </div>
      )}
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────────
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
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-30 bg-black/60 hover:bg-black/90 text-white rounded-full p-1.5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Video player — blurred bg built into VideoEmbed */}
        <VideoEmbed url={ad.videoUrl} thumbnail={thumbnail} autoPlay />

        {/* Info bar */}
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

// ── Ad card ────────────────────────────────────────────────────────────────────
function AdCard({ ad, onClick }: { ad: Ad; onClick: () => void }) {
  const thumbnail = useVideoThumbnail(ad.videoUrl, ad.thumbnailUrl);

  return (
    <div
      className="group bg-card border rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col cursor-pointer"
      onClick={onClick}
    >
      {/* Thumbnail — 16:9 frame with blurred bg for any aspect ratio */}
      <div className="relative w-full aspect-video overflow-hidden">
        <BlurredThumbnail src={thumbnail} alt={ad.title} loading={!thumbnail} />

        {/* Play button overlay */}
        <div className="absolute inset-0 z-20 flex items-center justify-center
                        bg-black/10 group-hover:bg-black/30 transition-colors duration-200">
          <div className="bg-white/90 group-hover:bg-white rounded-full p-4 shadow-xl
                          transition-all duration-200 group-hover:scale-110 group-active:scale-95">
            <Play className="w-8 h-8 text-primary fill-primary" />
          </div>
        </div>
      </div>

      {/* Info */}
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

// ── Page ───────────────────────────────────────────────────────────────────────
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

        {/* Loading skeletons */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && (!ads || ads.length === 0) && (
          <div className="text-center py-24 text-muted-foreground">
            <Video className="w-14 h-14 mx-auto mb-4 opacity-25" />
            <p className="font-medium">لا يوجد فيديوهات حتى الآن.</p>
          </div>
        )}

        {/* Grid */}
        {!isLoading && ads && ads.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {ads.map((ad) => (
              <AdCard key={ad.id} ad={ad} onClick={() => setActiveAd(ad)} />
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
