import { AdminLayout } from "@/components/layout/AdminLayout";
import { useListCelebrityAds } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef, useEffect } from "react";
import {
  Plus, Trash2, Pencil, Upload, Loader2, X, Video, Play, Save, AlertCircle, Wand2,
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

/** Seek a video URL to 1s and capture a frame, then upload it to storage */
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

    const timer = setTimeout(() => done(null), 12_000);

    video.addEventListener("loadedmetadata", () => {
      video.currentTime = Math.min(1, video.duration - 0.1 || 0);
    });

    video.addEventListener("seeked", () => {
      try {
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 360;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")?.drawImage(video, 0, 0, w, h);
        canvas.toBlob(async (blob) => {
          if (!blob) { done(null); return; }
          try {
            const file = new File([blob], "thumbnail.jpg", { type: "image/jpeg" });
            const url = await uploadFileToStorage(file);
            done(url);
          } catch { done(null); }
        }, "image/jpeg", 0.82);
      } catch { done(null); }
    });

    video.addEventListener("error", () => done(null));
    video.src = videoUrl;
    video.load();
  });
}

type AdForm = { title: string; description: string; videoUrl: string; thumbnailUrl: string };
const EMPTY_FORM: AdForm = { title: "", description: "", videoUrl: "", thumbnailUrl: "" };
type Ad = { id: number; title: string; description: string | null; videoUrl: string; thumbnailUrl: string | null; createdAt: string };

