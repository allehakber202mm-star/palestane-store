import { AdminLayout } from "@/components/layout/AdminLayout";
import { useListCelebrityAds, useRequestUploadUrl } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef } from "react";
import {
  Plus, Trash2, Pencil, Upload, Loader2, X, Video, Play, Save,
} from "lucide-react";

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

type AdForm = { title: string; description: string; videoUrl: string; thumbnailUrl: string };
const EMPTY_FORM: AdForm = { title: "", description: "", videoUrl: "", thumbnailUrl: "" };

type Ad = { id: number; title: string; description: string | null; videoUrl: string; thumbnailUrl: string | null; createdAt: string };

export default function AdminCelebrityAds() {
  const { data: ads, isLoading } = useListCelebrityAds();
  const requestUpload = useRequestUploadUrl();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Ad | null>(null);
  const [form, setForm] = useState<AdForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [previewAd, setPreviewAd] = useState<Ad | null>(null);

  const videoRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/celebrity-ads"] });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(ad: Ad) {
    setEditing(ad);
    setForm({
      title: ad.title,
      description: ad.description ?? "",
      videoUrl: ad.videoUrl,
      thumbnailUrl: ad.thumbnailUrl ?? "",
    });
    setModalOpen(true);
  }

  async function uploadFile(file: File, type: "video" | "thumb") {
    const setter = type === "video" ? setUploadingVideo : setUploadingThumb;
    setter(true);
    try {
      const { uploadURL, objectPath } = await requestUpload.mutateAsync({
        data: { name: file.name, size: file.size, contentType: file.type },
      });
      await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      const url = `/api/storage/objects/${objectPath}`;
      setForm((f) => type === "video" ? { ...f, videoUrl: url } : { ...f, thumbnailUrl: url });
    } catch {
      toast({ title: "فشل رفع الملف", variant: "destructive" });
    } finally {
      setter(false);
    }
  }

  async function handleSave() {
    if (!form.title.trim()) { toast({ title: "العنوان مطلوب", variant: "destructive" }); return; }
    if (!form.videoUrl.trim()) { toast({ title: "الفيديو مطلوب", variant: "destructive" }); return; }
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
        toast({ title: "تم تحديث الفيديو" });
      } else {
        await apiRequest("/admin/celebrity-ads", "POST", payload);
        toast({ title: "تم إضافة الفيديو" });
      }
      invalidate();
      setModalOpen(false);
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("هل تريد حذف هذا الفيديو؟")) return;
    await apiRequest(`/admin/celebrity-ads/${id}`, "DELETE");
    invalidate();
    toast({ title: "تم حذف الفيديو" });
  }

  return (
    <AdminLayout>
      {/* Video Preview Modal */}
      {previewAd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setPreviewAd(null)}
        >
          <div className="relative w-full max-w-3xl bg-black rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewAd(null)} className="absolute top-3 right-3 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5">
              <X className="w-5 h-5" />
            </button>
            <video src={previewAd.videoUrl} controls autoPlay playsInline className="w-full max-h-[70vh] object-contain bg-black" />
            <div className="p-4 bg-background">
              <h3 className="font-bold text-lg">{previewAd.title}</h3>
              {previewAd.description && <p className="text-sm text-muted-foreground mt-1">{previewAd.description}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Edit/Create Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-background border rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{editing ? "تعديل الفيديو" : "إضافة فيديو جديد"}</h2>
              <Button variant="ghost" size="icon" onClick={() => setModalOpen(false)}><X className="w-4 h-4" /></Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">العنوان *</label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="عنوان الفيديو" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">الوصف</label>
                <Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="وصف مختصر..." />
              </div>

              {/* Video Upload */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">ملف الفيديو *</label>
                <div className="flex gap-2">
                  <Input
                    dir="ltr"
                    className="text-left text-xs flex-1"
                    value={form.videoUrl}
                    onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))}
                    placeholder="رابط الفيديو أو ارفع ملف..."
                  />
                  <Button type="button" variant="outline" size="sm" disabled={uploadingVideo} onClick={() => videoRef.current?.click()} className="shrink-0 gap-1.5">
                    {uploadingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    رفع
                  </Button>
                  <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f, "video"); }} />
                </div>
              </div>

              {/* Thumbnail Upload */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">صورة مصغرة</label>
                <div className="flex gap-2">
                  {form.thumbnailUrl && (
                    <img src={form.thumbnailUrl} alt="" className="h-10 w-16 object-cover rounded border shrink-0" />
                  )}
                  <Input
                    dir="ltr"
                    className="text-left text-xs flex-1"
                    value={form.thumbnailUrl}
                    onChange={(e) => setForm((f) => ({ ...f, thumbnailUrl: e.target.value }))}
                    placeholder="رابط الصورة أو ارفع ملف..."
                  />
                  <Button type="button" variant="outline" size="sm" disabled={uploadingThumb} onClick={() => thumbRef.current?.click()} className="shrink-0 gap-1.5">
                    {uploadingThumb ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    رفع
                  </Button>
                  <input ref={thumbRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f, "thumb"); }} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>إلغاء</Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "جاري الحفظ..." : "حفظ"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Page */}
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
            <Button onClick={openCreate} className="mt-4 gap-2"><Plus className="w-4 h-4" /> إضافة أول فيديو</Button>
          </div>
        )}

        {!isLoading && ads && ads.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ads.map((ad) => (
              <div key={ad.id} className="group bg-card border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                {/* Thumbnail */}
                <div
                  className="relative aspect-video bg-muted cursor-pointer"
                  onClick={() => setPreviewAd(ad as Ad)}
                >
                  {ad.thumbnailUrl ? (
                    <img src={ad.thumbnailUrl} alt={ad.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="w-10 h-10 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="bg-white/90 rounded-full p-2.5 shadow">
                      <Play className="w-6 h-6 text-primary fill-primary" />
                    </div>
                  </div>
                </div>

                {/* Info + actions */}
                <div className="p-3 space-y-2">
                  <p className="font-semibold text-sm line-clamp-1">{ad.title}</p>
                  {ad.description && <p className="text-xs text-muted-foreground line-clamp-2">{ad.description}</p>}
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1 gap-1.5 h-8 text-xs" onClick={() => openEdit(ad as Ad)}>
                      <Pencil className="w-3.5 h-3.5" /> تعديل
                    </Button>
                    <Button variant="destructive" size="sm" className="h-8 px-3" onClick={() => handleDelete(ad.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
