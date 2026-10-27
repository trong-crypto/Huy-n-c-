import Link from "next/link";
import { PageContainer } from "@/components/ui/Page";
import { BrandSymbol, CelestialArt, TimeSymbol } from "@/components/ui/CelestialArt";

const modules = [
  {
    href: "/mai-hoa",
    number: "01",
    title: "Mai Hoa Dịch Số",
    tag: "SÁU HÀO · THỜI GIAN · SỐ VẬT",
    description: "Khám phá chuyển động Âm Dương qua sáu hào, thời điểm hoặc số vật. Bắt đầu bằng phương pháp phù hợp với bạn.",
    status: "Sáu hào · Thời gian · Số vật đếm được",
    action: "Khám phá Mai Hoa",
  },
  {
    href: "/tam-the",
    number: "02",
    title: "Diễn Cầm Tam Thế",
    tag: "NGÀY SINH · GIỜ SINH · LỊCH",
    description: "Tiếp cận tri thức Diễn Cầm Tam Thế từ ngày giờ sinh và lịch truyền thống, với căn cứ nguồn được đối chiếu.",
    status: "Công danh · Tài lộc · Tình duyên",
    action: "Tìm hiểu Tam Thế",
  },
];

export default function Home() {
  return (
    <PageContainer>
      <section className="home-hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow"><span aria-hidden="true">✧</span> TRI THỨC CỔ TRUYỀN · TRẢI NGHIỆM HIỆN ĐẠI</p>
          <h1 id="hero-title">Khám phá<br /><em>Huyền Cơ</em></h1>
          <p className="hero-description">Một không gian tĩnh tại để khám phá Mai Hoa Dịch Số, Tam Thế và chiều sâu tri thức phương Đông.</p>
          <div className="hero-actions">
            <Link href="/mai-hoa" className="primary-button hero-cta">Khám phá Mai Hoa <span aria-hidden="true">↗</span></Link>
            <Link href="/tam-the" className="secondary-button">Tìm hiểu Tam Thế <span aria-hidden="true">→</span></Link>
          </div>
          <p className="hero-note"><span aria-hidden="true">◇</span> Tôn trọng nguồn gốc. Khám phá có căn cứ.</p>
        </div>
        <div className="hero-art" aria-hidden="true"><div className="celestial-halo" /><CelestialArt /><span className="art-caption">ÂM DƯƠNG TƯƠNG SINH · VẠN VẬT BIẾN HÓA</span></div>
      </section>
      <div className="section-introduction"><div><p className="eyebrow">HAI LỐI KHÁM PHÁ</p><h2>Chọn một hành trình</h2></div><p>Từ dữ liệu rõ ràng đến tri thức có nguồn.</p></div>
      <div className="module-grid">
        {modules.map((module) => (
          <Link key={module.href} href={module.href} className="module-card">
            <div className="module-card-top"><span className="module-symbol">{module.href === "/mai-hoa" ? <BrandSymbol /> : <TimeSymbol />}</span><span className="module-number">{module.number}</span></div>
            <p className="eyebrow">{module.tag}</p>
            <h2>{module.title}</h2>
            <p>{module.description}</p>
            <p className="module-status">{module.status}</p>
            <span className="module-card-action">{module.action} <span aria-hidden="true">↗</span></span>
          </Link>
        ))}
      </div>
      <section className="discovery-note" aria-label="Nguyên tắc khám phá"><span aria-hidden="true">✧</span><div><h2>Tri thức luôn đi cùng căn cứ</h2><p>Chọn phương pháp, nhập dữ liệu, đối chiếu phản hồi. Khi nguồn chưa đủ hoặc chức năng chưa sẵn sàng, hệ thống thông báo rõ ràng.</p></div></section>
    </PageContainer>
  );
}

