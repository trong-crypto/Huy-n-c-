import type { Metadata } from "next";
import { CustomerPasswordChange } from "@/components/auth/CustomerPasswordChange";
import { PageContainer, PageHeader } from "@/components/ui/Page";
import { CLIENT_CONFIG } from "@/config/client";
import styles from "@/components/auth/customerAuth.module.css";

export const metadata: Metadata = { title: "Đổi mật khẩu | Huyền Cơ" };

export default function PasswordChangePage() {
  return <PageContainer className={styles.passwordPage}>
    <PageHeader eyebrow="TÀI KHOẢN" title="Đổi mật khẩu">
      <p>Sau khi lưu, bạn sẽ cần đăng nhập lại trên các thiết bị đang sử dụng tài khoản này.</p>
    </PageHeader>
    <section className="section-card" aria-label="Thiết lập mật khẩu">
      {CLIENT_CONFIG.accountHistory ? <CustomerPasswordChange /> : <p>Tính năng cần kết nối xác thực với máy chủ.</p>}
    </section>
  </PageContainer>;
}
