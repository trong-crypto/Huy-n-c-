import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/ui/Page";
import { PasswordRecoveryForm } from "@/components/auth/PasswordRecoveryForm";
import { CLIENT_CONFIG } from "@/config/client";
import styles from "@/components/auth/customerAuth.module.css";

export const metadata: Metadata = { title: "Quên mật khẩu | Huyền Cơ" };

export default function ForgotPasswordPage() {
  return <PageContainer className={styles.passwordPage}>
    <PageHeader eyebrow="TÀI KHOẢN" title="Quên mật khẩu">
      <p>Liên hệ quản trị viên để xác minh danh tính và nhận mã khôi phục dùng một lần. Không gửi mật khẩu mới cho quản trị viên.</p>
    </PageHeader>
    <section className="section-card" aria-label="Đặt lại mật khẩu">
      {CLIENT_CONFIG.accountHistory ? <PasswordRecoveryForm /> : <p>Tính năng cần kết nối xác thực với máy chủ.</p>}
    </section>
  </PageContainer>;
}
