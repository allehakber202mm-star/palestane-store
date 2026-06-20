import { useState, useRef } from "react";
import { uploadImageToStorage } from "@/lib/uploadImage";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  useGetDashboardStats,
  useAdminListAccounts,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
  useGetSettings,
  useUpdateSettings,
  getAdminListAccountsQueryKey,
  getGetDashboardStatsQueryKey,
  getGetSettingsQueryKey,
  AccountInput,
  AccountUpdate,
  SiteSettingsUpdate,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Edit2, Trash2, DollarSign, Users, Image as ImageIcon,
  CheckCircle, XCircle, Settings, Package, MousePointerClick,
  MessageCircle, Loader2, UploadCloud, X, Check,
  ShoppingBag, TrendingUp, ExternalLink,
} from "lucide-react";
import { SiTiktok, SiInstagram, SiFacebook } from "react-icons/si";

// ─── Types ────────────────────────────────────────────────────────────────────
type Mode =
  | null
  | "add"
  | "edit"
  | "prices"
  | "followers"
  | "images"
  | "sold"
  | "available"
  | "settings";

type AccountRow = Awaited<ReturnType<typeof import("@workspace/api-client-react").adminListAccounts>>[number];

type FormState = {
  name: string; platform: string; followers: string; price: string;
  description: string; status: string; featured: boolean; imageUrl: string; accountUrl: string;
};
const EMPTY_FORM: FormState = {
  name: "", platform: "tiktok", followers: "", price: "",
  description: "", status: "available", featured: false, imageUrl: "", accountUrl: "",
};

const PLT: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  tiktok:    { label: "تيك توك",  icon: <SiTiktok />,   color: "text-foreground" },
  instagram: { label: "انستغرام", icon: <SiInstagram />, color: "text-pink-500" },
  facebook:  { label: "فيسبوك",   icon: <SiFacebook />,  color: "text-blue-500" },
};

