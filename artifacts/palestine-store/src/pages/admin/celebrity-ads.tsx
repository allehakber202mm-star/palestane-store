import { AdminLayout } from "@/components/layout/AdminLayout";
import { useListCelebrityAds } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef } from "react";
import {
  Plus, Trash2, Pencil, Upload, Loader2, X, Video,
  Play, Save, AlertCircle, Wand2, CheckCircle2,
} from "lucide-react";
import { VideoTypeBadge, detectVideoType, isValidVideoUrl } from "@/components/VideoEmbed";
import { VideoEmbed } from "@/components/VideoEmbed";
import { uploadFileToStorage } from "@/lib/uploadImage";
import { getYoutubeThumbnailUrl, useVideoThumbnail } from "@/hooks/useVideoThumbnail";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiRequest(path: string, method: string, body?: unknown) {
  const token = localStorage.getItem("admin_token");
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/**
 * HEAD request to verify a stored video URL returns 200/206.
 * Skips check for external URLs (YouTube, TikTok, etc.).
 */
async function verifyVideoUrl(url: string): Promise<{ ok: boolean; reason?: string }> {
  if (!url.startsWith("/api/")) return { ok: true }; // external — skip
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (res.ok || res.status === 206) return { ok: true };
    return { ok: false, reason: `الخادم أعاد: HTTP ${res.status}` };
  } catch {
    return { ok: false, reason: "تعذّر الاتصال بالخادم للتحقق من الفيديو" };
  }
}

/**
 * Seek a video URL to 1s, capture a JPEG frame via canvas, upload to storage.
 * Returns the serving URL of the uploaded thumbnail, or null on failure.
 */
async function extractAndUploadThumbnail(videoUrl: string): Promise<string | null> {
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

    const timer = setTimeout(() => {
      console.warn("[Thumbnail] ⏰ timeout extracting frame from:", videoUrl);
      done(null);
    }, 15_000);

    video.addEventListener("loadedmetadata", () => {
      video.currentTime = Math.min(1, Math.max(0, video.duration - 0.1));
    });

    video.addEventListener("seeked", () => {
      try {
        const w = video.videoWidth  || 640;
        const h = video.videoHeight || 360;
        const canvas = document.createElement("canvas");
        canvas.width  = w;
        canvas.height = h;
        canvas.getContext("2d")?.drawImage(video, 0, 0, w, h);
        canvas.toBlob(async (blob) => {
          if (!blob) { done(null); return; }
          try {
            const file = new File([blob], "thumbnail.jpg", { type: "image/jpeg" });
            const url = await uploadFileToStorage(file);
            console.log("[Thumbnail] ✅ رُفعت:", url);
            done(url);
          } catch (err) {
            console.error("[Thumbnail] ❌ فشل رفع الصورة:", err);
            done(null);
          }
        }, "image/jpeg", 0.82);
      } catch (err) {
        console.error("[Thumbnail] ❌ فشل رسم الإطار:", err);
        done(null);
      }
    });

    video.addEventListener("error", (e) => {
      console.error("[Thumbnail] ❌ video error:", e);
      done(null);
    });

    video.src = videoUrl;
    video.load();
  });
}

