import Link from "next/link";
import { CelestialArt } from "@/components/ui/CelestialArt";
import { customerAuthRoutes } from "@/config/customerAuthRoutes";
import { CLIENT_CONFIG } from "@/config/client";
import { CustomerAuthForm } from "./CustomerAuthForm";
import { PasswordChangedNotice } from "./PasswordChangeForm";
import styles from "./customerAuth.module.css";

export function CustomerAuthPage({ mode }: { mode: keyof typeof customerAuthRoutes }) {
  const registering = mode === "register";
  const title = registering ? "Đăng ký tài khoản" : "Đăng nhập";

  return (
    <main id="main-content" className={`page-container ${styles.page}`} tabIndex={-1}>
      <div className={styles.intro}>
        <p className="eyebrow">HUYỀN CƠ · KHÔNG GIAN NGƯỜI DÙNG</p>
        <p className={styles.tagline}>Khám phá tri thức Dịch học</p>
        <p>Tra cứu quẻ, lập quẻ Mai Hoa và tìm hiểu Tam Thế cùng nguồn tham chiếu.</p>
        <div className={styles.art}><CelestialArt compact /></div>
        <Link href="/" className={styles.link}>← Về trang chủ</Link>
      </div>
      <section className={`section-card ${styles.panel}`} aria-labelledby="customer-auth-title">
        <p className="eyebrow">TÀI KHOẢN KHÁCH HÀNG</p>
        <h1 id="customer-auth-title">{title}</h1>
        {!registering && <PasswordChangedNotice />}
        <p id="customer-auth-availability" className="status-banner status-banner--warning">
          {CLIENT_CONFIG.accountHistory ? "Dùng tài khoản của bạn để lưu và xem lại lá số." :
            `Tính năng ${registering ? "đăng ký" : "đăng nhập"} đang chờ kết nối với máy chủ. Bạn có thể dùng dữ liệu mẫu để kiểm tra biểu mẫu.`}
        </p>
        <CustomerAuthForm registering={registering} />
        <p className={styles.switchLink}>
          {registering ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
          <Link className={styles.link} href={registering ? customerAuthRoutes.login : customerAuthRoutes.register}>
            {registering ? "Đăng nhập" : "Đăng ký"}
          </Link>
        </p>
      </section>
    </main>
  );
}
