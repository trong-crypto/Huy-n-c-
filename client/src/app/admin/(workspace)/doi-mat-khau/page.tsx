"use client";

import { useAdminSession } from "@/components/admin/AdminSessionGate";
import { PasswordChangeForm } from "@/components/auth/PasswordChangeForm";
import styles from "@/components/auth/customerAuth.module.css";

export default function AdminPasswordChangePage() {
  const auth = useAdminSession();
  return <section className={`section-card ${styles.passwordPage}`}>
    <p className="eyebrow">TÀI KHOẢN QUẢN TRỊ</p>
    <h1 className="section-title">Đổi mật khẩu</h1>
    {auth ? <>
      <p>Sau khi lưu, bạn sẽ cần đăng nhập lại trên các thiết bị đang sử dụng tài khoản này.</p>
      <PasswordChangeForm realm="admin" csrfToken={auth.session.csrfToken} loginUrl="/admin/login" />
    </> : <p>Bạn cần một phiên quản trị hợp lệ để đổi mật khẩu.</p>}
  </section>;
}
