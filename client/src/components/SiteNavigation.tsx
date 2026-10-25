"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandSymbol } from "@/components/ui/CelestialArt";

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
          {[{ href: "/", label: "Trang chủ" }, { href: "/mai-hoa", label: "Mai Hoa" }, { href: "/tam-the", label: "Tam Thế" }].map(link => (
            <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
