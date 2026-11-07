import type { Metadata } from "next";
import { CustomerAuthPage } from "@/components/auth/CustomerAuthPage";

export const metadata: Metadata = { title: "Đăng ký | Huyền Cơ" };

export default function RegistrationPage() {
  return <CustomerAuthPage mode="register" />;
}
