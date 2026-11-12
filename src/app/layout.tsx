import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PanelFlow — 3D Electrical Panel CAD Workbench",
  description:
    "Industrial 3D & 2D Electrical Panel Layout, DIN Rail Snap & 1:1 Drilling Template (.pflow)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#090b10] text-slate-100 antialiased selection:bg-white/20 selection:text-white">
        {children}
      </body>
    </html>
  );
}
