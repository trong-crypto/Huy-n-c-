import type { Metadata } from "next";
import Link from "next/link";
import { SiteNavigation } from "@/components/SiteNavigation";
import { SessionProvider } from "@/services/session/SessionProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Huyền Cơ",
  description: "Tra cứu tri thức Mai Hoa Dịch Số và Diễn Cầm Tam Thế với nguồn tham chiếu rõ ràng",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <SessionProvider><SiteNavigation />{children}</SessionProvider>
        <footer className="site-footer">
          <span>Huyền Cơ</span>
          <p>Tri thức văn hóa truyền thống. Nội dung không phải dự đoán khoa học.</p>
          <nav className="footer-links" aria-label="Điều hướng cuối trang">
            <Link href="/#huong-dan">Hướng dẫn</Link><Link href="/history">Lịch sử</Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}

