import { HexagramDetailPanel } from "@/components/hexagrams/HexagramDetailPanel";

export default async function HexagramDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <HexagramDetailPanel code={code} />;
}
