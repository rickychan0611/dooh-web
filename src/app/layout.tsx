import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DOOH Community | Digital signage for local business",
  description: "Turn any TV or browser into managed digital signage with promotions, scheduling, and an optional community board.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
