import { HistoryDetailPanel } from "@/components/history/HistoryDetailPanel";
export default async function HistoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; return <HistoryDetailPanel id={id} />;
}
