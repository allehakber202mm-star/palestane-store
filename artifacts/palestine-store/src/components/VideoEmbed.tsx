import { useState, useEffect, useRef } from "react";
import { ExternalLink, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  detectVideoType,
  isValidVideoUrl,
  TYPE_COLORS,
  TYPE_ICONS,
  type VideoType,
  type VideoInfo,
} from "@/lib/videoUtils";

export { detectVideoType, isValidVideoUrl };
export type { VideoType, VideoInfo };

// ─────────────────────────────────────────────────────────────────────────────
// BlurredVideoPlayer
// Shows a direct MP4 with blurred background filling any letterbox gaps.
// ─────────────────────────────────────────────────────────────────────────────
interface BlurredVideoPlayerProps {
  src: string;
  thumbnail?: string | null;
  autoPlay?: boolean;
  onError: () => void;
}

function BlurredVideoPlayer({ src, thumbnail, autoPlay, onError }: BlurredVideoPlayerProps) {
  const [loading, setLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Sync blur video to main video so they stay in step (best-effort)
  useEffect(() => { setLoading(true); }, [src]);

  return (
    <div className="relative w-full overflow-hidden bg-zinc-950">
      {/* ── Blurred fill layer (thumbnail → poster → nothing) ─────────────── */}
      {thumbnail ? (
        <img
          src={thumbnail}
          aria-hidden
          className="pointer-events-none select-none absolute inset-0 w-full h-full object-cover scale-110 blur-3xl opacity-60"
        />
      ) : (
        /* fallback: second hidden video used as blur source */
        <video
          src={src}
          muted
          playsInline
          preload="none"
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none select-none absolute inset-0 w-full h-full object-cover scale-110 blur-3xl opacity-60"
        />
      )}

      {/* ── Loading spinner ───────────────────────────────────────────────── */}
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-white/60 animate-spin" />
        </div>
      )}

      {/* ── Main video ───────────────────────────────────────────────────── */}
      <video
        ref={videoRef}
        key={src}
        src={src}
        controls
        playsInline
        preload="metadata"
        autoPlay={autoPlay}
        muted={autoPlay}
        className="relative z-10 w-full max-h-[78vh] object-contain"
        onLoadedMetadata={() => setLoading(false)}
        onCanPlay={() => setLoading(false)}
        onError={(e) => {
          const v = e.currentTarget as HTMLVideoElement;
          console.error("[VideoEmbed] error", v.error?.code, v.error?.message, src);
          setLoading(false);
          onError();
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BlurredIframePlayer
// iFrame (YouTube / Instagram / Facebook / TikTok) with blurred thumbnail bg.
// ─────────────────────────────────────────────────────────────────────────────
interface BlurredIframePlayerProps {
  embedUrl: string;
  thumbnail?: string | null;
}

function BlurredIframePlayer({ embedUrl, thumbnail }: BlurredIframePlayerProps) {
  return (
    <div className="relative w-full aspect-video overflow-hidden bg-zinc-950">
      {thumbnail && (
        <img
          src={thumbnail}
          aria-hidden
          className="pointer-events-none select-none absolute inset-0 w-full h-full object-cover scale-110 blur-3xl opacity-60"
        />
      )}
      <iframe
        key={embedUrl}
        src={embedUrl}
        className="relative z-10 w-full h-full"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VideoEmbed — public API
// ─────────────────────────────────────────────────────────────────────────────
interface VideoEmbedProps {
  url: string;
  /** Used as blurred background behind the video to fill letterbox gaps */
  thumbnail?: string | null;
  autoPlay?: boolean;
}

export function VideoEmbed({ url, thumbnail, autoPlay = true }: VideoEmbedProps) {
  const info = detectVideoType(url);
  const [videoError, setVideoError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => { setVideoError(false); setRetryKey(0); }, [url]);

  if (!url) {
    return (
      <div className="w-full aspect-video bg-zinc-950 flex flex-col items-center justify-center gap-3 text-white/50">
        <AlertTriangle className="w-10 h-10" />
        <p className="text-sm">لا يوجد رابط فيديو</p>
      </div>
    );
  }

  if (!info.canEmbed) {
    return (
      <div className="w-full aspect-video bg-zinc-950 flex flex-col items-center justify-center gap-5 p-6">
        <p className="text-white font-semibold text-lg">
          {info.label === "TikTok" ? "🎵" : "📱"} {info.label}
        </p>
        <p className="text-white/60 text-sm">هذا الرابط يحتاج فتح التطبيق مباشرة</p>
        <Button asChild className="gap-2">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4" />
            فتح {info.label}
          </a>
        </Button>
      </div>
    );
  }

  if (info.type === "mp4") {
    if (videoError) {
      return (
        <div className="w-full aspect-video bg-zinc-950 flex flex-col items-center justify-center gap-4 p-6">
          <AlertTriangle className="w-12 h-12 text-red-400" />
          <div className="text-center space-y-1">
            <p className="text-white font-semibold text-base">تعذّر تشغيل الفيديو</p>
            <p className="text-white/40 text-xs">تحقق من الاتصال أو حاول مرة أخرى</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => { setVideoError(false); setRetryKey((k) => k + 1); }}
          >
            <RefreshCw className="w-4 h-4" />
            إعادة المحاولة
          </Button>
        </div>
      );
    }

    return (
      <BlurredVideoPlayer
        key={`${url}-${retryKey}`}
        src={info.embedUrl}
        thumbnail={thumbnail}
        autoPlay={autoPlay}
        onError={() => setVideoError(true)}
      />
    );
  }

  // iframe (YouTube / TikTok / Instagram / Facebook)
  return (
    <BlurredIframePlayer
      key={`${info.embedUrl}-${retryKey}`}
      embedUrl={info.embedUrl}
      thumbnail={thumbnail}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VideoTypeBadge
// ─────────────────────────────────────────────────────────────────────────────
export function VideoTypeBadge({ url }: { url: string }) {
  if (!url.trim()) return null;
  const { type, canEmbed } = detectVideoType(url);
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[type]}`}>
      {TYPE_ICONS[type]}
      {!canEmbed && " (يُفتح خارجياً)"}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VideoEmbedLoading
// ─────────────────────────────────────────────────────────────────────────────
export function VideoEmbedLoading() {
  return (
    <div className="w-full aspect-video bg-zinc-950 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
    </div>
  );
}
