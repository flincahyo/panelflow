import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PanelFlow — 3D Electrical Panel CAD Workbench",
  description:
    "Industrial 3D & 2D Electrical Panel Layout, DIN Rail Snap & 1:1 Drilling Template (.pflow)",
};

const THEME_INIT_SCRIPT = `
(function() {
  try {
    var saved = localStorage.getItem('panelflow_saved_theme');
    var theme = saved === 'dark' ? 'dark' : 'light';
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.documentElement.style.backgroundColor = '#090b10';
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.documentElement.style.backgroundColor = '#f8fafc';
      document.documentElement.style.colorScheme = 'light';
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-[#f8fafc] dark:bg-[#090b10] text-[#0f172a] dark:text-slate-100 antialiased selection:bg-slate-900/15 dark:selection:bg-white/20 selection:text-slate-900 dark:selection:text-white">
        {children}
      </body>
    </html>
  );
}