function fmt(n: number) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [mode, setMode]         = useState<Mode>(null);
  const [editRow, setEditRow]   = useState<AccountRow | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm]         = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors]     = useState<Partial<Record<keyof FormState, string>>>({});
  const [uploading, setUploading]   = useState(false);
  const [inlineVals, setInlineVals] = useState<Record<number, string>>({});
  const [saving, setSaving]         = useState<Record<number, boolean>>({});
  const [settingsForm, setSettingsForm] = useState<{
    storeName: string; whatsapp: string; bannerTitle: string;
    bannerSubtitle: string; paymentMethods: string; paymentNote: string;
  } | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageAccountRef = useRef<AccountRow | null>(null);

  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: accounts, isLoading: accsLoading } = useAdminListAccounts({});
  const { data: settings } = useGetSettings();

  const createMut  = useCreateAccount();
  const updateMut  = useUpdateAccount();
  const deleteMut  = useDeleteAccount();
  const settingsMut = useUpdateSettings();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getAdminListAccountsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
  };

  // ── Form helpers ─────────────────────────────────────────────────────────
  const setF = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const validate = () => {
    const e: typeof errors = {};
    if (!form.name.trim())                             e.name = "الاسم مطلوب";
    if (!form.followers || isNaN(Number(form.followers))) e.followers = "عدد غير صالح";
    if (!form.price || isNaN(Number(form.price)))        e.price = "سعر غير صالح";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const openAdd = () => {
    setEditRow(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setMode("add");
  };

  const openEdit = (acc: AccountRow) => {
    setEditRow(acc);
    setForm({
      name: acc.name, platform: acc.platform, followers: String(acc.followers),
      price: String(acc.price), description: acc.description || "",
      status: acc.status, featured: acc.featured ?? false, imageUrl: acc.imageUrl || "",
      accountUrl: acc.accountUrl || "",
    });
    setErrors({});
    setMode("edit");
  };

  // ── Submit account form ───────────────────────────────────────────────────
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const rawUrl = form.accountUrl.trim();
    const urlValid = !rawUrl || /^https?:\/\/.+/.test(rawUrl);
    if (!urlValid) {
      setErrors((e) => ({ ...e, accountUrl: "الرابط غير صالح، يجب أن يبدأ بـ https://" }));
      return;
    }
    const payload = {
      name: form.name.trim(),
      platform: form.platform as "tiktok" | "instagram" | "facebook",
      followers: Number(form.followers), price: Number(form.price),
      description: form.description || null,
      status: form.status as "available" | "sold",
      featured: form.featured, imageUrl: form.imageUrl || null,
      accountUrl: rawUrl || null,
    };
    if (mode === "edit" && editRow) {
      updateMut.mutate({ id: editRow.id, data: payload as AccountUpdate }, {
        onSuccess: () => { toast({ title: "✅ تم التحديث" }); setMode(null); invalidate(); },
        onError:   () => toast({ variant: "destructive", title: "فشل التحديث" }),
      });
    } else {
      createMut.mutate({ data: payload as AccountInput }, {
        onSuccess: () => { toast({ title: "✅ تمت الإضافة" }); setMode(null); invalidate(); },
        onError:   () => toast({ variant: "destructive", title: "فشل الإضافة" }),
      });
    }
  };

  // ── Inline update (price / followers) ────────────────────────────────────
  const saveInline = (acc: AccountRow, field: "price" | "followers") => {
    const raw = inlineVals[acc.id];
    const val = Number(raw);
    if (isNaN(val) || raw === undefined) return;
    setSaving((s) => ({ ...s, [acc.id]: true }));
    updateMut.mutate({ id: acc.id, data: { [field]: val } as AccountUpdate }, {
      onSuccess: () => {
        toast({ title: `✅ تم تحديث ${field === "price" ? "السعر" : "المتابعين"}` });
        setInlineVals((v) => { const n = { ...v }; delete n[acc.id]; return n; });
        invalidate();
      },
      onError: () => toast({ variant: "destructive", title: "فشل التحديث" }),
      onSettled: () => setSaving((s) => ({ ...s, [acc.id]: false })),
    });
  };

  // ── Mark sold / available ─────────────────────────────────────────────────
  const toggleStatus = (acc: AccountRow) => {
    const newStatus = acc.status === "available" ? "sold" : "available";
    updateMut.mutate({ id: acc.id, data: { status: newStatus } as AccountUpdate }, {
      onSuccess: () => { toast({ title: `تم تحديث الحالة` }); invalidate(); },
    });
  };

  // ── Image upload ──────────────────────────────────────────────────────────
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const acc  = imageAccountRef.current;
    if (!file || !acc) return;
    setUploading(true);
    try {
      const url = await uploadImageToStorage(file);
      updateMut.mutate({ id: acc.id, data: { imageUrl: url } as AccountUpdate }, {
        onSuccess: () => { toast({ title: "✅ تم تحديث الصورة" }); invalidate(); },
      });
    } catch {
      toast({ variant: "destructive", title: "فشل رفع الصورة" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // ── Form image upload (inside add/edit form) ──────────────────────────────
  const formFileRef = useRef<HTMLInputElement>(null);
  const handleFormImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImageToStorage(file);
      setF("imageUrl", url);
      toast({ title: "تم رفع الصورة" });
    } catch {
      toast({ variant: "destructive", title: "فشل رفع الصورة" });
    } finally { setUploading(false); }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = () => {
    if (!deleteId) return;
    deleteMut.mutate({ id: deleteId }, {
      onSuccess: () => { toast({ title: "🗑️ تم الحذف" }); setDeleteId(null); invalidate(); },
    });
  };

  // ── Settings ──────────────────────────────────────────────────────────────
  const openSettings = () => {
    setSettingsForm({
      storeName:      settings?.storeName      || "",
      whatsapp:       settings?.whatsapp       || "",
      bannerTitle:    settings?.bannerTitle    || "",
      bannerSubtitle: settings?.bannerSubtitle || "",
      paymentMethods: (settings?.paymentMethods || []).join("، "),
      paymentNote:    settings?.paymentNote    || "",
    });
    setMode("settings");
  };

  const handleSettingsSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsForm) return;
    setSettingsSaving(true);
    const payload: SiteSettingsUpdate = {
      storeName:      settingsForm.storeName,
      whatsapp:       settingsForm.whatsapp,
      bannerTitle:    settingsForm.bannerTitle,
      bannerSubtitle: settingsForm.bannerSubtitle,
      paymentMethods: settingsForm.paymentMethods
        .split(/[،,]/)
        .map((s) => s.trim())
        .filter(Boolean),
      paymentNote:    settingsForm.paymentNote,
    };
    settingsMut.mutate({ data: payload }, {
      onSuccess: () => {
        toast({ title: "✅ تم حفظ الإعدادات" });
        setMode(null);
        qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      },
      onError: () => toast({ variant: "destructive", title: "فشل الحفظ" }),
      onSettled: () => setSettingsSaving(false),
    });
  };

  // ── Filtered accounts ─────────────────────────────────────────────────────
  const filteredAccounts = accounts?.filter((a) => {
    if (mode === "sold")      return a.status === "sold";
    if (mode === "available") return a.status === "available";
    return true;
  }) ?? [];

  // ── Quick action cards def ────────────────────────────────────────────────
  const quickCards = [
    { icon: <Plus className="w-6 h-6" />,          label: "إضافة حساب",       sub: "أضف حساباً جديداً",         color: "bg-primary/10 border-primary/30 hover:bg-primary/20",           action: openAdd },
    { icon: <Edit2 className="w-6 h-6" />,         label: "تعديل الحسابات",   sub: "تعديل شامل لأي حساب",       color: "bg-blue-500/10 border-blue-400/30 hover:bg-blue-500/20",         action: () => setMode("edit" as Mode) },
    { icon: <DollarSign className="w-6 h-6" />,    label: "إدارة الأسعار",    sub: "تعديل أسعار الحسابات",      color: "bg-yellow-500/10 border-yellow-400/30 hover:bg-yellow-500/20",   action: () => { setInlineVals({}); setMode("prices"); } },
    { icon: <Users className="w-6 h-6" />,         label: "إدارة المتابعين",  sub: "تعديل عدد المتابعين",       color: "bg-purple-500/10 border-purple-400/30 hover:bg-purple-500/20",   action: () => { setInlineVals({}); setMode("followers"); } },
    { icon: <ImageIcon className="w-6 h-6" />,     label: "إدارة الصور",      sub: "تغيير صور الحسابات",        color: "bg-pink-500/10 border-pink-400/30 hover:bg-pink-500/20",         action: () => setMode("images") },
    { icon: <XCircle className="w-6 h-6" />,       label: "الحسابات المباعة", sub: `${stats?.soldAccounts ?? "..."} حساب`,     color: "bg-destructive/10 border-destructive/30 hover:bg-destructive/20", action: () => setMode("sold") },
    { icon: <CheckCircle className="w-6 h-6" />,   label: "الحسابات المتاحة", sub: `${stats?.availableAccounts ?? "..."} حساب`, color: "bg-green-500/10 border-green-400/30 hover:bg-green-500/20",      action: () => setMode("available") },
    { icon: <Settings className="w-6 h-6" />,      label: "إعدادات الموقع",   sub: "البانر، الواتساب، الدفع",   color: "bg-muted/60 border-border hover:bg-muted",                       action: openSettings },
  ];

  const isPending = createMut.isPending || updateMut.isPending;

  // ── Sheet title ───────────────────────────────────────────────────────────
  const sheetTitle: Record<string, string> = {
    add: "➕ إضافة حساب جديد", edit: "✏️ تعديل الحساب",
    prices: "💰 إدارة الأسعار", followers: "👥 إدارة المتابعين",
    images: "📷 إدارة الصور", sold: "❌ الحسابات المباعة",
    available: "✅ الحسابات المتاحة", settings: "⚙️ إعدادات الموقع",
  };

  return (
    <AdminLayout>
      <div className="space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-black">لوحة التحكم</h1>
          <p className="text-sm text-muted-foreground mt-0.5">أدر متجرك بالكامل من هنا</p>
        </div>

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { icon: <Package className="w-4 h-4" />,            label: "إجمالي الحسابات",  val: stats?.totalAccounts,     color: "text-foreground" },
            { icon: <CheckCircle className="w-4 h-4" />,        label: "متاح",              val: stats?.availableAccounts, color: "text-green-500" },
            { icon: <ShoppingBag className="w-4 h-4" />,        label: "مباع",              val: stats?.soldAccounts,      color: "text-destructive" },
            { icon: <MousePointerClick className="w-4 h-4" />,  label: "إجمالي النقرات",   val: stats?.totalClicks,       color: "text-blue-500" },
            { icon: <MessageCircle className="w-4 h-4" />,      label: "نقرات واتساب",     val: stats?.whatsappClicks,    color: "text-[#25D366]" },
          ].map((s, i) => (
            <div key={i} className="bg-card border rounded-xl p-3 sm:p-4 flex flex-col gap-1 shadow-sm">
              <div className={`${s.color} flex items-center gap-1.5 text-xs font-medium text-muted-foreground`}>
                {s.icon} {s.label}
              </div>
              {statsLoading ? (
                <Skeleton className="h-7 w-12 mt-1" />
              ) : (
                <div className={`text-2xl font-black ${s.color}`}>{s.val ?? 0}</div>
              )}
            </div>
          ))}
        </div>

        {/* ── Quick Action Cards ─────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">إجراءات سريعة</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3">
            {quickCards.map((c, i) => (
              <button
                key={i}
                onClick={c.action}
                className={`flex flex-col items-center text-center gap-2 p-3 sm:p-4 rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5 ${c.color}`}
              >
                <div className="p-2 rounded-lg bg-background/80 shadow-sm">{c.icon}</div>
                <div>
                  <div className="text-xs sm:text-sm font-bold leading-tight">{c.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">{c.sub}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Full Accounts Table ────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">جميع الحسابات</h2>
            <Button size="sm" onClick={openAdd} className="gap-1.5 h-8 text-xs">
              <Plus className="w-3.5 h-3.5" /> إضافة
            </Button>
          </div>

          <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
            {accsLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
              </div>
            ) : !accounts?.length ? (
              <div className="text-center py-16 text-muted-foreground text-sm">لا يوجد حسابات</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/30">
                    <tr>
                      <th className="text-right py-3 px-3 font-semibold text-xs text-muted-foreground">صورة</th>
                      <th className="text-right py-3 px-3 font-semibold text-xs text-muted-foreground">الاسم</th>
                      <th className="text-right py-3 px-3 font-semibold text-xs text-muted-foreground hidden sm:table-cell">المنصة</th>
                      <th className="text-right py-3 px-3 font-semibold text-xs text-muted-foreground hidden md:table-cell">المتابعين</th>
                      <th className="text-right py-3 px-3 font-semibold text-xs text-muted-foreground">السعر</th>
                      <th className="text-right py-3 px-3 font-semibold text-xs text-muted-foreground">الحالة</th>
                      <th className="text-left  py-3 px-3 font-semibold text-xs text-muted-foreground">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {accounts.map((acc) => {
                      const plt = PLT[acc.platform] ?? PLT.tiktok;
                      return (
                        <tr key={acc.id} className="hover:bg-muted/20 transition-colors group">
                          {/* Image */}
                          <td className="py-2 px-3">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted border shrink-0">
                              {acc.imageUrl
                                ? <img src={acc.imageUrl} alt="" className="w-full h-full object-cover" />
                                : <ImageIcon className="w-4 h-4 m-auto text-muted-foreground/40 mt-3" />}
                            </div>
                          </td>
                          {/* Name */}
                          <td className="py-2 px-3">
                            <div className="font-bold text-xs sm:text-sm line-clamp-1 max-w-[120px]" dir="ltr">{acc.name}</div>
                            {acc.featured && <span className="text-[10px] text-yellow-500 font-medium">★ مميز</span>}
                          </td>
                          {/* Platform */}
                          <td className="py-2 px-3 hidden sm:table-cell">
                            <span className={`flex items-center gap-1 text-xs ${plt.color}`}>
                              {plt.icon} {plt.label}
                            </span>
                          </td>
                          {/* Followers */}
                          <td className="py-2 px-3 hidden md:table-cell">
                            <span className="text-xs text-muted-foreground">{fmt(acc.followers)}</span>
                          </td>
                          {/* Price */}
                          <td className="py-2 px-3">
                            <span className="font-black text-primary text-sm">{acc.price}₪</span>
                          </td>
                          {/* Status */}
                          <td className="py-2 px-3">
                            <button onClick={() => toggleStatus(acc)}>
                              <Badge className={`text-[10px] cursor-pointer transition-opacity hover:opacity-80 ${
                                acc.status === "available"
                                  ? "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30"
                                  : "bg-destructive/20 text-destructive border-destructive/30"
                              }`}>
                                {acc.status === "available" ? "متاح" : "مباع"}
                              </Badge>
                            </button>
                          </td>
                          {/* Actions */}
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1 justify-end flex-wrap">
                              <button
                                title="تعديل"
                                onClick={() => openEdit(acc)}
                                className="p-1.5 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                title="تعديل السعر"
                                onClick={() => { setInlineVals({ [acc.id]: String(acc.price) }); setMode("prices"); }}
                                className="p-1.5 rounded-lg hover:bg-yellow-500/10 hover:text-yellow-600 transition-colors"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                              </button>
                              <button
                                title="تعديل المتابعين"
                                onClick={() => { setInlineVals({ [acc.id]: String(acc.followers) }); setMode("followers"); }}
                                className="p-1.5 rounded-lg hover:bg-purple-500/10 hover:text-purple-600 transition-colors"
                              >
                                <TrendingUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                title="تغيير الصورة"
                                onClick={() => { imageAccountRef.current = acc; fileRef.current?.click(); }}
                                className="p-1.5 rounded-lg hover:bg-pink-500/10 hover:text-pink-600 transition-colors"
                              >
                                <ImageIcon className="w-3.5 h-3.5" />
                              </button>
                              <button
                                title="حذف"
                                onClick={() => setDeleteId(acc.id)}
                                className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Hidden file input for image (table row) ───────────────────────── */}
      <input type="file" accept="image/*" className="hidden" ref={fileRef} onChange={handleImageChange} />

      {/* ════════════════════════════════════════════════════════════════════
          Sheet Panel — changes content based on mode
      ════════════════════════════════════════════════════════════════════ */}
      <Sheet open={!!mode} onOpenChange={(o) => !o && setMode(null)}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg overflow-y-auto p-0 flex flex-col"
        >
          <SheetHeader className="px-5 pt-5 pb-4 border-b bg-muted/30 shrink-0">
            <SheetTitle className="text-base font-bold">
              {mode ? sheetTitle[mode] : ""}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">

            {/* ── Add / Edit Form ─────────────────────────────────────── */}
            {(mode === "add" || mode === "edit") && (
              <form onSubmit={handleFormSubmit} className="flex flex-col gap-5 p-5 pb-8">
                {/* Name */}
                <div className="space-y-1.5">
                  <Label>اسم الحساب (يوزر)</Label>
                  <Input dir="ltr" className="text-left" value={form.name}
                    onChange={(e) => setF("name", e.target.value)} placeholder="@username" />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>

                {/* Platform */}
                <div className="space-y-1.5">
                  <Label>المنصة</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["tiktok", "instagram", "facebook"] as const).map((p) => (
                      <button key={p} type="button" onClick={() => setF("platform", p)}
                        className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                          form.platform === p ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"
                        }`}>
                        <span className={`text-base ${PLT[p].color}`}>{PLT[p].icon}</span>
                        {PLT[p].label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Followers + Price */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>المتابعين</Label>
                    <Input type="number" dir="ltr" className="text-left" value={form.followers}
                      onChange={(e) => setF("followers", e.target.value)} placeholder="10000" />
                    {errors.followers && <p className="text-xs text-destructive">{errors.followers}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label>السعر (₪)</Label>
                    <Input type="number" dir="ltr" className="text-left" value={form.price}
                      onChange={(e) => setF("price", e.target.value)} placeholder="500" />
                    {errors.price && <p className="text-xs text-destructive">{errors.price}</p>}
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label>وصف (اختياري)</Label>
                  <Textarea rows={2} value={form.description}
                    onChange={(e) => setF("description", e.target.value)} placeholder="وصف مختصر..." />
                </div>

                {/* Account URL */}
                <div className="space-y-1.5">
                  <Label>رابط الحساب (اختياري)</Label>
                  <div className="relative">
                    <Input
                      dir="ltr"
                      className="text-left pe-9"
                      value={form.accountUrl}
                      onChange={(e) => setF("accountUrl", e.target.value)}
                      placeholder={
                        form.platform === "instagram"
                          ? "https://www.instagram.com/username"
                          : form.platform === "facebook"
                          ? "https://www.facebook.com/page"
                          : "https://www.tiktok.com/@username"
                      }
                    />
                    {form.accountUrl && (
                      <a
                        href={form.accountUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute top-1/2 -translate-y-1/2 left-2.5 text-muted-foreground hover:text-primary transition-colors"
                        tabIndex={-1}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                  {errors.accountUrl && (
                    <p className="text-xs text-destructive">{errors.accountUrl}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    سيظهر زر "زيارة الحساب" للزوار عند إضافة رابط
                  </p>
                </div>

                {/* Image */}
                <div className="space-y-2">
                  <Label>صورة الحساب</Label>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-lg border overflow-hidden bg-muted flex items-center justify-center shrink-0">
                      {form.imageUrl
                        ? <img src={form.imageUrl} alt="" className="w-full h-full object-cover" />
                        : <ImageIcon className="w-5 h-5 text-muted-foreground/40" />}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <input type="file" accept="image/*" className="hidden" ref={formFileRef} onChange={handleFormImageUpload} />
                      <Button type="button" variant="outline" size="sm" onClick={() => formFileRef.current?.click()}
                        disabled={uploading} className="gap-1.5">
                        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                        {uploading ? "جاري الرفع..." : "رفع صورة"}
                      </Button>
                      {form.imageUrl && (
                        <button type="button" onClick={() => setF("imageUrl", "")}
                          className="text-xs text-destructive hover:underline flex items-center gap-1">
                          <X className="w-3 h-3" /> إزالة
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status + Featured */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>الحالة</Label>
                    <Select value={form.status} onValueChange={(v) => setF("status", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">✅ متاح للبيع</SelectItem>
                        <SelectItem value="sold">❌ تم البيع</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>مميز</Label>
                    <div className="flex items-center gap-3 h-10 px-3 border rounded-md bg-background">
                      <Switch checked={form.featured} onCheckedChange={(v) => setF("featured", v)} />
                      <span className="text-sm text-muted-foreground">{form.featured ? "نعم ⭐" : "لا"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setMode(null)}>إلغاء</Button>
                  <Button type="submit" className="flex-1 gap-1.5 font-bold" disabled={isPending}>
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {mode === "edit" ? "حفظ التعديلات" : "إضافة الحساب"}
                  </Button>
                </div>
              </form>
            )}

            {/* ── Prices / Followers inline edit ──────────────────────── */}
            {(mode === "prices" || mode === "followers") && (
              <div className="p-4 space-y-2">
                <p className="text-xs text-muted-foreground mb-4">
                  {mode === "prices"
                    ? "عدّل السعر لأي حساب ثم اضغط ✓ للحفظ الفوري."
                    : "عدّل عدد المتابعين لأي حساب ثم اضغط ✓ للحفظ الفوري."}
                </p>
                {accounts?.map((acc) => {
                  const plt = PLT[acc.platform] ?? PLT.tiktok;
                  const field = mode === "prices" ? "price" : "followers";
                  const current = mode === "prices" ? acc.price : acc.followers;
                  const val = inlineVals[acc.id] ?? String(current);
                  const changed = val !== String(current);
                  return (
                    <div key={acc.id} className="flex items-center gap-3 bg-muted/30 rounded-xl p-3 border">
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-muted border shrink-0">
                        {acc.imageUrl
                          ? <img src={acc.imageUrl} alt="" className="w-full h-full object-cover" />
                          : <div className={`w-full h-full flex items-center justify-center text-xs ${plt.color}`}>{plt.icon}</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs line-clamp-1" dir="ltr">{acc.name}</div>
                        <div className={`text-[10px] ${plt.color}`}>{plt.label}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Input
                          type="number"
                          dir="ltr"
                          className="w-24 h-8 text-xs text-left"
                          value={val}
                          onChange={(e) => setInlineVals((v) => ({ ...v, [acc.id]: e.target.value }))}
                        />
                        <span className="text-xs text-muted-foreground">{mode === "prices" ? "₪" : "👥"}</span>
                        {changed && (
                          <button
                            onClick={() => saveInline(acc, field)}
                            disabled={saving[acc.id]}
                            className="w-8 h-8 flex items-center justify-center bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                          >
                            {saving[acc.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Images manager ───────────────────────────────────────── */}
            {mode === "images" && (
              <div className="p-4 space-y-2">
                <p className="text-xs text-muted-foreground mb-4">اضغط على الكاميرا لتغيير صورة أي حساب مباشرة.</p>
                {accounts?.map((acc) => {
                  const plt = PLT[acc.platform] ?? PLT.tiktok;
                  return (
                    <div key={acc.id} className="flex items-center gap-3 bg-muted/30 rounded-xl p-3 border">
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted border shrink-0">
                        {acc.imageUrl
                          ? <img src={acc.imageUrl} alt="" className="w-full h-full object-cover" />
                          : <div className={`w-full h-full flex items-center justify-center ${plt.color}`}><ImageIcon className="w-5 h-5 opacity-30" /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm line-clamp-1" dir="ltr">{acc.name}</div>
                        <div className={`text-xs ${plt.color}`}>{plt.label}</div>
                      </div>
                      <button
                        onClick={() => { imageAccountRef.current = acc; fileRef.current?.click(); }}
                        disabled={uploading}
                        className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-bold hover:bg-primary/10 hover:border-primary transition-colors"
                      >
                        {uploading && imageAccountRef.current?.id === acc.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <ImageIcon className="w-3.5 h-3.5" />}
                        تغيير
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Sold / Available filter view ─────────────────────────── */}
            {(mode === "sold" || mode === "available") && (
              <div className="p-4 space-y-2">
                <p className="text-xs text-muted-foreground mb-3">
                  {filteredAccounts.length} حساب {mode === "sold" ? "مباع" : "متاح"}
                </p>
                {filteredAccounts.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">لا يوجد حسابات</div>
                )}
                {filteredAccounts.map((acc) => {
                  const plt = PLT[acc.platform] ?? PLT.tiktok;
                  return (
                    <div key={acc.id} className="flex items-center gap-3 bg-muted/30 rounded-xl p-3 border">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted border shrink-0">
                        {acc.imageUrl ? <img src={acc.imageUrl} alt="" className="w-full h-full object-cover" /> : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm line-clamp-1" dir="ltr">{acc.name}</div>
                        <div className={`text-xs ${plt.color}`}>{plt.label} · {fmt(acc.followers)} متابع</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="font-black text-primary text-sm">{acc.price}₪</span>
                        <button
                          onClick={() => toggleStatus(acc)}
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-bold transition-colors ${
                            acc.status === "sold"
                              ? "bg-green-500/10 text-green-600 border-green-400/30 hover:bg-green-500/20"
                              : "bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20"
                          }`}
                        >
                          {acc.status === "sold" ? "← اجعله متاحاً" : "← اجعله مباعاً"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Settings form ────────────────────────────────────────── */}
            {mode === "settings" && settingsForm && (
              <form onSubmit={handleSettingsSave} className="flex flex-col gap-5 p-5 pb-8">
                <div className="space-y-1.5">
                  <Label>اسم المتجر</Label>
                  <Input value={settingsForm.storeName}
                    onChange={(e) => setSettingsForm((s) => s ? { ...s, storeName: e.target.value } : s)} />
                </div>
                <div className="space-y-1.5">
                  <Label>رقم واتساب</Label>
                  <Input dir="ltr" className="text-left" value={settingsForm.whatsapp}
                    onChange={(e) => setSettingsForm((s) => s ? { ...s, whatsapp: e.target.value } : s)}
                    placeholder="972566112031" />
                </div>
                <div className="space-y-1.5">
                  <Label>عنوان البانر</Label>
                  <Input value={settingsForm.bannerTitle}
                    onChange={(e) => setSettingsForm((s) => s ? { ...s, bannerTitle: e.target.value } : s)} />
                </div>
                <div className="space-y-1.5">
                  <Label>وصف البانر</Label>
                  <Textarea rows={2} value={settingsForm.bannerSubtitle}
                    onChange={(e) => setSettingsForm((s) => s ? { ...s, bannerSubtitle: e.target.value } : s)} />
                </div>
                <div className="space-y-1.5">
                  <Label>طرق الدفع (مفصولة بفاصلة)</Label>
                  <Textarea rows={2} value={settingsForm.paymentMethods}
                    onChange={(e) => setSettingsForm((s) => s ? { ...s, paymentMethods: e.target.value } : s)}
                    placeholder="بنك فلسطين، Reflect، بنك عربي" />
                </div>
                <div className="space-y-1.5">
                  <Label>ملاحظة الدفع</Label>
                  <Input value={settingsForm.paymentNote}
                    onChange={(e) => setSettingsForm((s) => s ? { ...s, paymentNote: e.target.value } : s)} />
                </div>
                <div className="flex gap-3 pt-1">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setMode(null)}>إلغاء</Button>
                  <Button type="submit" className="flex-1 gap-1.5 font-bold" disabled={settingsSaving}>
                    {settingsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    حفظ الإعدادات
                  </Button>
                </div>
              </form>
            )}

          </div>
        </SheetContent>
      </Sheet>

      {/* ── Delete Confirm ───────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الحساب؟</AlertDialogTitle>
            <AlertDialogDescription>هذا الإجراء لا يمكن التراجع عنه.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
