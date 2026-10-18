import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "vlab-framework",
  description: "Teacher-oriented AI-enabled virtual science labs (NCERT 6–10).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
