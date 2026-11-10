import { AiConsultationWorkspace } from "@/components/chat/AiConsultationWorkspace";
import { ConsultationNavigation } from "@/components/chat/ConsultationNavigation";
import { PageContainer, PageHeader } from "@/components/ui/Page";
import { isUuid } from "@/types/historyValidation";

export default async function AiConsultationPage({
  searchParams,
}: {
  searchParams: Promise<{ readingId?: string | string[]; calculationRequestId?: string | string[] }>;
}) {
  const { readingId, calculationRequestId } = await searchParams;
  const reference = isUuid(readingId) && calculationRequestId === undefined ? { readingId }
    : isUuid(calculationRequestId) && readingId === undefined ? { calculationRequestId } : undefined;
  const invalidReference = !reference && (readingId !== undefined || calculationRequestId !== undefined);

  return <PageContainer>
    <PageHeader eyebrow="TƯ VẤN HUYỀN CƠ" title="Hỏi AI">
      <p>Hỏi về cách đọc quẻ hoặc nhờ giải thích kết quả Mai Hoa bằng tiếng Việt dễ hiểu.</p>
    </PageHeader>
    <ConsultationNavigation current="ai" />
    <AiConsultationWorkspace key={reference ? Object.values(reference)[0] : String(invalidReference)}
      reference={reference} invalidReference={invalidReference} />
  </PageContainer>;
}
