import { notFound } from "next/navigation";
import { adminModules } from "@/components/admin/adminModules";
import { AdminContentWorkspace } from "@/components/admin/AdminContentWorkspace";

export default async function AdminContentPage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const section = adminModules.find(item => item.id === module);
  if (!section || !("href" in section)) notFound();
  return <AdminContentWorkspace module={section} />;
}
