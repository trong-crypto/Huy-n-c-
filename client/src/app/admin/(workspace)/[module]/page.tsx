import { notFound } from "next/navigation";
import { workspaceModules } from "@/components/admin/adminModules";
import { AdminContentWorkspace } from "@/components/admin/AdminContentWorkspace";
import { AdminDirectory } from "@/components/admin/AdminDirectory";
import { AdminAuditLog } from "@/components/admin/AdminAuditLog";
import { AdminAuditLive } from "@/components/admin/AdminReportingLive";
import { CLIENT_CONFIG } from "@/config/client";

export default async function AdminModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const section = workspaceModules.find(item => item.id === module);
  if (!section) notFound();
  if (section.kind === "directory") return <AdminDirectory key={section.id} module={section} />;
  if (section.kind === "audit") return CLIENT_CONFIG.adminAccounts ? <AdminAuditLive /> : <AdminAuditLog />;
  return <AdminContentWorkspace module={section} />;
}
