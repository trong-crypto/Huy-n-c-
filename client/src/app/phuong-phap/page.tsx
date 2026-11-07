import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/ui/Page";
import { divinationCatalog } from "@/config/divinationCatalog";

export default function MethodCatalogPage() {
  return <PageContainer>
    <PageHeader eyebrow="DANH MỤC PHƯƠNG PHÁP" title="Chọn phương pháp theo dữ kiện bạn có">
      <p>Xem dữ kiện cần chuẩn bị, rồi mở biểu mẫu Mai Hoa hoặc Tam Thế. Kết quả được xử lý trên Server khi có kết nối và dữ liệu nguồn phù hợp.</p>
    </PageHeader>
    <div className="module-grid">
      {divinationCatalog.map(family => <section key={family.href} className="section-card" aria-labelledby={`method-family-${family.number}`}>
        <p className="eyebrow">{family.tag}</p>
        <h2 id={`method-family-${family.number}`} className="section-title">{family.title}</h2>
        <p>{family.description}</p>
        <p className="module-status">Có biểu mẫu</p>
        <dl className="reference-fields">
          {family.methods.map(method => <div key={method.code}>
            <dt><strong>{method.formLabel}</strong></dt><dd>{method.input}</dd>
          </div>)}
        </dl>
        <Link className="secondary-button" href={family.href}>Mở biểu mẫu {family.group}</Link>
      </section>)}
    </div>
  </PageContainer>;
}
