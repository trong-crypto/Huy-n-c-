"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandSymbol } from "@/components/ui/CelestialArt";
import { divinationCatalog, methodCatalogHref } from "@/config/divinationCatalog";
import { chatRoutes } from "@/components/chat/chatState";
import { NavigationAccount } from "./NavigationAccount";
import { useChatNotifications } from "@/components/chat/ChatNotifications";

export function SiteNavigation() {
  const pathname = usePathname();
  const { unreadConversations } = useChatNotifications();
  const onMethodForm = divinationCatalog.some(({ href }) => pathname === href || pathname.startsWith(`${href}/`));
  return (
    <header className="site-header">
      <a href="#main-content" className="skip-link">Đến nội dung chính</a>
      <nav className="site-navigation" aria-label="Điều hướng chính">
        <Link href="/" className="brand" aria-label="Huyền Cơ — Trang chủ">
          <span className="brand-mark"><BrandSymbol /></span>
          <span>HUYỀN CƠ<span className="brand-caption">DỊCH HỌC & TRI THỨC TRUYỀN THỐNG</span></span>
        </Link>
        <div className="navigation-links">
          {[{ href: "/", label: "Trang chủ" }, { href: methodCatalogHref, label: "Phương pháp" }, { href: "/hexagrams", label: "Tra cứu quẻ" }, { href: "/calendar", label: "Lịch Âm – Dương" }, { href: "/history", label: "Lịch sử" }, { href: chatRoutes.user, label: "Tư vấn" }].map(link => (
            <Link key={link.href} href={link.href} aria-current={pathname === link.href || pathname.startsWith(`${link.href}/`)
              || (link.href === methodCatalogHref && onMethodForm)
              || (link.href === chatRoutes.user && pathname === chatRoutes.consultant) ? "page" : undefined}>
              {link.label}
              {link.href === chatRoutes.user && unreadConversations.size > 0 && <span className="navigation-unread-dot" aria-hidden="true" />}
            </Link>
          ))}
        </div>
        <NavigationAccount pathname={pathname} />
      </nav>
    </header>
  );
}
