import { AdminLayout } from "@/components/layout/AdminLayout";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle, Package, MousePointerClick, MessageCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useGetDashboardStats();

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold">لوحة التحكم</h1>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">نظرة عامة</h1>
          <p className="text-muted-foreground mt-1">إحصائيات وأداء المتجر</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إجمالي الحسابات</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalAccounts || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">الحسابات المتاحة</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats?.availableAccounts || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">الحسابات المباعة</CardTitle>
              <CheckCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats?.soldAccounts || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إجمالي النقرات</CardTitle>
              <MousePointerClick className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalClicks || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">نقرات الواتساب</CardTitle>
              <MessageCircle className="h-4 w-4 text-[#25D366]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.whatsappClicks || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>أكثر الحسابات تفاعلاً</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.topAccounts && stats.topAccounts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الحساب</TableHead>
                    <TableHead>المنصة</TableHead>
                    <TableHead>المتابعين</TableHead>
                    <TableHead>السعر</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead className="text-left">النقرات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.topAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium" dir="ltr">{account.name}</TableCell>
                      <TableCell className="capitalize">{account.platform}</TableCell>
                      <TableCell>{account.followers.toLocaleString()}</TableCell>
                      <TableCell>{account.price} ₪</TableCell>
                      <TableCell>
                        <Badge variant={account.status === "available" ? "default" : "destructive"}>
                          {account.status === "available" ? "متاح" : "مباع"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-left font-bold">{account.clickCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">لا يوجد بيانات كافية</div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}