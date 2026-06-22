import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RefreshCw, AlertTriangle, CheckCircle2, XCircle,
  Trash2, Bot, RotateCcw, Wifi, WifiOff, Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const API = (path: string) => `/api${path}`;
const getToken = () => localStorage.getItem("admin_token") ?? "";

interface DiagnosticsData {
  config: { hasBotToken: boolean; feedbackChannel: string; accountsChannel: string };
  getMe?: { ok: boolean; result?: { username: string; id: number } };
  feedbackChannelInfo?: { ok: boolean; result?: { title: string; username: string } };
  botAdminStatus?: {
    isAdmin: boolean;
    verdict: string;
    admins?: Array<{ username?: string; status: string; is_bot?: boolean }>;
    error?: string;
  };
  storedOffset?: string;
  pendingUpdates?: {
    ok: boolean;
    count: number;
    updates: Array<{
      update_id: number;
      chat_username?: string;
      type: string;
      text_preview?: string;
      has_photo?: boolean;
      has_video?: boolean;
    }>;
  };
  dbFeedbackPosts?: {
    count: number;
    recent: Array<{ id: number; telegramMessageId: number; text?: string; hasImage: boolean; postedAt: string }>;
  };
}

interface FeedbackPost {
  id: number;
  telegramMessageId: number;
  text: string | null;
  imageUrl: string | null;
  videoUrl?: string | null;
  postedAt: string;
}

