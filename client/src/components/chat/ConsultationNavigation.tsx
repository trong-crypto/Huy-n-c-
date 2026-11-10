import Link from "next/link";
import { aiConsultationPath } from "@/config/aiConsultation";
import { chatRoutes } from "./chatState";
import styles from "./aiConsultation.module.css";

export function ConsultationNavigation({ current }: { current: "ai" | "human" }) {
  return <nav className={styles.navigation} aria-label="Hình thức tư vấn">
    <Link href={aiConsultationPath} className="secondary-button" aria-current={current === "ai" ? "page" : undefined}>Hỏi AI</Link>
    <Link href={chatRoutes.user} className="secondary-button" aria-current={current === "human" ? "page" : undefined}>Chat với tư vấn viên</Link>
  </nav>;
}
