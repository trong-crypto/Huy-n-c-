import { AiConsultationWorkspace } from "@/components/chat/AiConsultationWorkspace";
import { ConsultationNavigation } from "@/components/chat/ConsultationNavigation";
import { PageContainer } from "@/components/ui/Page";
import { isUuid } from "@/types/historyValidation";
import styles from "@/components/chat/chat.module.css";

export default async function AiConsultationPage({
  searchParams,
}: {
  searchParams: Promise<{ readingId?: string | string[]; calculationRequestId?: string | string[] }>;
}) {
  const { readingId, calculationRequestId } = await searchParams;
  const reference = isUuid(readingId) && calculationRequestId === undefined ? { readingId }
    : isUuid(calculationRequestId) && readingId === undefined ? { calculationRequestId } : undefined;
  const invalidReference = !reference && (readingId !== undefined || calculationRequestId !== undefined);

  return <PageContainer className={styles.page}>
    <header className={styles.masthead}>
      <div><p className="eyebrow">HUYỀN CƠ / TƯ VẤN</p><h1>Hỏi AI</h1></div>
      <ConsultationNavigation current="ai" />
    </header>
    <AiConsultationWorkspace key={reference ? Object.values(reference)[0] : String(invalidReference)}
      reference={reference} invalidReference={invalidReference} />
  </PageContainer>;
}
