import { notFound, redirect } from "next/navigation";
import { adminModules } from "@/components/admin/adminModules";
import { AdminContentWorkspace } from "@/components/admin/AdminContentWorkspace";
import { AdminUsersWorkspace } from "@/components/admin/AdminUsersWorkspace";
import { AdminAuditLog } from "@/components/admin/AdminAuditLog";
import { AdminAuditLive } from "@/components/admin/AdminReportingLive";
import { CLIENT_CONFIG } from "@/config/client";

export default async function AdminModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  if (module === "consultants") redirect("/admin/users?tab=consultants");
  const section = adminModules.find(item => item.id === module);
  if (!section) notFound();
  if (section.kind === "directory") return <AdminUsersWorkspace />;
  if (section.kind === "audit") return CLIENT_CONFIG.adminAccounts ? <AdminAuditLive /> : <AdminAuditLog />;
  return <AdminContentWorkspace module={section} />;
}
