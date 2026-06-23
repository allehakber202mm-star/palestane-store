import { useState, useEffect } from "react";
import { ExternalLink, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  detectVideoType,
  isValidVideoUrl,
  TYPE_COLORS,
  TYPE_ICONS,
  type VideoType,
  type VideoInfo,
} from "@/lib/videoUtils";

// Re-export so existing imports from @/components/VideoEmbed still work
export { detectVideoType, isValidVideoUrl };
export type { VideoType, VideoInfo };

// ─────────────────────────────────────────────────────────────────────────────
// VideoEmbed — renders the correct player for any supported URL
// ─────────────────────────────────────────────────────────────────────────────
interface VideoEmbedProps {
  url: string;
  className?: string;
  /** In modals the user clicked to open — autoPlay is fine */
  autoPlay?: boolean;
}

export function VideoEmbed({ url, className, autoPlay = true }: VideoEmbedProps) {
  const info = detectVideoType(url);
  const [videoError, setVideoError] = useState(false);
  const [retryKey, setRetryKey]     = useState(0);

  useEffect(() => { setVideoError(false); }, [url]);

  if (!url) {
    return (
      <div className="w-full aspect-video bg-black flex flex-col items-center justify-center gap-3 text-white/50">
        <AlertTriangle className="w-10 h-10" />
        <p className="text-sm">لا يوجد رابط فيديو</p>
      </div>
    );
  }

  if (!info.canEmbed) {
    return (
      <div className="w-full aspect-video bg-black flex flex-col items-center justify-center gap-5 p-6">
        <div className="text-center space-y-2">
          <p className="text-white font-semibold text-lg">
            {info.label === "TikTok" ? "🎵" : "📱"} {info.label}
          </p>
          <p className="text-white/60 text-sm">هذا الرابط يحتاج فتح التطبيق مباشرة</p>
        </div>
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
        <div className="w-full aspect-video bg-black flex flex-col items-center justify-center gap-4 p-6">
          <AlertTriangle className="w-12 h-12 text-red-400" />
          <div className="text-center space-y-1">
            <p className="text-white font-semibold">تعذّر تشغيل الفيديو</p>
            <p className="text-white/50 text-xs break-all max-w-xs">{url}</p>
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
      <video
        key={`${url}-${retryKey}`}
        src={info.embedUrl}
        controls
        playsInline
        preload="metadata"
        {...(autoPlay ? { autoPlay: true, muted: true } : {})}
        className={className ?? "w-full max-h-[70vh] object-contain bg-black"}
        onError={(e) => {
          const v = e.currentTarget as HTMLVideoElement;
          console.error("[VideoEmbed] ❌", url, "code:", v.error?.code, v.error?.message);
          setVideoError(true);
        }}
      />
    );
  }

  return (
    <iframe
      key={`${info.embedUrl}-${retryKey}`}
      src={info.embedUrl}
      className={className ?? "w-full aspect-video"}
      allow="autoplay; fullscreen; encrypted-media; picture-in-picture; web-share"
      allowFullScreen
      loading="lazy"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VideoTypeBadge — small pill showing platform + embed status
// ─────────────────────────────────────────────────────────────────────────────
export function VideoTypeBadge({ url }: { url: string }) {
  if (!url.trim()) return null;
  const { type, canEmbed } = detectVideoType(url);
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[type]}`}
    >
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
    <div className="w-full aspect-video bg-black flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
    </div>
  );
}
