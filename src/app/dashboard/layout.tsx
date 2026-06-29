import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
