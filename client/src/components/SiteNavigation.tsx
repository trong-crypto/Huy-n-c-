"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandSymbol } from "@/components/ui/CelestialArt";
import { methodCatalogHref } from "@/config/divinationCatalog";
import { chatRoutes } from "@/components/chat/chatState";

export function SiteNavigation() {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <a href="#main-content" className="skip-link">Đến nội dung chính</a>
      <nav className="site-navigation" aria-label="Điều hướng chính">
        <Link href="/" className="brand" aria-label="Huyền Cơ — Trang chủ">
          <span className="brand-mark"><BrandSymbol /></span>
          <span>HUYỀN CƠ<span className="brand-caption">DỊCH HỌC & TRI THỨC TRUYỀN THỐNG</span></span>
        </Link>
        <div className="navigation-links">
          {[{ href: "/", label: "Trang chủ" }, { href: methodCatalogHref, label: "Phương pháp" }, { href: "/mai-hoa", label: "Mai Hoa" }, { href: "/tam-the", label: "Tam Thế" }, { href: "/hexagrams", label: "Tra cứu quẻ" }, { href: "/calendar", label: "Lịch Âm – Dương" }, { href: "/history", label: "Lịch sử" }, { href: chatRoutes.user, label: "Tư vấn" }].map(link => (
            <Link key={link.href} href={link.href} aria-current={pathname === link.href || pathname.startsWith(`${link.href}/`)
              || (link.href === chatRoutes.user && pathname === chatRoutes.consultant) ? "page" : undefined}>
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