type AdForm = { title: string; description: string; videoUrl: string; thumbnailUrl: string };
const EMPTY_FORM: AdForm = { title: "", description: "", videoUrl: "", thumbnailUrl: "" };
type Ad = {
  id: number; title: string; description: string | null;
  videoUrl: string; thumbnailUrl: string | null; createdAt: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// AdminAdCard — blurred bg + object-contain + dynamic aspect ratio
// ─────────────────────────────────────────────────────────────────────────────
function AdminAdCard({ ad, onEdit, onDelete, onPreview }: {
  ad: Ad; onEdit: () => void; onDelete: () => void; onPreview: () => void;
}) {
  const thumbnail = useVideoThumbnail(ad.videoUrl, ad.thumbnailUrl);
  const [isVertical, setIsVertical] = useState<boolean | null>(null);

  const aspect = isVertical === false ? "aspect-video" : "aspect-[9/16]";

  return (
    <div className="group bg-card border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col">
      {/* Thumbnail */}
      <div className={`relative w-full ${aspect} bg-zinc-900 cursor-pointer overflow-hidden`} onClick={onPreview}>
        {/* Blurred background */}
        {thumbnail && (
          <img src={thumbnail} aria-hidden
            className="pointer-events-none select-none absolute inset-0 w-full h-full object-cover scale-110 blur-3xl opacity-55" />
        )}
        {/* Contained thumbnail */}
        {thumbnail ? (
          <img src={thumbnail} alt={ad.title} loading="lazy"
            className="relative z-10 w-full h-full object-contain"
            onLoad={(e) => {
              const { naturalWidth, naturalHeight } = e.currentTarget;
              setIsVertical(naturalHeight > naturalWidth * 1.1);
            }} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 z-20 flex items-center justify-center
                        bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="bg-white/90 rounded-full p-3 shadow-xl">
            <Play className="w-6 h-6 text-primary fill-primary" />
          </div>
        </div>
        {/* Type badge */}
        <div className="absolute bottom-2 left-2 z-20">
          <VideoTypeBadge url={ad.videoUrl} />
        </div>
      </div>

      {/* Info + actions */}
      <div className="p-3 space-y-2 flex-1 flex flex-col">
        <p className="font-semibold text-sm line-clamp-1 flex-1">{ad.title}</p>
        {ad.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{ad.description}</p>
        )}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" className="flex-1 gap-1.5 h-8 text-xs" onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5" /> تعديل
          </Button>
          <Button variant="destructive" size="sm" className="h-8 px-3" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminCelebrityAds() {
  const { data: ads, isLoading } = useListCelebrityAds();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [modalOpen, setModalOpen]             = useState(false);
  const [editing, setEditing]                 = useState<Ad | null>(null);
  const [form, setForm]                       = useState<AdForm>(EMPTY_FORM);
  const [saving, setSaving]                   = useState(false);
  const [uploadingVideo, setUploadingVideo]   = useState(false);
  const [uploadingThumb, setUploadingThumb]   = useState(false);
  const [extractingThumb, setExtractingThumb] = useState(false);
  const [verifying, setVerifying]             = useState(false);
  const [uploadProgress, setUploadProgress]   = useState<string | null>(null);
  const [previewAd, setPreviewAd]             = useState<Ad | null>(null);
  const [urlError, setUrlError]               = useState<string | null>(null);
  const [urlOk, setUrlOk]                     = useState(false);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/celebrity-ads"] });

  function openCreate() {
    setEditing(null); setForm(EMPTY_FORM);
    setUrlError(null); setUrlOk(false);
    setModalOpen(true);
  }
  function openEdit(ad: Ad) {
    setEditing(ad);
    setForm({ title: ad.title, description: ad.description ?? "", videoUrl: ad.videoUrl, thumbnailUrl: ad.thumbnailUrl ?? "" });
    setUrlError(null); setUrlOk(false);
    setModalOpen(true);
  }

  function handleVideoUrlChange(val: string) {
    setUrlOk(false);
    setForm((f) => ({ ...f, videoUrl: val }));
    if (!val.trim()) { setUrlError(null); return; }

    // Auto-fill YouTube thumbnail
    const ytThumb = getYoutubeThumbnailUrl(val);
    if (ytThumb) setForm((f) => ({ ...f, videoUrl: val, thumbnailUrl: f.thumbnailUrl || ytThumb }));

    if (!isValidVideoUrl(val)) {
      setUrlError("الرابط غير صالح — يجب https:// أو ملف مرفوع");
    } else {
      const info = detectVideoType(val);
      setUrlError(!info.canEmbed ? `رابط ${info.label} سيُفتح خارجياً — استخدم رابط مباشر` : null);
    }
  }

  async function handleAutoExtract() {
    if (!form.videoUrl) return;
    setExtractingThumb(true);
    toast({ title: "جاري استخراج صورة المعاينة…" });
    try {
      const thumbUrl = await extractAndUploadThumbnail(form.videoUrl);
      if (thumbUrl) {
        setForm((f) => ({ ...f, thumbnailUrl: thumbUrl }));
        toast({ title: "✅ تم استخراج الصورة ورفعها" });
      } else {
        toast({ title: "تعذّر استخراج إطار — جرب صورة مخصصة", variant: "destructive" });
      }
    } finally {
      setExtractingThumb(false);
    }
  }

  async function uploadFile(file: File, type: "video" | "thumb") {
    const setUploading = type === "video" ? setUploadingVideo : setUploadingThumb;
    setUploading(true);
    setUrlOk(false);
    setUploadProgress(
      `جاري رفع ${type === "video" ? "الفيديو" : "الصورة"}: ${file.name} — ${(file.size / 1024 / 1024).toFixed(1)} MB`,
    );
    try {
      const servingUrl = await uploadFileToStorage(file);
      setForm((f) => type === "video" ? { ...f, videoUrl: servingUrl } : { ...f, thumbnailUrl: servingUrl });

      if (type === "video") {
        setUrlError(null);
        setUrlOk(true);
        toast({ title: "✅ رُفع الفيديو — جاري استخراج المعاينة…" });
        setExtractingThumb(true);
        extractAndUploadThumbnail(servingUrl).then((thumbUrl) => {
          if (thumbUrl) {
            setForm((f) => ({ ...f, thumbnailUrl: f.thumbnailUrl || thumbUrl }));
            toast({ title: "✅ تم استخراج صورة المعاينة تلقائياً" });
          }
          setExtractingThumb(false);
        });
      } else {
        toast({ title: "✅ رُفعت الصورة" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "فشل رفع الملف", description: msg, variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast({ title: "العنوان مطلوب", variant: "destructive" }); return;
    }
    if (!form.videoUrl.trim() || !isValidVideoUrl(form.videoUrl)) {
      toast({ title: "رابط الفيديو غير صالح", variant: "destructive" }); return;
    }

    // Verify stored video URLs respond correctly before saving
    if (form.videoUrl.startsWith("/api/") && !urlOk) {
      setVerifying(true);
      toast({ title: "جاري التحقق من صلاحية الفيديو…" });
      const { ok, reason } = await verifyVideoUrl(form.videoUrl);
      setVerifying(false);
      if (!ok) {
        toast({
          title: "الفيديو غير متاح",
          description: reason ?? "تحقق من الرابط وأعد المحاولة",
          variant: "destructive",
        });
        return;
      }
      setUrlOk(true);
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        videoUrl: form.videoUrl,
        thumbnailUrl: form.thumbnailUrl || null,
      };
      if (editing) {
        await apiRequest(`/admin/celebrity-ads/${editing.id}`, "PATCH", payload);
        toast({ title: "✅ تم التحديث" });
      } else {
        await apiRequest("/admin/celebrity-ads", "POST", payload);
        toast({ title: "✅ تمت الإضافة" });
      }
      invalidate();
      setModalOpen(false);
    } catch {
      toast({ title: "حدث خطأ أثناء الحفظ", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("هل تريد حذف هذا الفيديو؟")) return;
    try {
      await apiRequest(`/admin/celebrity-ads/${id}`, "DELETE");
      invalidate();
      toast({ title: "تم الحذف" });
    } catch {
      toast({ title: "فشل الحذف", variant: "destructive" });
    }
  }

  const isBusy = saving || verifying || extractingThumb || uploadingVideo;

  return (
    <AdminLayout>
      {/* ── Preview modal ────────────────────────────────────────────────── */}
      {previewAd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-3"
          onClick={() => setPreviewAd(null)}
        >
          <div
            className="relative w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewAd(null)}
              className="absolute top-3 right-3 z-30 bg-black/60 hover:bg-black/90 text-white rounded-full p-1.5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <VideoEmbed url={previewAd.videoUrl} thumbnail={previewAd.thumbnailUrl} autoPlay />
            <div className="p-4 bg-background border-t">
              <h3 className="font-bold">{previewAd.title}</h3>
              {previewAd.description && (
                <p className="text-sm text-muted-foreground mt-1">{previewAd.description}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit modal ──────────────────────────────────────────── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-background border rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{editing ? "تعديل الفيديو" : "إضافة فيديو جديد"}</h2>
              <Button variant="ghost" size="icon" onClick={() => setModalOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">العنوان *</label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="عنوان الفيديو"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">الوصف</label>
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="وصف مختصر…"
                />
              </div>

              {/* Video */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">الفيديو *</label>
                  {form.videoUrl && <VideoTypeBadge url={form.videoUrl} />}
                  {urlOk && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                </div>
                <div className="flex gap-2">
                  <Input
                    dir="ltr"
                    className="text-left text-xs flex-1"
                    value={form.videoUrl}
                    onChange={(e) => handleVideoUrlChange(e.target.value)}
                    placeholder="https://youtube.com/… أو MP4…"
                  />
                  <Button
                    type="button" variant="outline" size="sm"
                    disabled={uploadingVideo}
                    onClick={() => videoInputRef.current?.click()}
                    className="shrink-0 gap-1.5"
                  >
                    {uploadingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    رفع
                  </Button>
                  <input ref={videoInputRef} type="file" accept="video/*,video/mp4" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f, "video"); e.target.value = ""; }} />
                </div>
                {uploadProgress && uploadingVideo && (
                  <p className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                    <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                    {uploadProgress}
                  </p>
                )}
                {!uploadingVideo && urlError && (
                  <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {urlError}
                  </p>
                )}
                {!uploadingVideo && !urlError && (
                  <p className="text-xs text-muted-foreground">
                    يدعم: YouTube • TikTok • Instagram Reels • Facebook • MP4 مرفوع
                  </p>
                )}
              </div>

              {/* Thumbnail */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">صورة المعاينة</label>
                  {form.videoUrl.startsWith("/api/") && (
                    <Button type="button" variant="ghost" size="sm"
                      disabled={extractingThumb}
                      onClick={handleAutoExtract}
                      className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                      {extractingThumb ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                      استخراج تلقائي
                    </Button>
                  )}
                </div>
                <div className="flex gap-2 items-start">
                  {/* Preview swatch */}
                  <div className="relative shrink-0 h-20 w-32 rounded border bg-muted overflow-hidden">
                    {form.thumbnailUrl ? (
                      <>
                        <img src={form.thumbnailUrl} alt=""
                          className="w-full h-full object-contain" />
                        <button type="button"
                          onClick={() => setForm((f) => ({ ...f, thumbnailUrl: "" }))}
                          className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-xs leading-none"
                        >×</button>
                      </>
                    ) : extractingThumb ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="w-5 h-5 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 flex-1">
                    <Input dir="ltr" className="text-left text-xs"
                      value={form.thumbnailUrl}
                      onChange={(e) => setForm((f) => ({ ...f, thumbnailUrl: e.target.value }))}
                      placeholder="رابط الصورة أو ارفع ملف…"
                    />
                    <Button type="button" variant="outline" size="sm"
                      disabled={uploadingThumb}
                      onClick={() => thumbInputRef.current?.click()}
                      className="gap-1.5 h-7 text-xs w-fit"
                    >
                      {uploadingThumb ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      رفع صورة
                    </Button>
                    <input ref={thumbInputRef} type="file" accept="image/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f, "thumb"); e.target.value = ""; }} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  تُستخرج تلقائياً من الفيديو بعد الرفع — أو ارفع صورة مخصصة.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setModalOpen(false)} disabled={isBusy}>إلغاء</Button>
              <Button onClick={handleSave} disabled={isBusy} className="gap-2 min-w-[100px]">
                {saving || verifying
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Save className="w-4 h-4" />}
                {saving ? "جاري الحفظ…" : verifying ? "جاري التحقق…" : "حفظ"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page content ─────────────────────────────────────────────────── */}
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">إعلانات المشاهير</h1>
            <p className="text-muted-foreground mt-1 text-sm">إدارة فيديوهات الإعلانات والتوصيات</p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            إضافة فيديو
          </Button>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="rounded-xl aspect-[9/16]" />)}
          </div>
        )}

        {!isLoading && (!ads || ads.length === 0) && (
          <div className="text-center py-24 text-muted-foreground border rounded-xl bg-muted/30">
            <Video className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">لا يوجد فيديوهات بعد.</p>
            <Button onClick={openCreate} className="mt-4 gap-2">
              <Plus className="w-4 h-4" /> إضافة أول فيديو
            </Button>
          </div>
        )}

        {!isLoading && ads && ads.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ads.map((ad) => (
              <AdminAdCard
                key={ad.id}
                ad={ad as Ad}
                onEdit={() => openEdit(ad as Ad)}
                onDelete={() => handleDelete(ad.id)}
                onPreview={() => setPreviewAd(ad as Ad)}
              />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
