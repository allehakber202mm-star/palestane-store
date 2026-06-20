import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  useAdminListAccounts,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
  getAdminListAccountsQueryKey,
  getGetDashboardStatsQueryKey,
  AccountInput,
  AccountUpdate,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Edit2, Trash2, Image as ImageIcon,
  Star, Check, X, Loader2, UploadCloud,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SiTiktok, SiInstagram, SiFacebook } from "react-icons/si";

const PLATFORM_MAP: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  tiktok:    { label: "تيك توك",  icon: <SiTiktok />,    color: "text-foreground" },
  instagram: { label: "انستغرام", icon: <SiInstagram />,  color: "text-pink-500" },
  facebook:  { label: "فيسبوك",   icon: <SiFacebook />,   color: "text-blue-500" },
};

type FormState = {
  name: string;
  platform: string;
  followers: string;
  price: string;
  description: string;
  status: string;
  featured: boolean;
  imageUrl: string;
};

const EMPTY_FORM: FormState = {
  name: "", platform: "tiktok", followers: "", price: "",
  description: "", status: "available", featured: false, imageUrl: "",
};

export default function AdminAccounts() {
  const [search, setSearch]     = useState("");
  const [platform, setPlatform] = useState("all");
  const [status, setStatus]     = useState("all");
  const [open, setOpen]         = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm]         = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors]     = useState<Partial<Record<keyof FormState, string>>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: accounts, isLoading } = useAdminListAccounts({
    search: search || undefined,
    platform: platform !== "all" ? platform : undefined,
    status: status !== "all" ? status : undefined,
  });

  const createMut = useCreateAccount();
  const updateMut = useUpdateAccount();
  const deleteMut = useDeleteAccount();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getAdminListAccountsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
  };

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setOpen(true);
  };

  const openEdit = (acc: any) => {
    setEditingId(acc.id);
    setForm({
      name: acc.name,
      platform: acc.platform,
      followers: String(acc.followers),
      price: String(acc.price),
      description: acc.description || "",
      status: acc.status,
      featured: acc.featured,
      imageUrl: acc.imageUrl || "",
    });
    setErrors({});
    setOpen(true);
  };

  const validate = (): boolean => {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = "الاسم مطلوب";
    if (!form.followers || isNaN(Number(form.followers))) e.followers = "عدد غير صالح";
    if (!form.price || isNaN(Number(form.price))) e.price = "سعر غير صالح";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      name: form.name.trim(),
      platform: form.platform as "tiktok" | "instagram" | "facebook",
      followers: Number(form.followers),
      price: Number(form.price),
      description: form.description || null,
      status: form.status as "available" | "sold",
      featured: form.featured,
      imageUrl: form.imageUrl || null,
    };

    if (editingId) {
      updateMut.mutate(
        { id: editingId, data: payload as AccountUpdate },
        {
          onSuccess: () => {
            toast({ title: "✅ تم تحديث الحساب" });
            setOpen(false);
            invalidate();
          },
          onError: () => toast({ variant: "destructive", title: "فشل التحديث" }),
        }
      );
    } else {
      createMut.mutate(
        { data: payload as AccountInput },
        {
          onSuccess: () => {
            toast({ title: "✅ تم إضافة الحساب" });
            setOpen(false);
            invalidate();
          },
          onError: () => toast({ variant: "destructive", title: "فشل الإضافة" }),
        }
      );
    }
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMut.mutate(
      { id: deleteId },
      {
        onSuccess: () => {
          toast({ title: "🗑️ تم حذف الحساب" });
          setDeleteId(null);
          invalidate();
        },
      }
    );
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("image", file);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin/accounts/upload-image", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setField("imageUrl", data.url);
      toast({ title: "تم رفع الصورة" });
    } catch {
      toast({ variant: "destructive", title: "فشل رفع الصورة" });
    } finally {
      setUploading(false);
    }
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">إدارة الحسابات</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {accounts?.length ?? "..."} حساب مسجّل
            </p>
          </div>
          <Button onClick={openAdd} className="gap-2 font-bold">
            <Plus className="h-4 w-4" /> إضافة
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 bg-card p-3 rounded-xl border">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم..."
              className="pr-9 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="h-9 w-full sm:w-40">
              <SelectValue placeholder="المنصة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المنصات</SelectItem>
              <SelectItem value="tiktok">تيك توك</SelectItem>
              <SelectItem value="instagram">انستغرام</SelectItem>
              <SelectItem value="facebook">فيسبوك</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-full sm:w-40">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="available">متاح</SelectItem>
              <SelectItem value="sold">مباع</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Accounts Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : !accounts?.length ? (
          <div className="text-center py-20 border border-dashed rounded-xl text-muted-foreground">
            لا يوجد حسابات مطابقة
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {accounts.map((acc) => {
              const plt = PLATFORM_MAP[acc.platform] ?? PLATFORM_MAP.tiktok;
              return (
                <div
                  key={acc.id}
                  className="group relative bg-card border rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-primary/40 transition-all flex flex-col"
                >
                  {/* Image */}
                  <div className="relative h-36 bg-muted flex items-center justify-center overflow-hidden">
                    {acc.imageUrl ? (
                      <img
                        src={acc.imageUrl}
                        alt={acc.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
                    )}
                    {/* Badges */}
                    <div className="absolute top-2 left-2 flex gap-1">
                      <Badge
                        className={`text-[10px] px-1.5 py-0 border-none ${
                          acc.status === "available"
                            ? "bg-green-500/90 text-white"
                            : "bg-destructive/90 text-white"
                        }`}
                      >
                        {acc.status === "available" ? "متاح" : "مباع"}
                      </Badge>
                      {acc.featured && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-yellow-500/90 text-white border-none">
                          <Star className="w-2.5 h-2.5 mr-0.5" />مميز
                        </Badge>
                      )}
                    </div>
                    {/* Action buttons — appear on hover */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEdit(acc)}
                        className="flex items-center gap-1.5 bg-white text-foreground text-xs font-bold px-3 py-1.5 rounded-full hover:bg-primary hover:text-white transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> تعديل
                      </button>
                      <button
                        onClick={() => setDeleteId(acc.id)}
                        className="flex items-center gap-1.5 bg-white text-destructive text-xs font-bold px-3 py-1.5 rounded-full hover:bg-destructive hover:text-white transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> حذف
                      </button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3 flex flex-col gap-1.5 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs ${plt.color}`}>{plt.icon}</span>
                      <span className="font-bold text-sm line-clamp-1" dir="ltr">{acc.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {acc.followers >= 1000
                          ? `${(acc.followers / 1000).toFixed(0)}K`
                          : acc.followers}{" "}
                        متابع
                      </span>
                      <span className="font-black text-primary text-sm">{acc.price}₪</span>
                    </div>
                    {/* Quick edit buttons on mobile (always visible) */}
                    <div className="flex gap-1.5 mt-1 sm:hidden">
                      <button
                        onClick={() => openEdit(acc)}
                        className="flex-1 flex items-center justify-center gap-1 border rounded-lg py-1.5 text-xs font-bold hover:bg-primary hover:text-white hover:border-primary transition-colors"
                      >
                        <Edit2 className="w-3 h-3" /> تعديل
                      </button>
                      <button
                        onClick={() => setDeleteId(acc.id)}
                        className="flex-1 flex items-center justify-center gap-1 border rounded-lg py-1.5 text-xs font-bold text-destructive hover:bg-destructive hover:text-white hover:border-destructive transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> حذف
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Edit / Add Sheet ─── */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
          <SheetHeader className="px-5 pt-5 pb-4 border-b bg-muted/30">
            <SheetTitle className="text-lg font-bold">
              {editingId ? "✏️ تعديل الحساب" : "➕ إضافة حساب جديد"}
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-5 pb-8">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name">اسم الحساب (يوزر)</Label>
              <Input
                id="name"
                dir="ltr"
                className="text-left"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="@username"
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            {/* Platform */}
            <div className="space-y-1.5">
              <Label>المنصة</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["tiktok", "instagram", "facebook"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setField("platform", p)}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                      form.platform === p
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span className={`text-base ${PLATFORM_MAP[p].color}`}>
                      {PLATFORM_MAP[p].icon}
                    </span>
                    {PLATFORM_MAP[p].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Followers + Price */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="followers">المتابعين</Label>
                <Input
                  id="followers"
                  type="number"
                  dir="ltr"
                  className="text-left"
                  value={form.followers}
                  onChange={(e) => setField("followers", e.target.value)}
                  placeholder="10000"
                />
                {errors.followers && <p className="text-xs text-destructive">{errors.followers}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="price">السعر (₪)</Label>
                <Input
                  id="price"
                  type="number"
                  dir="ltr"
                  className="text-left"
                  value={form.price}
                  onChange={(e) => setField("price", e.target.value)}
                  placeholder="500"
                />
                {errors.price && <p className="text-xs text-destructive">{errors.price}</p>}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="desc">وصف (اختياري)</Label>
              <Textarea
                id="desc"
                rows={3}
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="وصف مختصر للحساب..."
              />
            </div>

            {/* Image upload */}
            <div className="space-y-2">
              <Label>صورة الحساب</Label>
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 rounded-lg border overflow-hidden bg-muted flex items-center justify-center shrink-0">
                  {form.imageUrl ? (
                    <img src={form.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileRef}
                    onChange={handleImageUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="gap-1.5"
                  >
                    {uploading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <UploadCloud className="w-3.5 h-3.5" />
                    )}
                    {uploading ? "جاري الرفع..." : "رفع صورة"}
                  </Button>
                  {form.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setField("imageUrl", "")}
                      className="text-xs text-destructive hover:underline flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> إزالة الصورة
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Status + Featured */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>الحالة</Label>
                <Select value={form.status} onValueChange={(v) => setField("status", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">✅ متاح للبيع</SelectItem>
                    <SelectItem value="sold">❌ تم البيع</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>حساب مميز</Label>
                <div className="flex items-center gap-3 h-10 px-3 border rounded-md bg-background">
                  <Switch
                    checked={form.featured}
                    onCheckedChange={(v) => setField("featured", v)}
                  />
                  <span className="text-sm text-muted-foreground">
                    {form.featured ? "نعم ⭐" : "لا"}
                  </span>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(false)}
              >
                إلغاء
              </Button>
              <Button type="submit" className="flex-1 gap-1.5 font-bold" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {editingId ? "حفظ التعديلات" : "إضافة الحساب"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الحساب؟</AlertDialogTitle>
            <AlertDialogDescription>
              هذا الإجراء لا يمكن التراجع عنه. سيُحذف الحساب نهائياً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
