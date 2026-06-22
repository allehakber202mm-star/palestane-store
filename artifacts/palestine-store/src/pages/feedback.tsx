import { useEffect, useState, useCallback } from "react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { useListFeedback } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListFeedbackQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, MessageCircle, X, ChevronLeft, ChevronRight, ZoomIn, Play } from "lucide-react";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type FeedbackPost = {
  id: number;
  text: string | null;
  imageUrl: string | null;
  videoUrl?: string | null;
  postedAt: string;
};

// ── Lightbox ──────────────────────────────────────────────────────────────
function Lightbox({
  posts,
  initialIndex,
  onClose,
}: {
  posts: FeedbackPost[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(initialIndex);
  const post = posts[idx];

  const prev = useCallback(() => setIdx(i => (i - 1 + posts.length) % posts.length), [posts.length]);
  const next = useCallback(() => setIdx(i => (i + 1) % posts.length), [posts.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") next();
      if (e.key === "ArrowRight") prev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, prev, next]);

  // lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (!post) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close */}
      <button
        className="absolute top-4 left-4 text-white bg-black/40 hover:bg-black/60 rounded-full p-2 transition-colors z-10"
        onClick={onClose}
        aria-label="إغلاق"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Counter */}
      <div className="absolute top-4 right-4 text-white text-sm bg-black/40 px-3 py-1 rounded-full">
        {idx + 1} / {posts.length}
      </div>

      {/* Prev */}
      {posts.length > 1 && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/40 hover:bg-black/60 rounded-full p-3 transition-colors z-10"
          onClick={e => { e.stopPropagation(); prev(); }}
          aria-label="السابق"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Next */}
      {posts.length > 1 && (
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/40 hover:bg-black/60 rounded-full p-3 transition-colors z-10"
          onClick={e => { e.stopPropagation(); next(); }}
          aria-label="التالي"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Content */}
      <div
        className="relative max-w-3xl w-full mx-12 flex flex-col items-center gap-4"
        onClick={e => e.stopPropagation()}
      >
        {post.videoUrl ? (
          <video
            src={post.videoUrl}
            controls
            autoPlay
            className="max-h-[75vh] w-full rounded-xl object-contain"
          />
        ) : post.imageUrl ? (
          <img
            src={post.imageUrl}
            alt="تقييم عميل"
            className="max-h-[75vh] w-full rounded-xl object-contain"
          />
        ) : null}

        {post.text && (
          <div className="bg-black/50 text-white rounded-xl px-5 py-3 text-sm leading-relaxed max-w-xl text-center">
            {post.text}
          </div>
        )}
        <p className="text-white/60 text-xs">{formatDate(post.postedAt)}</p>
      </div>
    </div>
  );
}

// ── Feedback Card — same structure as AccountCard ─────────────────────────
function FeedbackCard({
  post,
  onClick,
}: {
  post: FeedbackPost;
  onClick: () => void;
}) {
  const hasMedia = !!(post.imageUrl || post.videoUrl);

  return (
    <div className="group overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:shadow-md hover:border-primary/40 flex flex-col h-full">
      {/* ── Media (same aspect ratio + structure as AccountCard image) ── */}
      {hasMedia && (
        <div
          className="relative w-full shrink-0 bg-muted overflow-hidden cursor-zoom-in"
          style={{ aspectRatio: "4/3" }}
          onClick={onClick}
        >
          {post.videoUrl ? (
            <>
              <video
                src={post.videoUrl}
                className="w-full h-full object-cover"
                preload="metadata"
                muted
              />
              {/* Play overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="bg-white/90 rounded-full p-3">
                  <Play className="h-7 w-7 text-gray-800 fill-gray-800" />
                </div>
              </div>
            </>
          ) : (
            <img
              src={post.imageUrl!}
              alt="تقييم عميل"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          )}

          {/* Zoom hint — same hover pattern as AccountCard */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors flex items-center justify-center">
            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-bold bg-black/50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <ZoomIn className="h-3 w-3" />
              عرض بالحجم الكامل
            </span>
          </div>
        </div>
      )}

      {/* ── Body ── */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Stars */}
        <div className="flex gap-0.5">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-3 h-3 text-yellow-400 fill-yellow-400" />
          ))}
        </div>

        {/* Text */}
        {post.text ? (
          <p className="text-sm leading-relaxed text-foreground line-clamp-4 flex-1">
            {post.text}
          </p>
        ) : (
          <div className="flex-1" />
        )}

        {/* Date */}
        <p className="text-xs text-muted-foreground mt-auto pt-1 border-t border-border/50">
          {formatDate(post.postedAt)}
        </p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function Feedback() {
  const { data: rawPosts, isLoading } = useListFeedback();
  const qc = useQueryClient();
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => {
      qc.invalidateQueries({ queryKey: getListFeedbackQueryKey() });
    }, 30_000);
    return () => clearInterval(id);
  }, [qc]);

  // Cast to extended type that includes videoUrl
  const posts: FeedbackPost[] = (rawPosts ?? []).map(p => ({
    id: p.id,
    text: p.text ?? null,
    imageUrl: p.imageUrl ?? null,
    videoUrl: (p as unknown as Record<string, unknown>).videoUrl as string | null ?? null,
    postedAt: p.postedAt,
  }));

  // Only posts that have media (for lightbox navigation)
  const mediaPosts = posts.filter(p => p.imageUrl || p.videoUrl);

  const openLightbox = (post: FeedbackPost) => {
    const idx = mediaPosts.findIndex(p => p.id === post.id);
    if (idx !== -1) setLightboxIdx(idx);
  };

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-10 max-w-6xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center gap-1 mb-2">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-6 h-6 text-yellow-400 fill-yellow-400" />
            ))}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black">آراء وتجارب عملائنا</h1>
          <p className="text-muted-foreground text-base max-w-2xl mx-auto leading-relaxed">
            نفخر بثقة عملائنا ونسعى دائماً لتقديم أفضل خدمة وأفضل الحسابات.
            يمكنكم الاطلاع على تجارب العملاء وآرائهم الحقيقية معنا.
          </p>
        </div>

        {/* Loading skeletons — same grid as accounts page */}
        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                <Skeleton className="w-full" style={{ aspectRatio: "4/3" }} />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-3 w-16 rounded" />
                  <Skeleton className="h-3 w-full rounded" />
                  <Skeleton className="h-3 w-3/4 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && posts.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لا يوجد تقييمات حتى الآن.</p>
          </div>
        )}

        {/* Grid — same as accounts page */}
        {!isLoading && posts.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {posts.map(post => (
              <FeedbackCard
                key={post.id}
                post={post}
                onClick={() => openLightbox(post)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <Lightbox
          posts={mediaPosts}
          initialIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </PublicLayout>
  );
}
