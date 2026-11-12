"use client";

import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/ui/Page";
import { divinationCatalog, truongXichMethod } from "@/config/divinationCatalog";
import { CLIENT_CONFIG } from "@/config/client";
import { listPublicMethods, type MethodDetail } from "@/services/rest/methodCatalog";
import { listPublishedGuides, type PublicGuide } from "@/services/rest/methodGuides";
import { useLookup } from "@/services/rest/useLookup";

export default function MethodCatalogPage() {
  return CLIENT_CONFIG.methodGuides ? <LiveCatalog /> : <Catalog />;
}

function LiveCatalog() {
  const methods = useLookup("published-methods", listPublicMethods);
  const guides = useLookup("published-method-guides", listPublishedGuides);
  return <Catalog entries={methods.data?.items ?? []} loading={methods.status === "loading"}
    catalogError={methods.status === "failed" ? methods.retry : undefined} guides={guides.data?.items}
    guideError={guides.status === "failed" ? guides.retry : undefined} />;
}

type CatalogItem = { code: string; label: string; input: string; summary?: string; introduction?: string; instructions?: string };

function Catalog({ entries, guides = [], loading, catalogError, guideError }: {
  entries?: MethodDetail[]; guides?: PublicGuide[]; loading?: boolean; catalogError?: () => void; guideError?: () => void;
}) {
  const families = divinationCatalog.map(family => {
    const defaults: readonly { code: string; formLabel: string; input: string }[] = family.href === "/mai-hoa" ? [...family.methods, truongXichMethod] : family.methods;
    const items = defaults.flatMap<CatalogItem>(method => {
      if (!entries) return [{ code: method.code, label: method.formLabel, input: method.input }];
      const entry = entries.find(item => item.method.code === method.code && item.method.formPath === family.href);
      return entry ? [{ code: method.code, label: entry.method.name, input: entry.requiredInput, summary: entry.method.summary,
        introduction: entry.introduction, instructions: entry.instructions }] : [];
    });
    return { family, items };
  }).filter(({ items }) => items.length > 0);

  return <PageContainer>
    <PageHeader eyebrow="DANH MỤC PHƯƠNG PHÁP" title="Chọn phương pháp theo dữ kiện bạn có">
      <p>Xem dữ kiện cần chuẩn bị và mở biểu mẫu phù hợp. Kết quả được xử lý trên Server khi có kết nối và dữ liệu nguồn phù hợp.</p>
    </PageHeader>
    {loading && <p role="status">Đang tải danh mục phương pháp…</p>}
    {catalogError && <p role="status">Chưa tải được danh mục phương pháp.{" "}
      <button type="button" className="secondary-button" onClick={catalogError}>Tải lại danh mục</button>
    </p>}
    {!loading && !catalogError && families.length === 0 && <p role="status">Hiện chưa có phương pháp trong danh mục.</p>}
    {guideError && <p role="status">Chưa tải được bài hướng dẫn.{" "}
      <button type="button" className="secondary-button" onClick={guideError}>Tải lại bài hướng dẫn</button>
    </p>}
    <div className="module-grid">
      {families.map(({ family, items }) => <section key={family.href} className="section-card method-catalog-card" aria-labelledby={`method-family-${family.number}`}>
        <p className="eyebrow">{entries ? family.group : family.tag}</p>
        <h2 id={`method-family-${family.number}`} className="section-title">{family.title}</h2>
        {!entries && <p>{family.description}</p>}
        <p className="module-status">Có biểu mẫu</p>
        <dl className="reference-fields">
          {items.map(method => {
            const guide = guides.find(item => item.methodCode === method.code);
            return <div key={method.code}>
              <dt><strong>{method.label}</strong></dt>
              <dd>{method.summary && <p>{method.summary}</p>}{method.input}
                {(method.introduction || method.instructions) && <details>
                  <summary>Giới thiệu và cách thực hiện</summary>
                  {method.introduction && <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{method.introduction}</p>}
                  {method.instructions && <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{method.instructions}</p>}
                </details>}
                {guide && <details>
                  <summary>{guide.title}</summary>
                  <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{guide.body}</p>
                </details>}</dd>
            </div>;
          })}
        </dl>
        <footer className="method-catalog-action">
          <Link className="secondary-button" href={family.href}>Mở biểu mẫu {family.group}</Link>
        </footer>
      </section>)}
    </div>
  </PageContainer>;
}
