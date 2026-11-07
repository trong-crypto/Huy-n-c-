import type { Metadata } from "next";
import { CustomerAuthPage } from "@/components/auth/CustomerAuthPage";

export const metadata: Metadata = { title: "Đăng nhập | Huyền Cơ" };

export default function LoginPage() {
  return <CustomerAuthPage mode="login" />;
}
