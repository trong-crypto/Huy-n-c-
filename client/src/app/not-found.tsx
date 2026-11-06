import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/ui/Page";

export default function NotFound() {
  return <PageContainer>
    <PageHeader eyebrow="404 / TRANG KHÔNG TỒN TẠI" title="Không tìm thấy trang.">
      <p>Kiểm tra lại địa chỉ hoặc chọn một trang đang có trên Huyền Cơ.</p>
    </PageHeader>
    <div className="hero-actions">
      <Link href="/" className="primary-button hero-cta">Về trang chủ</Link>
      <Link href="/hexagrams" className="secondary-button">Tra cứu quẻ</Link>
    </div>
  </PageContainer>;
}
