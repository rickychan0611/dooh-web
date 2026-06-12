import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";
import { requireAdmin } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdmin();
  return <AdminShell>{children}</AdminShell>;
}
