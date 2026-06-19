import { AdminLayout } from "@/components/layout/AdminLayout";
import { 
  useAdminListAccounts, 
  useCreateAccount, 
  useUpdateAccount, 
  useDeleteAccount,
  getAdminListAccountsQueryKey,
  getGetDashboardStatsQueryKey,
  AccountInput,
  AccountUpdate
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Image as ImageIcon, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const accountSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  platform: z.enum(["tiktok", "instagram", "facebook"]),
  followers: z.coerce.number().min(0, "يجب أن يكون عدد المتابعين 0 أو أكثر"),
  price: z.coerce.number().min(0, "السعر غير صالح"),
  description: z.string().optional().nullable(),
  status: z.enum(["available", "sold"]),
  featured: z.boolean().default(false),
  imageUrl: z.string().optional().nullable(),
});

type AccountFormValues = z.infer<typeof accountSchema>;

export default function AdminAccounts() {
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: accounts, isLoading } = useAdminListAccounts({
    search: search || undefined,
    platform: platform !== "all" ? platform : undefined,
    status: status !== "all" ? status : undefined,
  });

  const createMutation = useCreateAccount();
  const updateMutation = useUpdateAccount();
  const deleteMutation = useDeleteAccount();

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: "",
      platform: "tiktok",
      followers: 0,
      price: 0,
      description: "",
      status: "available",
      featured: false,
      imageUrl: "",
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append("image", file);

    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch("/api/admin/accounts/upload-image", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      form.setValue("imageUrl", data.url);
      toast({ title: "تم رفع الصورة بنجاح" });
    } catch (err) {
      toast({ variant: "destructive", title: "فشل رفع الصورة" });
    } finally {
      setUploadingImage(false);
    }
  };

  const openAddModal = () => {
    setEditingId(null);
    form.reset({
      name: "",
      platform: "tiktok",
      followers: 0,
      price: 0,
      description: "",
      status: "available",
      featured: false,
      imageUrl: "",
    });
    setIsFormOpen(true);
  };

  const openEditModal = (account: any) => {
    setEditingId(account.id);
    form.reset({
      name: account.name,
      platform: account.platform,
      followers: account.followers,
      price: account.price,
      description: account.description || "",
      status: account.status,
      featured: account.featured,
      imageUrl: account.imageUrl || "",
    });
    setIsFormOpen(true);
  };

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getAdminListAccountsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
  };

  const onSubmit = (data: AccountFormValues) => {
    if (editingId) {
      updateMutation.mutate(
        { id: editingId, data: data as AccountUpdate },
        {
          onSuccess: () => {
            toast({ title: "تم تحديث الحساب بنجاح" });
            setIsFormOpen(false);
            invalidateQueries();
          },
        }
      );
    } else {
      createMutation.mutate(
        { data: data as AccountInput },
        {
          onSuccess: () => {
            toast({ title: "تم إضافة الحساب بنجاح" });
            setIsFormOpen(false);
            invalidateQueries();
          },
        }
      );
    }
  };

  const handleDelete = () => {
    if (!deleteId) return;
    deleteMutation.mutate(
      { id: deleteId },
      {
        onSuccess: () => {
          toast({ title: "تم حذف الحساب" });
          setDeleteId(null);
          invalidateQueries();
        },
      }
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">إدارة الحسابات</h1>
            <p className="text-muted-foreground mt-1">إضافة، تعديل وحذف الحسابات المعروضة</p>
          </div>
          <Button onClick={openAddModal} className="gap-2 font-bold">
            <Plus className="h-4 w-4" /> إضافة حساب
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 bg-card p-4 rounded-lg border shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم..."
              className="pr-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="كل المنصات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المنصات</SelectItem>
              <SelectItem value="tiktok">تيك توك</SelectItem>
              <SelectItem value="instagram">انستغرام</SelectItem>
              <SelectItem value="facebook">فيسبوك</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="كل الحالات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="available">متاح</SelectItem>
              <SelectItem value="sold">مباع</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>صورة</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>المنصة</TableHead>
                <TableHead>المتابعين</TableHead>
                <TableHead>السعر</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>مميز</TableHead>
                <TableHead className="text-left">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">جاري التحميل...</TableCell>
                </TableRow>
              ) : !accounts?.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">لا يوجد حسابات مطابقة</TableCell>
                </TableRow>
              ) : (
                accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      {account.imageUrl ? (
                        <div className="w-10 h-10 rounded overflow-hidden bg-muted border">
                          <img src={account.imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center border">
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-bold" dir="ltr">{account.name}</TableCell>
                    <TableCell className="capitalize">{account.platform}</TableCell>
                    <TableCell>{account.followers.toLocaleString()}</TableCell>
                    <TableCell>{account.price} ₪</TableCell>
                    <TableCell>
                      <Badge variant={account.status === "available" ? "default" : "destructive"} className={account.status === "available" ? "bg-green-500 hover:bg-green-600" : ""}>
                        {account.status === "available" ? "متاح" : "مباع"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {account.featured ? <Check className="h-4 w-4 text-accent" /> : "-"}
                    </TableCell>
                    <TableCell className="text-left">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="icon" onClick={() => openEditModal(account)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="text-destructive hover:bg-destructive hover:text-white" onClick={() => setDeleteId(account.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Create/Edit Dialog */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "تعديل حساب" : "إضافة حساب جديد"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>اسم الحساب (يوزر)</FormLabel>
                        <FormControl>
                          <Input dir="ltr" className="text-left" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="platform"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>المنصة</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر المنصة" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="tiktok">تيك توك</SelectItem>
                            <SelectItem value="instagram">انستغرام</SelectItem>
                            <SelectItem value="facebook">فيسبوك</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="followers"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>عدد المتابعين</FormLabel>
                        <FormControl>
                          <Input type="number" dir="ltr" className="text-left" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>السعر (شيكل)</FormLabel>
                        <FormControl>
                          <Input type="number" dir="ltr" className="text-left" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>وصف (اختياري)</FormLabel>
                      <FormControl>
                        <Textarea rows={3} {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4 border p-4 rounded-lg bg-muted/10">
                  <FormLabel>صورة الحساب</FormLabel>
                  <div className="flex items-center gap-4">
                    {form.watch("imageUrl") ? (
                      <div className="relative w-24 h-24 rounded border overflow-hidden">
                        <img src={form.watch("imageUrl")!} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-24 h-24 rounded border bg-muted flex items-center justify-center border-dashed">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        ref={fileInputRef} 
                        onChange={handleImageUpload} 
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingImage}
                      >
                        {uploadingImage ? "جاري الرفع..." : "اختر صورة"}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">يفضل استخدام صور مربعة (4:3)</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-lg bg-muted/10">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>حالة الحساب</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر الحالة" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="available">متاح للبيع</SelectItem>
                            <SelectItem value="sold">تم البيع</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="featured"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm mt-8">
                        <div className="space-y-0.5">
                          <FormLabel>حساب مميز</FormLabel>
                          <p className="text-xs text-muted-foreground">
                            سيظهر في قسم الحسابات المميزة بالرئيسية
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                    إلغاء
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingId ? "حفظ التعديلات" : "إضافة الحساب"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Delete Alert Dialog */}
        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>هل أنت متأكد من حذف الحساب؟</AlertDialogTitle>
              <AlertDialogDescription>
                هذا الإجراء لا يمكن التراجع عنه. سيتم حذف الحساب نهائياً من قاعدة البيانات.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </AdminLayout>
  );
}