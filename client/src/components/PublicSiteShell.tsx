"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SiteNavigation } from "@/components/SiteNavigation";
import { chatRoutes } from "@/components/chat/chatState";
import { SessionProvider } from "@/services/session/SessionProvider";

export function PublicSiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname?.startsWith("/admin/")) return children;
  const chatPage = pathname === chatRoutes.user || pathname === chatRoutes.consultant;
  const content = <><SiteNavigation />{children}</>;

  return <>
    {chatPage ? content : <SessionProvider>{content}</SessionProvider>}
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
