import type { ButtonHTMLAttributes, ReactNode } from "react";

export function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="section-card"><h2 className="section-title">{title}</h2>{children}</section>;
}

export function FormField({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {hint && <p id={`${id}-hint`} className="field-hint">{hint}</p>}
      {children}
    </div>
  );
}

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return <p id={id} className="field-error" role="alert">{children}</p>;
}

export function PrimaryButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`primary-button ${className}`} {...props}>{children}</button>;
}

export function StatusBanner({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" }) {
  // Informational content, not a fabricated connection/progress event.
  return <p className={`status-banner status-banner--${tone}`}>{children}</p>;
}
