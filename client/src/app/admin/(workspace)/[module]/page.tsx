import { notFound } from "next/navigation";
import { adminModules } from "@/components/admin/adminModules";
import { AdminContentWorkspace } from "@/components/admin/AdminContentWorkspace";
import { AdminDirectory } from "@/components/admin/AdminDirectory";
import { AdminAuditLog } from "@/components/admin/AdminAuditLog";

export default async function AdminModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const section = adminModules.find(item => item.id === module);
  if (!section) notFound();
  if (section.kind === "directory") return <AdminDirectory key={section.id} module={section} />;
  if (section.kind === "audit") return <AdminAuditLog />;
  return <AdminContentWorkspace module={section} />;
}