// ── Card with auto-thumbnail ──────────────────────────────────────────────────
function AdminAdCard({
  ad,
  onEdit,
  onDelete,
  onPreview,
}: {
  ad: Ad;
  onEdit: () => void;
  onDelete: () => void;
  onPreview: () => void;
}) {
  const thumbnail = useVideoThumbnail(ad.videoUrl, ad.thumbnailUrl);

  return (
    <div className="group bg-card border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
      <div
        className="relative aspect-video bg-black cursor-pointer"
        onClick={onPreview}
      >
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={ad.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900" />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-white/90 rounded-full p-2.5 shadow">
            <Play className="w-6 h-6 text-primary fill-primary" />
          </div>
        </div>
        <div className="absolute bottom-2 left-2">
          <VideoTypeBadge url={ad.videoUrl} />
        </div>
      </div>

      <div className="p-3 space-y-2">
        <p className="font-semibold text-sm line-clamp-1">{ad.title}</p>
        {ad.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{ad.description}</p>
        )}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5 h-8 text-xs"
            onClick={onEdit}
          >
            <Pencil className="w-3.5 h-3.5" /> تعديل
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="h-8 px-3"
            onClick={onDelete}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
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
  const [uploadProgress, setUploadProgress]   = useState<string | null>(null);
  const [previewAd, setPreviewAd]             = useState<Ad | null>(null);
  const [urlError, setUrlError]               = useState<string | null>(null);

  const videoRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/celebrity-ads"] });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setUrlError(null);
    setModalOpen(true);
  }

  function openEdit(ad: Ad) {
    setEditing(ad);
    setForm({
      title:        ad.title,
      description:  ad.description ?? "",
      videoUrl:     ad.videoUrl,
      thumbnailUrl: ad.thumbnailUrl ?? "",
    });
    setUrlError(null);
    setModalOpen(true);
  }

  function handleVideoUrlChange(val: string) {
    setForm((f) => ({ ...f, videoUrl: val }));
    if (!val.trim()) { setUrlError(null); return; }

    // Auto-fill YouTube thumbnail
    const ytThumb = getYoutubeThumbnailUrl(val);
    if (ytThumb) {
      setForm((f) => ({ ...f, videoUrl: val, thumbnailUrl: f.thumbnailUrl || ytThumb }));
    }

    if (!isValidVideoUrl(val)) {
      setUrlError("الرابط غير صالح — يجب أن يبدأ بـ https:// أو أن يكون ملفاً مرفوعاً");
    } else {
      const info = detectVideoType(val);
      setUrlError(!info.canEmbed
        ? `رابط ${info.label} هذا سيفتح خارجياً — يُفضَّل رابط /video/ المباشر`
        : null,
      );
    }
  }

  /** Auto-extract thumbnail from stored MP4 */
  async function handleAutoExtract() {
    if (!form.videoUrl) return;
    setExtractingThumb(true);
    toast({ title: "جاري استخراج صورة معاينة..." });
    try {
      const thumbUrl = await extractAndUploadThumbnail(form.videoUrl);
      if (thumbUrl) {
        setForm((f) => ({ ...f, thumbnailUrl: thumbUrl }));
        toast({ title: "✅ تم استخراج الصورة ورفعها" });
      } else {
        toast({ title: "تعذّر استخراج إطار من الفيديو", variant: "destructive" });
      }
    } finally {
      setExtractingThumb(false);
    }
  }

  async function uploadFile(file: File, type: "video" | "thumb") {
    const setter = type === "video" ? setUploadingVideo : setUploadingThumb;
    setter(true);
    setUploadProgress(
      `جاري رفع ${type === "video" ? "الفيديو" : "الصورة"}: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)...`,
    );
    try {
      const servingUrl = await uploadFileToStorage(file);
      setForm((f) =>
        type === "video"
          ? { ...f, videoUrl: servingUrl }
          : { ...f, thumbnailUrl: servingUrl },
      );
      if (type === "video") {
        setUrlError(null);
        // Auto-extract thumbnail after video upload
        setExtractingThumb(true);
        toast({ title: "✅ تم رفع الفيديو — جاري استخراج صورة المعاينة..." });
        extractAndUploadThumbnail(servingUrl).then((thumbUrl) => {
          if (thumbUrl) {
            setForm((f) => ({ ...f, thumbnailUrl: f.thumbnailUrl || thumbUrl }));
            toast({ title: "✅ تم استخراج صورة المعاينة تلقائياً" });
          }
          setExtractingThumb(false);
        });
      } else {
        toast({ title: "✅ تم رفع الصورة" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "فشل رفع الملف", description: msg, variant: "destructive" });
    } finally {
      setter(false);
      setUploadProgress(null);
    }
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast({ title: "العنوان مطلوب", variant: "destructive" }); return;
    }
    if (!form.videoUrl.trim()) {
      toast({ title: "الفيديو مطلوب — أدخل رابطاً أو ارفع ملفاً", variant: "destructive" }); return;
    }
    if (!isValidVideoUrl(form.videoUrl)) {
      toast({ title: "رابط الفيديو غير صالح", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const payload = {
        title:        form.title,
        description:  form.description || null,
        videoUrl:     form.videoUrl,
        thumbnailUrl: form.thumbnailUrl || null,
      };
      if (editing) {
        await apiRequest(`/admin/celebrity-ads/${editing.id}`, "PATCH", payload);
        toast({ title: "تم التحديث" });
      } else {
        await apiRequest("/admin/celebrity-ads", "POST", payload);
        toast({ title: "تمت الإضافة" });
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
    await apiRequest(`/admin/celebrity-ads/${id}`, "DELETE");
    invalidate();
    toast({ title: "تم الحذف" });
  }

  return (
    <AdminLayout>
      {/* ── Video Preview Modal ──────────────────────────────────── */}
      {previewAd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3"
          onClick={() => setPreviewAd(null)}
        >
          <div
            className="relative w-full max-w-3xl bg-black rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewAd(null)}
              className="absolute top-3 right-3 z-20 bg-black/60 hover:bg-black/90 text-white rounded-full p-1.5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <VideoEmbed url={previewAd.videoUrl} autoPlay />
            <div className="p-4 bg-background">
              <h3 className="font-bold text-lg">{previewAd.title}</h3>
              {previewAd.description && (
                <p className="text-sm text-muted-foreground mt-1">{previewAd.description}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Edit / Create Modal ──────────────────────────────────── */}
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
              <h2 className="text-xl font-bold">
                {editing ? "تعديل الفيديو" : "إضافة فيديو جديد"}
              </h2>
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
                  placeholder="وصف مختصر..."
                />
              </div>

              {/* Video URL / Upload */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">الفيديو *</label>
                  {form.videoUrl && <VideoTypeBadge url={form.videoUrl} />}
                </div>
                <div className="flex gap-2">
                  <Input
                    dir="ltr"
                    className="text-left text-xs flex-1"
                    value={form.videoUrl}
                    onChange={(e) => handleVideoUrlChange(e.target.value)}
                    placeholder="https://youtube.com/... أو TikTok أو Instagram أو MP4..."
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingVideo}
                    onClick={() => videoRef.current?.click()}
                    className="shrink-0 gap-1.5"
                  >
                    {uploadingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    رفع
                  </Button>
                  <input
                    ref={videoRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f, "video"); e.target.value = ""; }}
                  />
                </div>
                {/* Upload progress */}
                {uploadProgress && uploadingVideo && (
                  <p className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                    <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                    {uploadProgress}
                  </p>
                )}
                {/* Validation */}
                {!uploadingVideo && urlError && (
                  <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {urlError}
                  </p>
                )}
                {!uploadingVideo && !urlError && (
                  <p className="text-xs text-muted-foreground">
                    يدعم: YouTube • TikTok • Instagram Reels • Facebook Video • MP4 مباشر
                  </p>
                )}
              </div>

              {/* Thumbnail */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">صورة المعاينة</label>
                  {/* Auto-extract button — only for stored MP4 */}
                  {form.videoUrl.startsWith("/api/") && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={extractingThumb}
                      onClick={handleAutoExtract}
                      className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                      {extractingThumb
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Wand2 className="w-3 h-3" />}
                      استخراج تلقائي
                    </Button>
                  )}
                </div>

                {/* Thumbnail preview + input */}
                <div className="flex gap-2 items-start">
                  {/* Preview */}
                  {form.thumbnailUrl ? (
                    <div className="relative shrink-0">
                      <img
                        src={form.thumbnailUrl}
                        alt=""
                        className="h-16 w-28 object-cover rounded border bg-muted"
                      />
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, thumbnailUrl: "" }))}
                        className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-4 h-4 flex items-center justify-center text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="h-16 w-28 rounded border bg-muted shrink-0 flex items-center justify-center">
                      {extractingThumb
                        ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        : <Video className="w-5 h-5 text-muted-foreground/40" />}
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5 flex-1">
                    <Input
                      dir="ltr"
                      className="text-left text-xs"
                      value={form.thumbnailUrl}
                      onChange={(e) => setForm((f) => ({ ...f, thumbnailUrl: e.target.value }))}
                      placeholder="رابط الصورة أو ارفع ملف..."
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingThumb}
                      onClick={() => thumbRef.current?.click()}
                      className="gap-1.5 h-7 text-xs w-fit"
                    >
                      {uploadingThumb ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      رفع صورة
                    </Button>
                    <input
                      ref={thumbRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f, "thumb"); e.target.value = ""; }}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  تُستخرج تلقائياً من الفيديو بعد الرفع — أو ارفع صورة مخصصة.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>إلغاء</Button>
              <Button onClick={handleSave} disabled={saving || extractingThumb} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "جاري الحفظ..." : "حفظ"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page ──────────────────────────────────────────────────── */}
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
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
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
