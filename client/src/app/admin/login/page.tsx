import type { Metadata } from "next";
import Link from "next/link";
import { AdminBrand } from "@/components/admin/AdminBrand";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { PasswordChangedNotice } from "@/components/auth/PasswordChangeForm";
import { CLIENT_CONFIG } from "@/config/client";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Đăng nhập" };

export default function AdminLoginPage() {
  return <main className={styles.login}>
    <section className={styles.loginIntro} aria-label="Giới thiệu khu vực quản trị">
      <AdminBrand />
      <div>
        <p className="eyebrow">HUYỀN CƠ · ADMIN</p>
        <h2>Không gian quản trị</h2>
        <p>Truy cập công cụ quản lý nội dung và vận hành website Huyền Cơ.</p>
      </div>
      <Link className={styles.textLink} href="/">← Về website người dùng</Link>
    </section>
    <section className={styles.loginPanel} aria-labelledby="admin-login-title">
      <p className="eyebrow">XÁC THỰC QUẢN TRỊ</p>
      <h1 id="admin-login-title">Đăng nhập quản trị</h1>
      <PasswordChangedNotice />
      <p id="admin-login-availability" className={styles.notice}>{CLIENT_CONFIG.adminEnabled
        ? "Dùng tài khoản Admin được cấp để vào khu vực quản trị."
        : "Chưa tích hợp xác thực. Dùng dữ liệu mẫu để kiểm tra các trường bắt buộc."}</p>
      <AdminLoginForm />
    </section>
  </main>;
}
