import type { Metadata } from "next";
import { PublicSiteShell } from "@/components/PublicSiteShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Huyền Cơ",
  description: "Tra cứu tri thức Mai Hoa Dịch Số và Diễn Cầm Tam Thế với nguồn tham chiếu rõ ràng",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <PublicSiteShell>{children}</PublicSiteShell>
      </body>
    </html>
  );
}

