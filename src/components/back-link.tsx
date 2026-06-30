"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export function BackLink({ label = "Back" }: { label?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      className="link-button post-back-link"
      onClick={() => router.back()}
    >
      <ChevronLeft aria-hidden size={18} strokeWidth={2.5} />
      {label}
    </button>
  );
}
