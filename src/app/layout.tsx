import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Panel Pro — 3D Electrical Panel CAD Workbench",
  description: "3D Electrical Panel Layout, DIN Rail Snap & 1:1 Drilling Template",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased selection:bg-sky-500/30 selection:text-sky-200">
        {children}
      </body>
    </html>
  );
}
