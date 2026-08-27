"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/today", label: "Today", icon: "calendar_today" },
  { href: "/learn", label: "Learn", icon: "school" },
  { href: "/vocabulary", label: "Review", icon: "menu_book" },
  { href: "/library", label: "Library", icon: "library_books" },
  { href: "/progress", label: "Progress", icon: "insights" },
];

function isActive(pathname: string, href: string) {
  if (href === "/learn") return pathname.startsWith("/learn") || pathname.startsWith("/collection/");
  return pathname === href;
}

export default function AppNav() {
  const pathname = usePathname();
  return <>
    <aside className="sidebar">
      <Link href="/today" className="brand" aria-label="TCF Lab home">
        <span className="brand-mark material-symbols-outlined" aria-hidden="true">person_book</span>
        <span className="brand-copy"><strong>TCF Lab</strong><small>Study Instrument</small></span>
      </Link>
      <nav className="main-nav" aria-label="Primary navigation">
        {items.map((item) => <Link key={item.href} href={item.href} className={isActive(pathname, item.href) ? "active" : ""}>
          <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span><b>{item.label}</b>
        </Link>)}
      </nav>
      <nav className="sidebar-footer" aria-label="Utility navigation">
        <Link href="/debug" className={pathname === "/debug" ? "active" : ""}><span className="material-symbols-outlined" aria-hidden="true">settings</span><b>Settings</b></Link>
      </nav>
    </aside>
    <header className="mobile-header">
      <Link href="/today" className="mobile-brand">TCF Lab</Link>
      <Link href="/debug" aria-label="Settings"><span className="material-symbols-outlined">settings</span></Link>
    </header>
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {items.map((item) => <Link key={item.href} href={item.href} className={isActive(pathname, item.href) ? "active" : ""} aria-label={item.label}>
        <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span><small>{item.label}</small>
      </Link>)}
    </nav>
  </>;
}
