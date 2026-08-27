import type { Metadata } from "next";
import AppNav from "@/components/AppNav";
import "./globals.css";

export const metadata: Metadata = { title: "TCF Lab — Study Instrument", description: "A focused French study instrument for TCF Canada." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>
        <AppNav />
        <main className="app-main">{children}</main>
      </body>
    </html>
  );
}
