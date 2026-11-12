"use client";

import { useState } from "react";
import Link from "next/link";
import { FormField } from "@/components/ui/Controls";
import { divinationCatalog } from "@/config/divinationCatalog";
import { CLIENT_CONFIG } from "@/config/client";
import { MethodCatalogWorkspace } from "./MethodCatalogWorkspace";
import { AdminContentForm } from "./AdminContentForm";
import { AdminHexagramCatalog } from "./AdminHexagramCatalog";
import { AdminSourceCatalog } from "./AdminSourceCatalog";
import { WebsiteContentWorkspace } from "./WebsiteContentWorkspace";
import type { ContentModule } from "./adminModules";
import styles from "./admin.module.css";

const methods = divinationCatalog.flatMap(family => family.methods.map(method => ({ ...method, group: family.group })));

function MethodManagement() {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const method = methods.find(item => item.code === selected);
  const keyword = query.trim().toLocaleLowerCase("vi");
  const matches = methods.filter(item => (!group || item.group === group)
    && `${item.title} ${item.code} ${item.group}`.toLocaleLowerCase("vi").includes(keyword));

  return <div className={styles.contentGrid}>
    <section className={styles.contentPanel} aria-labelledby="method-list-title">
      <h2 id="method-list-title">Phương pháp có trên website</h2>
      <p className="field-hint">Danh mục theo tính năng hiện có. Trạng thái quản trị chưa có dữ liệu.</p>
      <div className={styles.inlineFields}>
        <FormField id="admin-method-search" label="Tìm phương pháp">
          <input type="search" id="admin-method-search" value={query} onChange={event => setQuery(event.target.value)} />
        </FormField>
        <FormField id="admin-method-group" label="Nhóm phương pháp">
          <select id="admin-method-group" value={group} onChange={event => setGroup(event.target.value)}>
            <option value="">Tất cả</option>{divinationCatalog.map(family => <option key={family.href}>{family.group}</option>)}
          </select>
        </FormField>
      </div>
      <p role="status">{matches.length} phương pháp phù hợp</p>
      {matches.length === 0 ? <p>Không có phương pháp phù hợp.</p> : <ul className={styles.recordList}>
        {matches.map(item => <li key={item.code}>
          <button type="button" aria-pressed={selected === item.code} onClick={() => setSelected(item.code)}>{item.title}<small>{item.group} · {item.code}</small></button>
        </li>)}
      </ul>}
      <button type="button" className="secondary-button" aria-pressed={selected === null} onClick={() => setSelected(null)}>Soạn mô tả mới</button>
    </section>
    <div className={styles.contentStack}>
      {method && <section className={styles.contentPanel} aria-label="Chi tiết phương pháp">
        <h2>{method.title}</h2><p>{method.group} · <code>{method.code}</code></p><p>{method.body}</p>
        <p className="field-hint">Trạng thái hoạt động hoặc ẩn đang chờ dữ liệu quản trị.</p>
      </section>}
      <AdminContentForm key={method?.code ?? "new"} heading={method ? "Chỉnh sửa mô tả" : "Soạn mô tả mới"}
        initialTitle={method?.title} initialBody={method?.body} hasVisibility />
    </div>
  </div>;
}

const websiteSections = ["Giới thiệu", "Hướng dẫn sử dụng", "Mô tả phương pháp"];

function WebsiteManagement() {
  const [section, setSection] = useState(websiteSections[0]);
  return <div className={styles.contentGrid}>
    <section className={styles.contentPanel} aria-labelledby="website-sections-title">
      <h2 id="website-sections-title">Khu vực nội dung</h2>
      <ul className={styles.recordList}>
        {websiteSections.map(item => <li key={item}><button type="button" aria-pressed={section === item} onClick={() => setSection(item)}>{item}</button></li>)}
      </ul>
      <p className="field-hint">Bản đã công bố và trạng thái công bố đang chờ Backend.</p>
    </section>
    <AdminContentForm key={section} heading={`Soạn nội dung · ${section}`} initialTitle={section} />
  </div>;
}

