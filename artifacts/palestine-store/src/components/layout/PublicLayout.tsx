import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetSettings } from "@workspace/api-client-react";
import { WhatsAppButton } from "../WhatsAppButton";
import { Moon, Sun, Menu, X, Home, Info, Star, Phone } from "lucide-react";
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

const sidebarLinks = [
  { href: "/", label: "الرئيسية", icon: <Home className="w-5 h-5" /> },
  { href: "/about", label: "تفاصيل عنا أكثر", icon: <Info className="w-5 h-5" /> },
  { href: "/feedback", label: "فيدباك العملاء", icon: <Star className="w-5 h-5" /> },
  { href: "/contact", label: "تواصل معنا", icon: <Phone className="w-5 h-5" /> },
];

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [location] = useLocation();
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-72 bg-background border-l shadow-2xl transform transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        dir="rtl"
      >
        <div className="flex items-center justify-between p-5 border-b">
          <span className="font-black text-lg text-primary">القائمة</span>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        <nav className="p-4 space-y-1">
          {sidebarLinks.map((link) => {
            const isActive = location === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-foreground"
                }`}
              >
                {link.icon}
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

function Navbar({ onMenuOpen }: { onMenuOpen: () => void }) {
  const { data: settings } = useGetSettings();

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <ThemeToggle />
        </div>
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
          <Button variant="ghost" size="icon" onClick={onMenuOpen} title="القائمة">
            <Menu className="w-5 h-5" />
          </Button>
          <Link href="/" className="flex items-center gap-2">
            {settings?.logoUrl && (
              <img src={settings.logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
            )}
            <span className="font-bold text-xl text-primary">
              {settings?.storeNameAr || settings?.storeName || "متجر فلسطين"}
            </span>
          </Link>
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background font-sans text-foreground" dir="rtl">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Navbar onMenuOpen={() => setSidebarOpen(true)} />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
