import Link from "next/link";
import { PageContainer } from "@/components/ui/Page";
import { BrandSymbol, CelestialArt, TimeSymbol } from "@/components/ui/CelestialArt";
import { HomeWebsiteContent } from "@/components/ui/HomeWebsiteContent";
import { CLIENT_CONFIG } from "@/config/client";
import { divinationCatalog, methodCatalogHref } from "@/config/divinationCatalog";

const tools = [
  { href: "/hexagrams", title: "Thư viện 64 quẻ", description: "Tìm tên quẻ, xem sáu hào và đối chiếu nguồn." },
  { href: "/calendar", title: "Lịch Âm – Dương", description: "Đổi ngày và tra Can Chi theo ngày giờ đã chọn." },
  { href: "/history", title: "Lịch sử riêng tư", description: "Tìm và mở lại các kết quả bạn đã chủ động lưu." },
];

export default function Home() {
  return (
    <PageContainer>
      <section className="home-hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow"><span aria-hidden="true">✧</span> TRI THỨC CỔ TRUYỀN · TRẢI NGHIỆM HIỆN ĐẠI</p>
          <h1 id="hero-title">Khám phá<br /><em>Huyền Cơ</em></h1>
          <p className="hero-description">Tra cứu và tìm hiểu Mai Hoa Dịch Số, Tam Thế và lịch truyền thống qua dữ liệu, quy tắc và nguồn tham chiếu rõ ràng.</p>
          <div className="hero-actions">
            <Link href="/mai-hoa" className="primary-button hero-cta">Khám phá Mai Hoa <span aria-hidden="true">↗</span></Link>
            <Link href="/tam-the" className="secondary-button">Tìm hiểu Tam Thế <span aria-hidden="true">→</span></Link>
          </div>
          <p className="hero-note"><span aria-hidden="true">◇</span> Tôn trọng nguồn gốc. Khám phá có căn cứ.</p>
        </div>
        <div className="hero-art" aria-hidden="true"><div className="celestial-halo" /><CelestialArt /><span className="art-caption">ÂM DƯƠNG TƯƠNG SINH · VẠN VẬT BIẾN HÓA</span></div>
      </section>
      <HomeSections />
    </PageContainer>
  );
}

function HomeSections() {
  const sections = <>
      <div className="section-introduction"><div><p className="eyebrow">PHƯƠNG PHÁP</p><h2>Chọn một hành trình</h2></div><Link href={methodCatalogHref} className="secondary-button">Xem danh mục phương pháp</Link></div>
      <div className="module-grid">
        {divinationCatalog.map((module) => (
          <Link key={module.href} href={module.href} className="module-card">
            <div className="module-card-top"><span className="module-symbol">{module.href === "/mai-hoa" ? <BrandSymbol /> : <TimeSymbol />}</span><span className="module-number">{module.number}</span></div>
            <p className="eyebrow">{module.tag}</p>
            <h2>{module.title}</h2>
            <p>{module.description}</p>
            <p className="module-status">{module.summary}</p>
            <span className="module-card-action">{module.action} <span aria-hidden="true">↗</span></span>
          </Link>
        ))}
      </div>
      <section aria-labelledby="home-tools-title">
        <div className="section-introduction"><div><p className="eyebrow">CÔNG CỤ TRA CỨU</p><h2 id="home-tools-title">Tìm và xem lại</h2></div></div>
        <div className="home-tools">{tools.map(tool => <Link key={tool.href} href={tool.href} className="section-card home-tool">
          <h3>{tool.title} <span aria-hidden="true">↗</span></h3><p>{tool.description}</p>
        </Link>)}</div>
      </section>
  </>;
  const usage = <section id="huong-dan" className="home-guide" aria-labelledby="home-guide-title">
        <div className="section-introduction"><div><p className="eyebrow">HƯỚNG DẪN</p><h2 id="home-guide-title">Bắt đầu trong ba bước</h2></div></div>
        <ol className="home-tools">
          <li className="section-card"><p className="eyebrow">01</p><h3>Chọn cách tra</h3><p>Mai Hoa có thời gian, số vật, sáu hào và trượng thước. Tam Thế dùng ngày giờ sinh và loại lịch.</p></li>
          <li className="section-card"><p className="eyebrow">02</p><h3>Gửi dữ kiện</h3><p>Điền biểu mẫu, chọn nội dung muốn xem rồi theo dõi tiến trình trong phần phản hồi.</p></li>
          <li className="section-card"><p className="eyebrow">03</p><h3>Đọc và lưu kết quả</h3><p>Xem lời giải nghĩa và nguồn đi kèm. Chọn lưu nếu bạn muốn mở lại trong lịch sử riêng tư.</p></li>
        </ol>
      </section>;
  return CLIENT_CONFIG.websiteContent ? <HomeWebsiteContent usage={usage}>{sections}</HomeWebsiteContent>
    : <>{sections}{usage}</>;
}

