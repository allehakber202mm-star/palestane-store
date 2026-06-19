import { ReactNode } from "react";
import { Link } from "wouter";
import { useGetSettings } from "@workspace/api-client-react";
import { WhatsAppButton } from "../WhatsAppButton";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      title="تبديل المظهر"
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">تبديل المظهر</span>
    </Button>
  );
}

function Navbar() {
  const { data: settings } = useGetSettings();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          {settings?.logoUrl && (
            <img src={settings.logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
          )}
          <span className="font-bold text-xl text-primary">
            {settings?.storeNameAr || settings?.storeName || "متجر فلسطين"}
          </span>
        </Link>
        <nav className="hidden md:flex gap-6 items-center">
          <Link href="/" className="text-sm font-medium hover:text-primary transition-colors">
            الرئيسية
          </Link>
          <Link href="/accounts" className="text-sm font-medium hover:text-primary transition-colors">
            جميع الحسابات
          </Link>
          <Link href="/accounts?platform=tiktok" className="text-sm font-medium hover:text-primary transition-colors">
            تيك توك
          </Link>
          <Link href="/accounts?platform=instagram" className="text-sm font-medium hover:text-primary transition-colors">
            انستغرام
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const { data: settings } = useGetSettings();

  return (
    <footer className="border-t bg-muted/40 py-8 mt-12">
      <div className="container mx-auto px-4 text-center">
        <p className="text-sm text-muted-foreground mb-4">
          {settings?.storeNameAr || settings?.storeName || "متجر فلسطين"} &copy; {new Date().getFullYear()} جميع الحقوق محفوظة
        </p>
        <div className="flex justify-center gap-4 text-sm text-muted-foreground">
          {settings?.email && <a href={`mailto:${settings.email}`} className="hover:text-primary">البريد الإلكتروني</a>}
          {settings?.whatsapp && <a href={`https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="hover:text-primary">واتساب</a>}
        </div>
      </div>
    </footer>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background font-sans text-foreground" dir="rtl">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}