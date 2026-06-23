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

// ── Modal ────────────────────────────────────────────────────────────────────
function VideoModal({ ad, onClose }: { ad: Ad; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-black rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 bg-black/60 hover:bg-black/90 text-white rounded-full p-1.5 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <VideoEmbed
          url={ad.videoUrl}
          className="w-full max-h-[72vh] object-contain bg-black aspect-video"
        />
        <div className="p-4 bg-background">
          <h3 className="font-bold text-lg leading-snug">{ad.title}</h3>
          {ad.description && (
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {ad.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Card with auto-thumbnail ─────────────────────────────────────────────────
function AdCard({ ad, onClick }: { ad: Ad; onClick: () => void }) {
  const thumbnail = useVideoThumbnail(ad.videoUrl, ad.thumbnailUrl);

  return (
    <div className="group bg-card border rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col cursor-pointer">
      {/* Thumbnail area — always 16:9 */}
      <div
        className="relative w-full aspect-video overflow-hidden bg-black"
        onClick={onClick}
      >
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={ad.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          /* Gradient placeholder while extracting */
          <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900" />
        )}

        {/* Play overlay — always visible */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors duration-200">
          <div className="bg-white/90 group-hover:bg-white rounded-full p-4 shadow-xl transition-all duration-200 group-hover:scale-110">
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
          <Button size="sm" onClick={onClick} className="gap-1.5 h-8 text-xs">
            <Play className="w-3.5 h-3.5 fill-current" />
            مشاهدة
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function CelebrityAds() {
  const { data: ads, isLoading } = useListCelebrityAds();
  const [activeAd, setActiveAd] = useState<Ad | null>(null);

  return (
    <PublicLayout>
      {activeAd && <VideoModal ad={activeAd} onClose={() => setActiveAd(null)} />}

      <div className="container mx-auto px-4 py-10 max-w-6xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center mb-2">
            <span className="text-5xl">🎥</span>
          </div>
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
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
          </div>
        )}

        {/* Empty */}
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
