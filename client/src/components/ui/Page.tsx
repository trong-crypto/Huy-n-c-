import type { ReactNode } from "react";

export function PageContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <main id="main-content" tabIndex={-1} className={`page-container ${className}`.trim()}>{children}</main>;
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <header className="page-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <div className="page-description">{children}</div>
    </header>
  );
}