export default function AdminFeedback() {
  const { toast } = useToast();
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [posts, setPosts] = useState<FeedbackPost[]>([]);
  const [loadingDiag, setLoadingDiag] = useState(false);
  const [loadingSync, setLoadingSync] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const authHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  });

  const fetchDiagnostics = useCallback(async () => {
    setLoadingDiag(true);
    try {
      const r = await fetch(API("/feedback/debug"), { headers: authHeaders() });
      const d = await r.json() as DiagnosticsData;
      setDiagnostics(d);
    } catch {
      toast({ title: "فشل تحميل التشخيص", variant: "destructive" });
    } finally {
      setLoadingDiag(false);
    }
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const r = await fetch(API("/feedback"));
      const d = await r.json() as FeedbackPost[];
      setPosts(d);
    } catch { /* silent */ }
    finally { setLoadingPosts(false); }
  }, []);

  useEffect(() => {
    fetchDiagnostics();
    fetchPosts();
  }, [fetchDiagnostics, fetchPosts]);

  const handleSync = async () => {
    setLoadingSync(true);
    try {
      const r = await fetch(API("/feedback/sync"), { method: "POST", headers: authHeaders() });
      const d = await r.json() as { ok: boolean; result?: unknown; error?: string };
      toast({
        title: d.ok ? "✅ تمت المزامنة" : "فشل المزامنة",
        description: JSON.stringify(d.result ?? d.error),
      });
      await Promise.all([fetchDiagnostics(), fetchPosts()]);
    } catch {
      toast({ title: "خطأ في المزامنة", variant: "destructive" });
    } finally {
      setLoadingSync(false);
    }
  };

  const handleResetOffset = async () => {
    if (!confirm("سيتم إعادة ضبط الـ offset إلى 0 وإعادة مزامنة جميع الرسائل المعلقة. هل أنت متأكد؟")) return;
    setLoadingReset(true);
    try {
      const r = await fetch(API("/feedback/reset-offset"), { method: "POST", headers: authHeaders() });
      const d = await r.json() as { ok: boolean; result?: unknown; error?: string };
      toast({
        title: d.ok ? "✅ تم إعادة الضبط" : "فشل إعادة الضبط",
        description: JSON.stringify(d.result ?? d.error),
      });
      await Promise.all([fetchDiagnostics(), fetchPosts()]);
    } catch {
      toast({ title: "خطأ", variant: "destructive" });
    } finally {
      setLoadingReset(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("حذف هذا الرأي؟")) return;
    try {
      await fetch(API(`/feedback/${id}`), { method: "DELETE", headers: authHeaders() });
      setPosts(prev => prev.filter(p => p.id !== id));
      toast({ title: "تم الحذف" });
    } catch {
      toast({ title: "فشل الحذف", variant: "destructive" });
    }
  };

  const isAdmin = diagnostics?.botAdminStatus?.isAdmin;
  const botOk = diagnostics?.getMe?.ok;
  const channelOk = diagnostics?.feedbackChannelInfo?.ok;

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">إدارة آراء العملاء</h1>
            <p className="text-muted-foreground text-sm mt-1">مزامنة Telegram + تشخيص + إدارة المنشورات</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={fetchDiagnostics} disabled={loadingDiag}>
              <RefreshCw className={`h-4 w-4 ml-1 ${loadingDiag ? "animate-spin" : ""}`} />
              تحديث
            </Button>
            <Button size="sm" onClick={handleSync} disabled={loadingSync}>
              <RefreshCw className={`h-4 w-4 ml-1 ${loadingSync ? "animate-spin" : ""}`} />
              مزامنة يدوية
            </Button>
            <Button variant="destructive" size="sm" onClick={handleResetOffset} disabled={loadingReset}>
              <RotateCcw className={`h-4 w-4 ml-1 ${loadingReset ? "animate-spin" : ""}`} />
              إعادة بناء
            </Button>
          </div>
        </div>

        {/* Critical Alert — bot not admin */}
        {diagnostics && !isAdmin && (
          <div className="rounded-xl border-2 border-red-500 bg-red-50 dark:bg-red-950/30 p-5 space-y-3">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-lg">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              مشكلة حرجة: البوت ليس مشرفاً في القناة
            </div>
            <p className="text-sm text-red-700 dark:text-red-300 leading-relaxed">
              البوت <strong>@{diagnostics.getMe?.result?.username ?? "PalestineStoreBot"}</strong> موجود
              لكنه ليس مشرفاً في قناة{" "}
              <strong>@{diagnostics.config.feedbackChannel}</strong>.
              Telegram Bot API لا يُرسل رسائل القناة إلا للبوتات التي هي <strong>مشرف (admin)</strong>.
            </p>
            <div className="bg-white dark:bg-red-950/50 rounded-lg p-4 border border-red-200 dark:border-red-800">
              <p className="font-bold text-sm mb-2 text-red-800 dark:text-red-200">خطوات الإصلاح:</p>
              <ol className="text-sm text-red-700 dark:text-red-300 space-y-1.5 list-decimal list-inside">
                <li>
                  افتح قناة Telegram:{" "}
                  <code className="bg-red-100 dark:bg-red-900 px-1 rounded">
                    @{diagnostics.config.feedbackChannel}
                  </code>
                </li>
                <li>اذهب إلى: الإعدادات → المشرفون → إضافة مشرف</li>
                <li>
                  ابحث عن:{" "}
                  <code className="bg-red-100 dark:bg-red-900 px-1 rounded">
                    @{diagnostics.getMe?.result?.username ?? "PalestineStoreBot"}
                  </code>
                </li>
                <li>أضفه كمشرف (أي صلاحية كافية، لا يحتاج صلاحيات خاصة)</li>
                <li>بعد الإضافة: اضغط "مزامنة يدوية" أو انتظر 30 ثانية</li>
              </ol>
            </div>
            {diagnostics.pendingUpdates?.count === 0 && (
              <p className="text-xs text-red-500 bg-red-100 dark:bg-red-900/30 rounded p-2">
                ⚠️ ملاحظة: الرسائل القديمة المرسلة قبل إضافة البوت كمشرف لن تُستعاد تلقائياً.
                بعد الإضافة كمشرف، أعد إرسال الرسائل في القناة لتُستورد.
              </p>
            )}
          </div>
        )}

        {/* Success state */}
        {diagnostics && isAdmin && (
          <div className="rounded-xl border-2 border-green-500 bg-green-50 dark:bg-green-950/30 p-4">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold">
              <CheckCircle2 className="h-5 w-5" />
              البوت مشرف في القناة — المزامنة تعمل بشكل طبيعي
            </div>
          </div>
        )}

        {/* Status Cards */}
        {diagnostics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Bot className="h-8 w-8 text-blue-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">البوت</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {botOk
                      ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      : <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                    <span className="text-sm font-medium">{botOk ? "يعمل" : "خطأ"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    @{diagnostics.getMe?.result?.username}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                {channelOk
                  ? <Wifi className="h-8 w-8 text-green-500 shrink-0" />
                  : <WifiOff className="h-8 w-8 text-red-500 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">القناة</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {channelOk
                      ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      : <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                    <span className="text-sm font-medium">{channelOk ? "موجودة" : "خطأ"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    @{diagnostics.config.feedbackChannel}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                {isAdmin
                  ? <CheckCircle2 className="h-8 w-8 text-green-500 shrink-0" />
                  : <AlertTriangle className="h-8 w-8 text-red-500 shrink-0" />}
                <div>
                  <p className="text-xs text-muted-foreground">صلاحية البوت</p>
                  <span className={`text-sm font-bold ${isAdmin ? "text-green-600" : "text-red-600"}`}>
                    {isAdmin ? "مشرف ✅" : "ليس مشرفاً ❌"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Info className="h-8 w-8 text-blue-500 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">منشورات محفوظة</p>
                  <p className="text-2xl font-bold">{posts.length}</p>
                  <p className="text-xs text-muted-foreground">
                    Telegram معلق: {diagnostics.pendingUpdates?.count ?? 0}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Technical Details */}
        {diagnostics && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">تفاصيل تقنية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted rounded p-2">
                  <span className="text-muted-foreground">Offset مخزون: </span>
                  <span className="font-mono font-bold">{diagnostics.storedOffset ?? "0"}</span>
                </div>
                <div className="bg-muted rounded p-2">
                  <span className="text-muted-foreground">Updates معلقة: </span>
                  <span className="font-mono font-bold">{diagnostics.pendingUpdates?.count ?? "?"}</span>
                </div>
                <div className="bg-muted rounded p-2">
                  <span className="text-muted-foreground">البوت: </span>
                  <span className="font-mono">@{diagnostics.getMe?.result?.username}</span>
                </div>
                <div className="bg-muted rounded p-2">
                  <span className="text-muted-foreground">القناة: </span>
                  <span className="font-mono">@{diagnostics.config.feedbackChannel}</span>
                </div>
              </div>

              {diagnostics.pendingUpdates?.updates && diagnostics.pendingUpdates.updates.length > 0 && (
                <div>
                  <p className="font-medium mb-1 text-xs text-muted-foreground">آخر updates من Telegram:</p>
                  <div className="space-y-1">
                    {diagnostics.pendingUpdates.updates.map(u => (
                      <div
                        key={u.update_id}
                        className="bg-muted rounded p-2 text-xs flex gap-2 flex-wrap items-center"
                      >
                        <Badge variant="outline">#{u.update_id}</Badge>
                        <Badge
                          variant={
                            u.chat_username === diagnostics.config.feedbackChannel
                              ? "default"
                              : "secondary"
                          }
                        >
                          @{u.chat_username ?? "N/A"}
                        </Badge>
                        {u.has_photo && <Badge variant="outline">📷</Badge>}
                        {u.has_video && <Badge variant="outline">🎥</Badge>}
                        <span className="text-muted-foreground truncate">
                          {u.text_preview || "(بدون نص)"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Posts List */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">المنشورات المحفوظة ({posts.length})</CardTitle>
              <Button variant="ghost" size="sm" onClick={fetchPosts} disabled={loadingPosts}>
                <RefreshCw className={`h-3 w-3 ${loadingPosts ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {posts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">
                لا يوجد منشورات محفوظة
              </p>
            ) : (
              <div className="space-y-2">
                {posts.map(post => (
                  <div
                    key={post.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                  >
                    {post.imageUrl && (
                      <img
                        src={post.imageUrl}
                        alt=""
                        className="w-12 h-12 rounded object-cover shrink-0"
                      />
                    )}
                    {post.videoUrl && !post.imageUrl && (
                      <div className="w-12 h-12 rounded bg-gray-800 flex items-center justify-center shrink-0">
                        <span className="text-white text-xl">🎥</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{post.text || "(بدون نص)"}</p>
                      <div className="flex gap-1 mt-1 flex-wrap items-center">
                        <Badge variant="outline" className="text-xs">#{post.telegramMessageId}</Badge>
                        {post.imageUrl && <Badge variant="outline" className="text-xs">📷</Badge>}
                        {post.videoUrl && <Badge variant="outline" className="text-xs">🎥</Badge>}
                        <span className="text-xs text-muted-foreground">
                          {new Date(post.postedAt).toLocaleDateString("ar-EG")}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600 shrink-0"
                      onClick={() => handleDelete(post.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
