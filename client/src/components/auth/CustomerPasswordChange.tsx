"use client";

import Link from "next/link";
import { customerAuthRoutes } from "@/config/customerAuthRoutes";
import { getCustomerSession } from "@/services/rest/customerAuth";
import { RestError } from "@/services/rest/transport";
import { useLookup } from "@/services/rest/useLookup";
import { PasswordChangeForm } from "./PasswordChangeForm";

export function CustomerPasswordChange() {
  const session = useLookup("password-change", getCustomerSession);
  if (session.status === "loading") return <p role="status">Đang kiểm tra phiên…</p>;
  if (session.data) {
    return <PasswordChangeForm realm="customer" csrfToken={session.data.csrfToken} loginUrl={customerAuthRoutes.login} />;
  }
  if (session.error instanceof RestError && session.error.code === "INVALID_SESSION") {
    return <><p role="alert">Bạn cần đăng nhập để đổi mật khẩu.</p>
      <Link className="secondary-button" href={customerAuthRoutes.login}>Đăng nhập</Link></>;
  }
  return <><p role="alert">Chưa xác minh được phiên.</p>
    <button type="button" className="secondary-button" onClick={session.retry}>Thử lại</button></>;
}
