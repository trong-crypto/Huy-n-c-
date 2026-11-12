"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SiteNavigation } from "@/components/SiteNavigation";
import { chatRoutes } from "@/components/chat/chatState";
import { customerAuthRoutes, passwordChangeRoutes } from "@/config/customerAuthRoutes";
import { SessionProvider } from "@/services/session/SessionProvider";
import { ChatNotificationsProvider } from "@/components/chat/ChatNotifications";

export function PublicSiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname?.startsWith("/admin/")) return children;
  const chatPage = pathname === chatRoutes.user || pathname === chatRoutes.consultant;
  const accountPage = pathname === customerAuthRoutes.login || pathname === customerAuthRoutes.register
    || pathname === passwordChangeRoutes.customer;
  const content = <ChatNotificationsProvider><SiteNavigation />{children}</ChatNotificationsProvider>;

  return <>
    {chatPage || accountPage ? content : <SessionProvider>{content}</SessionProvider>}
    <footer className="site-footer">
      <span>Huyền Cơ</span>
      <p>Tri thức văn hóa truyền thống. Nội dung không phải dự đoán khoa học.</p>
      <nav className="footer-links" aria-label="Điều hướng cuối trang">
        <Link href="/#huong-dan">Hướng dẫn</Link>
        <Link href="/history">Lịch sử</Link>
      </nav>
    </footer>
  </>;
}
