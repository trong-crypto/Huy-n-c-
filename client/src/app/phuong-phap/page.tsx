"use client";

import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/ui/Page";
import { divinationCatalog } from "@/config/divinationCatalog";
import { CLIENT_CONFIG } from "@/config/client";
import { listPublishedGuides, type PublicGuide } from "@/services/rest/methodGuides";
import { useLookup } from "@/services/rest/useLookup";

export default function MethodCatalogPage() {
  return CLIENT_CONFIG.methodGuides ? <LiveCatalog /> : <Catalog />;
}

function LiveCatalog() {
  const published = useLookup("published-method-guides", listPublishedGuides);
  return <Catalog guides={published.data?.items} loadFailed={published.status === "failed"} retry={published.retry} />;
}

function Catalog({ guides = [], loadFailed, retry }: {
  guides?: PublicGuide[]; loadFailed?: boolean; retry?: () => void;
}) {
  return <PageContainer>
    <PageHeader eyebrow="DANH MỤC PHƯƠNG PHÁP" title="Chọn phương pháp theo dữ kiện bạn có">
      <p>Xem dữ kiện cần chuẩn bị, rồi mở biểu mẫu Mai Hoa hoặc Tam Thế. Kết quả được xử lý trên Server khi có kết nối và dữ liệu nguồn phù hợp.</p>
    </PageHeader>
    {loadFailed && <p role="status">Chưa tải được bài hướng dẫn.{" "}
      <button type="button" className="secondary-button" onClick={retry}>Tải lại bài hướng dẫn</button>
    </p>}
    <div className="module-grid">
      {divinationCatalog.map(family => <section key={family.href} className="section-card" aria-labelledby={`method-family-${family.number}`}>
        <p className="eyebrow">{family.tag}</p>
        <h2 id={`method-family-${family.number}`} className="section-title">{family.title}</h2>
        <p>{family.description}</p>
        <p className="module-status">Có biểu mẫu</p>
        <dl className="reference-fields">
          {family.methods.map(method => {
            const guide = guides.find(item => item.methodCode === method.code);
            return <div key={method.code}>
              <dt><strong>{method.formLabel}</strong></dt>
              <dd>{method.input}{guide && <details>
                <summary>{guide.title}</summary>
                <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{guide.body}</p>
              </details>}</dd>
            </div>;
          })}
        </dl>
        <Link className="secondary-button" href={family.href}>Mở biểu mẫu {family.group}</Link>
      </section>)}
    </div>
  </PageContainer>;
}
