import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  useGetSettings,
  useUpdateSettings,
  useListReviews,
  useCreateReview,
  useDeleteReview,
  SiteSettingsUpdate,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Save, Upload, X, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequestUploadUrl } from "@workspace/api-client-react";

const settingsSchema = z.object({
  storeName: z.string().min(1, "الاسم مطلوب"),
  storeNameAr: z.string().optional().nullable(),
  whatsapp: z.string().min(1, "رقم الواتساب مطلوب"),
  telegram: z.string().optional().nullable(),
  email: z.string().email("البريد غير صحيح"),
  logoUrl: z.string().optional().nullable(),
  bannerTitle: z.string().optional().nullable(),
  bannerSubtitle: z.string().optional().nullable(),
  paymentNote: z.string().optional().nullable(),
  paymentMethods: z.array(z.object({
    value: z.string().min(1, "طريقة الدفع مطلوبة")
  })).default([])
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

function ReviewsManager() {
  const { data: reviews, isLoading } = useListReviews();
  const createReview = useCreateReview();
  const deleteReview = useDeleteReview();
  const requestUpload = useRequestUploadUrl();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { uploadURL, objectPath } = await requestUpload.mutateAsync({
        data: { name: file.name, size: file.size, contentType: file.type },
      });
      await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      const imageUrl = `/api/storage/objects/${objectPath}`;
      await createReview.mutateAsync({ data: { imageUrl, caption: caption || undefined } });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
      toast({ title: "تم رفع التقييم بنجاح" });
      setCaption("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      toast({ title: "فشل رفع الصورة", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteReview.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
    toast({ title: "تم حذف التقييم" });
  };

  return (
    <div className="space-y-6 bg-card p-6 border rounded-xl shadow-sm lg:col-span-2">
      <h2 className="text-xl font-bold border-b pb-2 mb-4">تقييمات العملاء (فيدباك)</h2>

      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <Input
          placeholder="وصف اختياري للصورة..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="flex-1"
        />
        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="gap-2 shrink-0"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? "جاري الرفع..." : "رفع صورة تقييم"}
        </Button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      )}

      {!isLoading && reviews && reviews.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-6">لا يوجد تقييمات مرفوعة حتى الآن.</p>
      )}

      {!isLoading && reviews && reviews.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {reviews.map((review) => (
            <div key={review.id} className="relative group rounded-xl overflow-hidden border shadow-sm">
              <img src={review.imageUrl} alt={review.caption || ""} className="w-full h-36 object-cover" />
              {review.caption && (
                <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-2 truncate">{review.caption}</p>
              )}
              <button
                type="button"
                onClick={() => handleDelete(review.id)}
                className="absolute top-2 left-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminSettings() {
  const { data: settings, isLoading } = useGetSettings();
  const updateMutation = useUpdateSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      storeName: "",
      storeNameAr: "",
      whatsapp: "",
      telegram: "",
      email: "",
      logoUrl: "",
      bannerTitle: "",
      bannerSubtitle: "",
      paymentNote: "",
      paymentMethods: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "paymentMethods",
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        storeName: settings.storeName,
        storeNameAr: settings.storeNameAr || "",
        whatsapp: settings.whatsapp,
        telegram: settings.telegram || "",
        email: settings.email,
        logoUrl: settings.logoUrl || "",
        bannerTitle: settings.bannerTitle || "",
        bannerSubtitle: settings.bannerSubtitle || "",
        paymentNote: settings.paymentNote || "",
        paymentMethods: (settings.paymentMethods || []).map(value => ({ value })),
      });
    }
  }, [settings, form]);

  const onSubmit = (data: SettingsFormValues) => {
    const payload: SiteSettingsUpdate = {
      ...data,
      storeNameAr: data.storeNameAr || undefined,
      telegram: data.telegram || undefined,
      logoUrl: data.logoUrl || undefined,
      bannerTitle: data.bannerTitle || undefined,
      bannerSubtitle: data.bannerSubtitle || undefined,
      paymentNote: data.paymentNote || undefined,
      paymentMethods: data.paymentMethods.map(item => item.value),
    };

    updateMutation.mutate(
      { data: payload },
      {
        onSuccess: () => {
          toast({ title: "تم حفظ الإعدادات بنجاح" });
          queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Skeleton className="h-[400px]" />
            <Skeleton className="h-[400px]" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold">إعدادات المتجر</h1>
          <p className="text-muted-foreground mt-1">تخصيص الواجهة، طرق التواصل، وبوابات الدفع</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              {/* General Settings */}
              <div className="space-y-6 bg-card p-6 border rounded-xl shadow-sm">
                <h2 className="text-xl font-bold border-b pb-2 mb-4">المعلومات الأساسية</h2>
                <FormField
                  control={form.control}
                  name="storeNameAr"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>اسم المتجر (بالعربية)</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="storeName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>اسم المتجر (انجليزي)</FormLabel>
                      <FormControl>
                        <Input dir="ltr" className="text-left" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>رابط الشعار (Logo URL)</FormLabel>
                      <FormControl>
                        <Input dir="ltr" className="text-left" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Contact */}
              <div className="space-y-6 bg-card p-6 border rounded-xl shadow-sm">
                <h2 className="text-xl font-bold border-b pb-2 mb-4">معلومات التواصل</h2>
                <FormField
                  control={form.control}
                  name="whatsapp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>رقم الواتساب (مع رمز الدولة، مثلاً: 972566112031)</FormLabel>
                      <FormControl>
                        <Input dir="ltr" className="text-left" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="telegram"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>تيليجرام (مثال: @Palestine_store)</FormLabel>
                      <FormControl>
                        <Input dir="ltr" className="text-left" placeholder="@username" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>البريد الإلكتروني</FormLabel>
                      <FormControl>
                        <Input type="email" dir="ltr" className="text-left" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Homepage texts */}
              <div className="space-y-6 bg-card p-6 border rounded-xl shadow-sm lg:col-span-2">
                <h2 className="text-xl font-bold border-b pb-2 mb-4">نصوص الصفحة الرئيسية</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="bannerTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>العنوان الرئيسي (Hero Title)</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bannerSubtitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>النص الفرعي (Hero Subtitle)</FormLabel>
                        <FormControl>
                          <Textarea rows={3} {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Payment Methods */}
              <div className="space-y-6 bg-card p-6 border rounded-xl shadow-sm lg:col-span-2">
                <h2 className="text-xl font-bold border-b pb-2 mb-4">طرق الدفع</h2>
                <FormField
                  control={form.control}
                  name="paymentNote"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ملاحظة قسم الدفع</FormLabel>
                      <FormControl>
                        <Input placeholder="مثال: نقبل الدفع عن طريق المحافظ الإلكترونية..." {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-4">
                  <p className="text-sm font-medium leading-none">خيارات الدفع المتاحة</p>
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 items-center">
                      <FormField
                        control={form.control}
                        name={`paymentMethods.${index}.value`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input {...field} placeholder="طريقة دفع (مثال: بنك فلسطين)" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="button" variant="outline" size="icon" className="text-destructive shrink-0 mt-2" onClick={() => remove(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="secondary" onClick={() => append({ value: "" })} className="gap-2">
                    <Plus className="h-4 w-4" /> إضافة طريقة دفع
                  </Button>
                </div>
              </div>

              {/* Reviews */}
              <ReviewsManager />

            </div>

            <div className="flex justify-end sticky bottom-6 z-10">
              <Button type="submit" size="lg" className="px-8 shadow-xl font-bold text-lg" disabled={updateMutation.isPending}>
                <Save className="ml-2 h-5 w-5" />
                {updateMutation.isPending ? "جاري الحفظ..." : "حفظ الإعدادات"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </AdminLayout>
  );
}
