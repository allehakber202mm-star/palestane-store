import { useState, useEffect, useRef } from "react";
import { ExternalLink, AlertTriangle, RefreshCw, Loader2, Volume2, VolumeX } from "lucide-react";
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
// Error codes → human-readable Arabic
// ─────────────────────────────────────────────────────────────────────────────
function describeVideoError(code: number | undefined, msg: string | undefined): string {
  switch (code) {
    case 1:  return "تم إيقاف تحميل الفيديو";
    case 2:  return "خطأ في الشبكة — تحقق من اتصالك";
    case 3:  return "صيغة الفيديو غير مدعومة (يجب MP4 H.264)";
    case 4:  return "الفيديو غير متاح أو الرابط منتهٍ";
    default: return msg ?? "خطأ غير معروف";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BlurredVideoPlayer
// ─────────────────────────────────────────────────────────────────────────────
interface BlurredVideoPlayerProps {
  src: string;
  thumbnail?: string | null;
  autoPlay?: boolean;
  onError: (reason: string) => void;
}

function BlurredVideoPlayer({ src, thumbnail, autoPlay = true, onError }: BlurredVideoPlayerProps) {
  const [loading, setLoading] = useState(true);
  const [muted, setMuted]     = useState(autoPlay); // muted on autoPlay; user can unmute
  const videoRef    = useRef<HTMLVideoElement>(null);
  const loadTimer   = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stallTimer  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setLoading(true);
    setMuted(autoPlay);

    // 10-second hard timeout: if metadata never arrives → surface error
    loadTimer.current = setTimeout(() => {
      const reason = `لم يستجب الفيديو خلال 10 ثوانٍ — تحقق من الرابط (${src})`;
      console.error("[VideoEmbed] ⏰ load-timeout:", src);
      onError(reason);
    }, 10_000);

    return () => {
      clearTimeout(loadTimer.current);
      clearTimeout(stallTimer.current);
    };
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  function clearLoad() {
    clearTimeout(loadTimer.current);
    setLoading(false);
  }

  function onWaiting() {
    // Stall: if playing doesn't resume within 15s → error
    stallTimer.current = setTimeout(() => {
      console.error("[VideoEmbed] ⏰ stall-timeout:", src);
      onError("توقّف الفيديو عن التشغيل لأكثر من 15 ثانية — الشبكة بطيئة أو الملف تالف");
    }, 15_000);
  }

  function onPlaying() {
    clearLoad();
    clearTimeout(stallTimer.current);
  }

  function onVideoError(e: React.SyntheticEvent<HTMLVideoElement>) {
    clearLoad();
    clearTimeout(stallTimer.current);
    const v = e.currentTarget as HTMLVideoElement;
    const code = v.error?.code;
    const msg  = v.error?.message;
    const reason = describeVideoError(code, msg);
    console.error(
      `[VideoEmbed] ❌ error — code:${code} msg:"${msg}" src:"${src}"`,
    );
    onError(reason);
  }

  // Sync muted attribute to video element when user toggles
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  return (
    <div className="relative w-full overflow-hidden bg-zinc-950">
      {/* ── Blurred background ─────────────────────────────────────────────── */}
      {thumbnail ? (
        <img
          src={thumbnail}
          aria-hidden
          className="pointer-events-none select-none
                     absolute inset-0 w-full h-full
                     object-cover scale-110 blur-3xl opacity-55"
        />
      ) : (
        <video
          src={src}
          muted
          playsInline
          preload="none"
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none select-none
                     absolute inset-0 w-full h-full
                     object-cover scale-110 blur-3xl opacity-55"
        />
      )}

      {/* ── Loading spinner ────────────────────────────────────────────────── */}
      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/30">
          <Loader2 className="w-10 h-10 text-white/70 animate-spin" />
          <p className="text-white/50 text-xs">جاري تحميل الفيديو…</p>
        </div>
      )}

      {/* ── Main video ─────────────────────────────────────────────────────── */}
      <video
        ref={videoRef}
        key={src}
        src={src}
        controls
        playsInline
        preload="metadata"
        autoPlay={autoPlay}
        muted={muted}
        className="relative z-10 w-full max-h-[80vh] object-contain"
        onLoadedMetadata={clearLoad}
        onCanPlay={clearLoad}
        onPlaying={onPlaying}
        onWaiting={onWaiting}
        onError={onVideoError}
      />

      {/* ── Mute toggle (only shown on autoPlay start so user can unmute) ─── */}
      {autoPlay && !loading && (
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className="absolute bottom-14 right-3 z-30
                     bg-black/60 hover:bg-black/80 text-white
                     rounded-full p-2 transition-colors"
          title={muted ? "تشغيل الصوت" : "كتم الصوت"}
        >
          {muted
            ? <VolumeX className="w-4 h-4" />
            : <Volume2 className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BlurredIframePlayer
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
          className="pointer-events-none select-none
                     absolute inset-0 w-full h-full
                     object-cover scale-110 blur-3xl opacity-55"
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
  thumbnail?: string | null;
  autoPlay?: boolean;
}

export function VideoEmbed({ url, thumbnail, autoPlay = true }: VideoEmbedProps) {
  const info = detectVideoType(url);
  const [errorMsg, setErrorMsg]   = useState<string | null>(null);
  const [retryKey, setRetryKey]   = useState(0);

  useEffect(() => { setErrorMsg(null); setRetryKey(0); }, [url]);

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
      <div className="w-full aspect-video bg-zinc-950 flex flex-col items-center justify-center gap-5 p-6 text-center">
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
    if (errorMsg) {
      return (
        <div className="w-full aspect-video bg-zinc-950 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-400" />
          <div className="space-y-1 max-w-xs">
            <p className="text-white font-semibold text-base">تعذّر تشغيل الفيديو</p>
            <p className="text-white/50 text-xs leading-relaxed">{errorMsg}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => { setErrorMsg(null); setRetryKey((k) => k + 1); }}
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
        onError={setErrorMsg}
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

export function VideoEmbedLoading() {
  return (
    <div className="w-full aspect-video bg-zinc-950 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
    </div>
  );
}
