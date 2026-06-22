import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetSettings } from "@workspace/api-client-react";
import { WhatsAppButton } from "../WhatsAppButton";
import {
  Menu, X, Home, Info, Star, Phone, ShieldCheck,
  Users, ExternalLink, Send, Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ── Sidebar link definitions ── */
type InternalLink = { kind: "internal"; href: string; label: string; icon: React.ReactNode; badge?: string };
type ExternalLink = { kind: "external"; hrefKey: "whatsapp" | "telegram"; label: string; icon: React.ReactNode; fallback: string };
type SeparatorItem = { kind: "separator" };
type SidebarItem = InternalLink | ExternalLink | SeparatorItem;

const SIDEBAR_ITEMS: SidebarItem[] = [
  { kind: "internal", href: "/",               label: "الرئيسية",                    icon: <Home  className="w-5 h-5" /> },
  { kind: "internal", href: "/accounts",        label: "جميع الحسابات",               icon: <Users className="w-5 h-5" /> },
  { kind: "separator" },
  { kind: "internal", href: "/feedback",        label: "فيدباك العملاء",              icon: <Star  className="w-5 h-5 text-yellow-500" /> },
  { kind: "internal", href: "/celebrity-ads",   label: "إعلانات المشاهير لمتجرنا",   icon: <Video className="w-5 h-5 text-purple-500" /> },
  { kind: "internal", href: "/about",           label: "تفاصيل عنا أكثر",            icon: <Info  className="w-5 h-5" /> },
  { kind: "separator" },
  { kind: "external", hrefKey: "whatsapp",  label: "تواصل معنا",     icon: <Phone className="w-5 h-5 text-green-500" />, fallback: "972566112031" },
  { kind: "external", hrefKey: "telegram",  label: "قناة التليجرام", icon: <Send  className="w-5 h-5 text-sky-500" />,   fallback: "https://t.me/Palestine_storeL" },
];

function buildExternalHref(item: ExternalLink, settings: Record<string, string | null | undefined> | undefined): string {
  if (item.hrefKey === "whatsapp") {
    const num = (settings?.whatsapp ?? item.fallback).replace(/\D/g, "");
    return `https://wa.me/${num}`;
  }
  if (item.hrefKey === "telegram") {
    const raw = settings?.telegram ?? item.fallback;
    if (!raw) return `https://t.me/Palestine_storeL`;
    if (raw.startsWith("http")) return raw;
    return `https://t.me/${raw.replace(/^@/, "")}`;
  }
  return "#";
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [location] = useLocation();
  const { data: settings } = useGetSettings();

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href.split("?")[0]) && href !== "/accounts?platform=tiktok_monetized"
      ? location === href.split("?")[0]
      : location + window.location.search === href || window.location.pathname + window.location.search === href;
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-72 bg-background border-l shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-primary/5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <span className="font-black text-base text-primary">متجر فلسطين</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Links */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {SIDEBAR_ITEMS.map((item, i) => {
            if (item.kind === "separator") {
              return <div key={`sep-${i}`} className="my-2 border-t border-border/50" />;
            }

            if (item.kind === "internal") {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "hover:bg-muted/80 active:scale-[.98] text-foreground"
                  }`}
                >
                  <span className={active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground transition-colors"}>
                    {item.icon}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {item.badge && <span className="text-base leading-none">{item.badge}</span>}
                </Link>
              );
            }

            // External link
            const href = buildExternalHref(item, settings as unknown as Record<string, string | null | undefined>);
            return (
              <a
                key={item.hrefKey}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="group flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 hover:bg-muted/80 active:scale-[.98] text-foreground"
              >
                <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
              </a>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t text-center">
          <p className="text-[11px] text-muted-foreground">
            متجر فلسطين &copy; {new Date().getFullYear()} — جميع الحقوق محفوظة
          </p>
        </div>
      </aside>
    </>
  );
}

function Navbar({ onMenuOpen }: { onMenuOpen: () => void }) {
  const { data: settings } = useGetSettings();

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-14 sm:h-16 grid grid-cols-3 items-center">
        {/* Right — hamburger */}
        <div className="flex items-center justify-start">
          <Button variant="ghost" size="icon" onClick={onMenuOpen} title="القائمة" className="shrink-0">
            <Menu className="w-5 h-5" />
          </Button>
        </div>

        {/* Center — store name */}
        <div className="flex items-center justify-center min-w-0">
          <Link href="/" className="flex items-center gap-2 min-w-0">
            {settings?.logoUrl && (
              <img src={settings.logoUrl} alt="Logo" className="h-7 w-auto object-contain shrink-0" />
            )}
            <span className="font-bold text-lg sm:text-xl text-primary truncate">
              {settings?.storeNameAr || settings?.storeName || "متجر فلسطين"}
            </span>
          </Link>
        </div>

        {/* Left — empty */}
        <div />
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
          {settings?.email && (
            <a href={`mailto:${settings.email}`} className="hover:text-primary transition-colors">
              البريد الإلكتروني
            </a>
          )}
          {settings?.whatsapp && (
            <a
              href={`https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              واتساب
            </a>
          )}
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
