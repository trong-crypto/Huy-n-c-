import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Huyền Cơ",
  description: "Khung dự án Mai Hoa Dịch Số và Diễn Cầm Tam Thế",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>
        <header className="border-b border-emerald-950/10 bg-white/80">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
            <Link href="/" className="text-xl font-bold tracking-tight text-emerald-950">Huyền Cơ</Link>
            <div className="flex gap-5 text-sm font-medium text-slate-700">
              <Link href="/mai-hoa" className="hover:text-emerald-800">Mai Hoa</Link>
              <Link href="/tam-the" className="hover:text-emerald-800">Tam Thế</Link>
            </div>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}

