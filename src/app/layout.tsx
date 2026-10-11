import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobWork ERP",
  description: "Job-work factory management: inward/outward challans, rate cards and month-end billing.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
