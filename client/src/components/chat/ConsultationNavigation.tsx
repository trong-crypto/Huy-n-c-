import Link from "next/link";
import { aiConsultationPath } from "@/config/aiConsultation";
import { chatRoutes } from "./chatState";
import styles from "./chat.module.css";

export function ConsultationNavigation({ current }: { current: "ai" | "human" }) {
  return <nav className={styles.navigation} aria-label="Hình thức tư vấn">
    <Link href={chatRoutes.user} aria-current={current === "human" ? "page" : undefined}>Chat với tư vấn viên</Link>
    <Link href={aiConsultationPath} aria-current={current === "ai" ? "page" : undefined}>Hỏi AI</Link>
  </nav>;
}
