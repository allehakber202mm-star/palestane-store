import { PublicLayout } from "@/components/layout/PublicLayout";
import { useGetSettings } from "@workspace/api-client-react";
import { MessageCircle, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Contact() {
  const { data: settings } = useGetSettings();

  const phone = settings?.whatsapp?.replace(/\D/g, "") || "970566112031";
  const telegram = settings?.telegram;
  const email = settings?.email;

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-10 max-w-xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-black">تواصل معنا</h1>
          <p className="text-muted-foreground">نحن هنا لمساعدتك في أي وقت</p>
        </div>

        <div className="space-y-4">
          <div className="bg-card border rounded-2xl p-5 flex items-center gap-4 shadow-sm">
            <div className="bg-green-500/10 p-3 rounded-xl">
              <MessageCircle className="w-7 h-7 text-green-500" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-base">واتساب</p>
              <p className="text-muted-foreground text-sm">{settings?.whatsapp || "+970566112031"}</p>
            </div>
            <Button
              className="bg-green-500 hover:bg-green-600 text-white font-bold rounded-full"
              onClick={() => window.open(`https://wa.me/${phone}`, "_blank")}
            >
              تواصل
            </Button>
          </div>

          {telegram && (
            <div className="bg-card border rounded-2xl p-5 flex items-center gap-4 shadow-sm">
              <div className="bg-blue-500/10 p-3 rounded-xl">
                <Send className="w-7 h-7 text-blue-500" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-base">تيليجرام</p>
                <p className="text-muted-foreground text-sm">{telegram}</p>
              </div>
              <Button
                variant="outline"
                className="font-bold rounded-full border-blue-500 text-blue-600"
                onClick={() => {
                  const t = telegram.startsWith("@") ? telegram.slice(1) : telegram;
                  window.open(`https://t.me/${t}`, "_blank");
                }}
              >
                تواصل
              </Button>
            </div>
          )}

          {email && (
            <div className="bg-card border rounded-2xl p-5 flex items-center gap-4 shadow-sm">
              <div className="bg-primary/10 p-3 rounded-xl">
                <Mail className="w-7 h-7 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-base">البريد الإلكتروني</p>
                <p className="text-muted-foreground text-sm break-all">{email}</p>
              </div>
              <Button
                variant="outline"
                className="font-bold rounded-full"
                onClick={() => window.open(`mailto:${email}`, "_blank")}
              >
                راسلنا
              </Button>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
