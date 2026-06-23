import { useState, useEffect } from "react";

/** Extract YouTube video ID → return thumbnail URL, or null */
export function getYoutubeThumbnailUrl(videoUrl: string): string | null {
  const match = videoUrl.match(
    /(?:youtube\.com\/(?:watch\?(?:.*?&)?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
}

/**
 * Seek a video element to `seekSec` and capture a JPEG frame via canvas.
 * Works for same-origin URLs (our /api/storage/... endpoints).
 */
async function captureVideoFrame(src: string, seekSec = 1): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";

    let resolved = false;
    const done = (val: string | null) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      video.src = "";
      video.load();
      resolve(val);
    };

    const timer = setTimeout(() => done(null), 12_000);

    video.addEventListener("loadedmetadata", () => {
      video.currentTime = Math.min(seekSec, video.duration - 0.1 || 0);
    });

    video.addEventListener("seeked", () => {
      try {
        const w = video.videoWidth  || 640;
        const h = video.videoHeight || 360;
        const canvas = document.createElement("canvas");
        canvas.width  = w;
        canvas.height = h;
        canvas.getContext("2d")?.drawImage(video, 0, 0, w, h);
        done(canvas.toDataURL("image/jpeg", 0.82));
      } catch {
        done(null);
      }
    });

    video.addEventListener("error", () => done(null));
    video.src = src;
    video.load();
  });
}

/**
 * Returns the best available thumbnail for a given video URL.
 * Priority: existingThumbnail > YouTube API > canvas frame extraction
 */
export function useVideoThumbnail(
  videoUrl: string,
  existingThumbnail?: string | null,
): string | null {
  const [thumbnail, setThumbnail] = useState<string | null>(
    existingThumbnail ?? null,
  );

  useEffect(() => {
    if (existingThumbnail) {
      setThumbnail(existingThumbnail);
      return undefined;
    }
    if (!videoUrl) { setThumbnail(null); return undefined; }

    // YouTube — instant, no network call needed
    const ytThumb = getYoutubeThumbnailUrl(videoUrl);
    if (ytThumb) { setThumbnail(ytThumb); return undefined; }

    // Our stored MP4s — canvas frame extraction
    if (videoUrl.startsWith("/api/storage/") || videoUrl.startsWith("/api/uploads/")) {
      let cancelled = false;
      setThumbnail(null);
      captureVideoFrame(videoUrl).then((frame) => {
        if (!cancelled) setThumbnail(frame);
      });
      return () => { cancelled = true; };
    }

    setThumbnail(null);
    return undefined;
  }, [videoUrl, existingThumbnail]);

  return thumbnail;
}
