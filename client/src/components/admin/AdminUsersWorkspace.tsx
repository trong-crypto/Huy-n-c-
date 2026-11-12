"use client";

import { Suspense, useRef, type KeyboardEvent } from "react";
import { useSearchParams } from "next/navigation";
import { AdminDirectory } from "./AdminDirectory";
import { adminModules } from "./adminModules";
import styles from "./admin.module.css";

const tabs = [
  { id: "accounts", title: "Tất cả tài khoản", module: adminModules[0] },
  { id: "consultants", title: "Tư vấn viên", module: adminModules.find(module => module.id === "consultants")! },
] as const;

function PeopleTabs() {
  const searchParams = useSearchParams();
  const active = searchParams.get("tab") === "consultants" ? 1 : 0;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function select(index: number) {
    if (index === active) return;
    const params = new URLSearchParams(searchParams.toString());
    if (index === 1) params.set("tab", "consultants");
    else params.delete("tab");
    const query = params.toString();
    window.history.pushState(null, "", query ? `?${query}` : "/admin/users");
  }

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    switch (event.key) {
      case "ArrowLeft":
      case "ArrowRight":
        next = 1 - index;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    buttons.current[next]?.focus();
    select(next);
  }

  return <>
    <div role="tablist" aria-label="Quản lý người dùng" className={styles.tabs}>
      {tabs.map(({ id, title }, index) => <button key={id} type="button" role="tab" id={`people-tab-${id}`}
        ref={node => { buttons.current[index] = node; }} aria-controls={`people-panel-${id}`}
        aria-selected={index === active} tabIndex={index === active ? 0 : -1}
        onClick={() => select(index)} onKeyDown={event => navigate(event, index)}>{title}</button>)}
    </div>
    {tabs.map(({ id, module }, index) => <section key={id} role="tabpanel" id={`people-panel-${id}`}
      aria-labelledby={`people-tab-${id}`} hidden={index !== active}>
      <AdminDirectory module={module} showHeading={false} />
    </section>)}
  </>;
}

export function AdminUsersWorkspace() {
  return <div className={styles.contentStack}>
    <header className={styles.dashboardIntro}>
      <p className="eyebrow">HUYỀN CƠ / QUẢN TRỊ TÀI KHOẢN</p>
      <h1>{adminModules[0].title}</h1>
      <p>{adminModules[0].description}</p>
    </header>
    <Suspense fallback={<p role="status">Đang tải Quản lý người dùng…</p>}><PeopleTabs /></Suspense>
  </div>;
}
