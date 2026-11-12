"use client";

import Link from "next/link";
import { useState } from "react";
import { websiteEditorApi, websiteSections } from "@/services/rest/websiteContent";
import { useAdminSession } from "./AdminSessionGate";
import { LoadContentEditor } from "./MethodGuideWorkspace";
import styles from "./admin.module.css";

export function WebsiteContentWorkspace() {
  const [selected, setSelected] = useState<(typeof websiteSections)[number]>(websiteSections[0]);
  const auth = useAdminSession();
  if (!auth) return <p role="status">Cần phiên Admin để quản lý nội dung website.</p>;

  return <div className={styles.contentGrid}>
    <section className={styles.contentPanel} aria-labelledby="website-content-title">
      <h2 id="website-content-title">Khu vực nội dung</h2>
      <ul className={styles.recordList}>
        {websiteSections.map(section => <li key={section.code}>
          <button type="button" aria-pressed={selected.code === section.code} onClick={() => setSelected(section)}>
            {section.title}
          </button>
        </li>)}
      </ul>
      <p>Mô tả từng phương pháp dùng nội dung đã quản lý tại <Link href="/admin/methods">Bài hướng dẫn phương pháp</Link>.</p>
    </section>
    <LoadContentEditor key={selected.code} method={selected} api={websiteEditorApi} csrf={auth.session.csrfToken}
      handleError={auth.handleError} />
  </div>;
}
