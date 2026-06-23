import { useEffect, useRef } from "react";
import { ExternalLink, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─────────────────────────────────────────────────────────────────────────────
// Video type detection
// ─────────────────────────────────────────────────────────────────────────────
export type VideoType = "youtube" | "tiktok" | "instagram" | "facebook" | "mp4";

export interface VideoInfo {
  type:      VideoType;
  embedUrl:  string;
  canEmbed:  boolean;
  label:     string;
}

export function detectVideoType(rawUrl: string): VideoInfo {
  const url = (rawUrl ?? "").trim();
  if (!url) return { type: "mp4", embedUrl: "", canEmbed: false, label: "غير محدد" };

  // Our own object-storage paths — always direct MP4
  if (url.startsWith("/api/storage/") || url.startsWith("/api/uploads/")) {
    return { type: "mp4", embedUrl: url, canEmbed: true, label: "فيديو مرفوع" };
  }

  // ── YouTube ─────────────────────────────────────────────────────────────
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*?&)?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  if (ytMatch) {
    const embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&playsinline=1&rel=0`;
    return { type: "youtube", embedUrl, canEmbed: true, label: "YouTube" };
  }

  // ── TikTok ───────────────────────────────────────────────────────────────
  if (/tiktok\.com/.test(url)) {
    const videoIdMatch = url.match(/\/video\/(\d+)/);
    if (videoIdMatch) {
      return {
        type: "tiktok",
        embedUrl: `https://www.tiktok.com/embed/v2/${videoIdMatch[1]}`,
        canEmbed: true,
        label: "TikTok",
      };
    }
    // Short URL / profile link — can't extract ID → open externally
    return { type: "tiktok", embedUrl: url, canEmbed: false, label: "TikTok" };
  }

  // ── Instagram Reels ──────────────────────────────────────────────────────
  const igReelMatch = url.match(/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/);
  if (igReelMatch) {
    return {
      type: "instagram",
      embedUrl: `https://www.instagram.com/p/${igReelMatch[1]}/embed/`,
      canEmbed: true,
      label: "Instagram Reels",
    };
  }
  if (/instagram\.com/.test(url)) {
    return { type: "instagram", embedUrl: url, canEmbed: false, label: "Instagram" };
  }

  // ── Facebook Video ────────────────────────────────────────────────────────
  if (/facebook\.com|fb\.watch/.test(url)) {
    const fbEncoded = encodeURIComponent(url);
    return {
      type: "facebook",
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${fbEncoded}&show_text=false&autoplay=true&width=640`,
      canEmbed: true,
      label: "Facebook",
    };
  }

  // ── Default: direct video (MP4 / blob / CDN) ──────────────────────────────
  return { type: "mp4", embedUrl: url, canEmbed: true, label: "فيديو مباشر" };
}

export function isValidVideoUrl(url: string): boolean {
  const u = (url ?? "").trim();
  if (!u) return false;
  if (u.startsWith("/api/")) return true;
  try {
    const parsed = new URL(u);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VideoEmbed — renders the correct player for any supported URL
// ─────────────────────────────────────────────────────────────────────────────
interface VideoEmbedProps {
  url: string;
  /** Extra className applied to the player element */
  className?: string;
}

export function VideoEmbed({ url, className }: VideoEmbedProps) {
  const info = detectVideoType(url);
  const videoRef = useRef<HTMLVideoElement>(null);

  // ── Debug log ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!url) return;
    console.log("[CelebrityAd] 🎬 رابط الفيديو الأصلي:", url);
    console.log("[CelebrityAd] 📺 نوع الفيديو:", info.type, `(${info.label})`);
    console.log("[CelebrityAd] 🔗 رابط الإدراج:", info.embedUrl);
    console.log("[CelebrityAd] ✅ يدعم الإدراج:", info.canEmbed);
  }, [url, info.type, info.label, info.embedUrl, info.canEmbed]);

  // ── No URL ────────────────────────────────────────────────────────────────
  if (!url) {
    return (
      <div className="w-full aspect-video bg-black flex flex-col items-center justify-center gap-3 text-white/50">
        <AlertTriangle className="w-10 h-10" />
        <p className="text-sm">لا يوجد رابط فيديو</p>
      </div>
    );
  }

  // ── Direct MP4 / storage ──────────────────────────────────────────────────
  if (info.type === "mp4") {
    return (
      <video
        key={url}
        ref={videoRef}
        src={info.embedUrl}
        controls
        autoPlay
        playsInline
        className={className ?? "w-full max-h-[70vh] object-contain bg-black"}
        onLoadedData={() =>
          console.log("[CelebrityAd] ✅ تم تحميل الفيديو بنجاح:", url)
        }
        onError={() =>
          console.error("[CelebrityAd] ❌ فشل تحميل الفيديو:", url)
        }
      />
    );
  }

  // ── Can't embed → external link ───────────────────────────────────────────
  if (!info.canEmbed) {
    console.warn("[CelebrityAd] ⚠️ الرابط لا يدعم الإدراج المباشر:", url);
    return (
      <div className="w-full aspect-video bg-black flex flex-col items-center justify-center gap-5 p-6">
        <div className="text-center space-y-2">
          <p className="text-white font-semibold">
            {info.label === "TikTok" ? "🎵" : "📱"} {info.label}
          </p>
          <p className="text-white/60 text-sm">
            هذا الرابط يحتاج فتح التطبيق مباشرة
          </p>
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

  // ── iframe embed (YouTube / TikTok / Instagram / Facebook) ───────────────
  return (
    <iframe
      key={info.embedUrl}
      src={info.embedUrl}
      className={className ?? "w-full aspect-video"}
      allow="autoplay; fullscreen; encrypted-media; picture-in-picture; web-share"
      allowFullScreen
      loading="lazy"
      onLoad={() =>
        console.log("[CelebrityAd] ✅ تم تحميل الإطار:", info.embedUrl)
      }
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VideoTypeBadge — small hint shown next to the URL input
// ─────────────────────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<VideoType, string> = {
  youtube:   "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  tiktok:    "bg-black/10 text-black dark:bg-white/10 dark:text-white",
  instagram: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  facebook:  "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  mp4:       "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
};

const TYPE_ICONS: Record<VideoType, string> = {
  youtube:   "▶ YouTube",
  tiktok:    "🎵 TikTok",
  instagram: "📷 Instagram",
  facebook:  "👥 Facebook",
  mp4:       "🎬 MP4",
};

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

// Re-export a simple loading placeholder
export function VideoEmbedLoading() {
  return (
    <div className="w-full aspect-video bg-black flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
    </div>
  );
}