function SourceManagement() {
  return <div className={styles.contentGrid}>
    <section className={styles.contentPanel} aria-labelledby="sources-list-title">
      <h2 id="sources-list-title">Danh sách dữ liệu nguồn</h2>
      <p>Chưa thể tải danh sách hoặc mở chi tiết nguồn vì API quản trị chưa sẵn sàng.</p>
      <dl className={styles.workflow}>
        <div><dt>Trạng thái kiểm duyệt</dt><dd>Chờ dữ liệu từ Backend</dd></div>
        <div><dt>Phiên bản</dt><dd>Chờ xác nhận hỗ trợ từ Backend</dd></div>
      </dl>
      <Link className={styles.textLink} href="/admin/readings">Xem nguồn tham chiếu trong chi tiết quẻ →</Link>
    </section>
    <AdminContentForm heading="Soạn đề xuất chỉnh sửa nguồn" requiresProvenance />
  </div>;
}

function ReviewWorkflow() {
  return <section className={styles.contentPanel} aria-labelledby="review-workflow-title">
    <h2 id="review-workflow-title">Quy trình duyệt đề xuất</h2>
    <ol className={styles.workflow}>
      <li><span className={styles.badge}>Bản nháp</span></li>
      <li><span className={styles.badge}>Chờ duyệt</span></li>
      <li><span className={styles.badge}>Đã công bố</span></li>
    </ol>
    <p className="field-hint">Đây là các bước dự kiến. Trạng thái của từng bản ghi do Backend cung cấp sau khi tích hợp.</p>
    <details className={styles.reviewDetails}>
      <summary>Xem bước xác nhận gửi duyệt hoặc công bố</summary>
      <p>Kiểm tra bản xem trước và phạm vi nội dung trước khi xác nhận. Cần phiên Admin và quyền thực hiện thao tác.</p>
      <div className={styles.contentActions}>
        <button type="button" className="secondary-button" aria-describedby="content-write-notice" disabled>Xác nhận gửi duyệt</button>
        <button type="button" className="secondary-button" aria-describedby="content-write-notice" disabled>Xác nhận công bố</button>
      </div>
    </details>
  </section>;
}

export function AdminContentWorkspace({ module }: { module: ContentModule }) {
  const liveSources = module.id === "sources" && CLIENT_CONFIG.adminSourceCatalog;
  const liveWebsite = module.id === "website" && CLIENT_CONFIG.websiteContent;
  const liveContent = liveSources || liveWebsite
    || module.id === "readings" && (CLIENT_CONFIG.adminHexagramGlosses || CLIENT_CONFIG.hexagramInterpretations);
  if (module.id === "methods" && CLIENT_CONFIG.methodGuides) return <MethodCatalogWorkspace />;
  return <div className={`${styles.contentStack} ${styles.horizontalWorkspace}`}>
    <header className={styles.dashboardIntro}>
      <p className="eyebrow">HUYỀN CƠ / QUẢN TRỊ NỘI DUNG</p>
      <h1>{module.title}</h1><p>{module.description}</p>
    </header>
    {!liveContent && <p id="content-write-notice" className={styles.notice}>
      Đang chờ API quản trị và phân quyền Admin. Có thể xem dữ liệu công khai khi có và soạn bản xem trước. Lưu, đổi trạng thái và công bố đang bị khóa.
    </p>}
    {module.id === "methods" && <MethodManagement />}
    {module.id === "readings" && <AdminHexagramCatalog />}
    {module.id === "sources" && (liveSources ? <AdminSourceCatalog /> : <SourceManagement />)}
    {module.id === "website" && (liveWebsite ? <WebsiteContentWorkspace /> : <WebsiteManagement />)}
    {!liveContent && <ReviewWorkflow />}
  </div>;
}
