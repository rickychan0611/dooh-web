import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DOOH Interactive Screen Platform",
  description: "Advertising playlists and community bulletin boards.",
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
