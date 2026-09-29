"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "./LanguageProvider";

const items = [
  { href: "/today", label: "nav.today" as const, icon: "calendar_today" },
  { href: "/learn", label: "nav.learn" as const, icon: "school" },
  { href: "/vocabulary", label: "nav.review" as const, icon: "menu_book" },
  { href: "/library", label: "nav.library" as const, icon: "library_books" },
  { href: "/progress", label: "nav.progress" as const, icon: "insights" },
];

function isActive(pathname: string, href: string) {
  if (href === "/learn") return pathname.startsWith("/learn") || pathname.startsWith("/collection/");
  return pathname === href;
}

export default function AppNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  return <>
    <aside className="sidebar">
      <Link href="/today" className="brand" aria-label="TCF Lab home">
        <span className="brand-mark material-symbols-outlined" aria-hidden="true">person_book</span>
        <span className="brand-copy"><strong>TCF Lab</strong><small>{t("nav.subtitle")}</small></span>
      </Link>
      <nav className="main-nav" aria-label="Primary navigation">
        {items.map((item) => <Link key={item.href} href={item.href} className={isActive(pathname, item.href) ? "active" : ""}>
          <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span><b>{t(item.label)}</b>
        </Link>)}
      </nav>
      <nav className="sidebar-footer" aria-label="Utility navigation">
        <Link href="/settings" className={pathname === "/settings" ? "active" : ""}><span className="material-symbols-outlined" aria-hidden="true">settings</span><b>{t("nav.settings")}</b></Link>
      </nav>
    </aside>
    <header className="mobile-header">
      <Link href="/today" className="mobile-brand">TCF Lab</Link>
      <Link href="/settings" aria-label={t("nav.settings")}><span className="material-symbols-outlined">settings</span></Link>
    </header>
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {items.map((item) => <Link key={item.href} href={item.href} className={isActive(pathname, item.href) ? "active" : ""} aria-label={t(item.label)}>
        <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span><small>{t(item.label)}</small>
      </Link>)}
    </nav>
  </>;
}
