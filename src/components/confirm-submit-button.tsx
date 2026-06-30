"use client";

import type { ReactNode } from "react";

export function ConfirmSubmitButton({
  message,
  children,
  className,
}: {
  message: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      className={className}
      type="submit"
      onClick={(event) => {
        if (!confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
