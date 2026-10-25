import type { Metadata } from "next";
import { SiteNavigation } from "@/components/SiteNavigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "Huyền Cơ",
  description: "Tra cứu tri thức Mai Hoa Dịch Số và Diễn Cầm Tam Thế với nguồn tham chiếu rõ ràng",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <SiteNavigation />
        {children}
        <footer className="site-footer"><span>Huyền Cơ</span><p>Tri thức văn hóa truyền thống. Nội dung không phải dự đoán khoa học.</p></footer>
      </body>
    </html>
  );
}

