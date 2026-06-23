/**
 * Video URL detection utilities — kept separate from VideoEmbed component
 * so Vite Fast Refresh doesn't warn about mixed component/non-component exports.
 */

export type VideoType = "youtube" | "tiktok" | "instagram" | "facebook" | "mp4";

export interface VideoInfo {
  type:     VideoType;
  embedUrl: string;
  canEmbed: boolean;
  label:    string;
}

export function detectVideoType(rawUrl: string): VideoInfo {
  const url = (rawUrl ?? "").trim();
  if (!url) return { type: "mp4", embedUrl: "", canEmbed: false, label: "غير محدد" };

  if (url.startsWith("/api/storage/") || url.startsWith("/api/uploads/")) {
    return { type: "mp4", embedUrl: url, canEmbed: true, label: "فيديو مرفوع" };
  }

  // YouTube
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*?&)?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  if (ytMatch) {
    return {
      type: "youtube",
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&playsinline=1&rel=0`,
      canEmbed: true,
      label: "YouTube",
    };
  }

  // TikTok
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
    return { type: "tiktok", embedUrl: url, canEmbed: false, label: "TikTok" };
  }

  if (/vm\.tiktok\.com/.test(url)) {
    return { type: "tiktok", embedUrl: url, canEmbed: false, label: "TikTok" };
  }

  // Instagram
  const igMatch = url.match(/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/);
  if (igMatch) {
    return {
      type: "instagram",
      embedUrl: `https://www.instagram.com/p/${igMatch[1]}/embed/`,
      canEmbed: true,
      label: "Instagram Reels",
    };
  }
  if (/instagram\.com/.test(url)) {
    return { type: "instagram", embedUrl: url, canEmbed: false, label: "Instagram" };
  }

  // Facebook
  if (/facebook\.com|fb\.watch/.test(url)) {
    return {
      type: "facebook",
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&autoplay=true&width=640`,
      canEmbed: true,
      label: "Facebook",
    };
  }

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

export const TYPE_COLORS: Record<VideoType, string> = {
  youtube:   "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  tiktok:    "bg-black/10 text-black dark:bg-white/10 dark:text-white",
  instagram: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  facebook:  "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  mp4:       "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
};

export const TYPE_ICONS: Record<VideoType, string> = {
  youtube:   "▶ YouTube",
  tiktok:    "🎵 TikTok",
  instagram: "📷 Instagram",
  facebook:  "👥 Facebook",
  mp4:       "🎬 MP4",
};
