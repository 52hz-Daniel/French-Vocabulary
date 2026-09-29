import type { Metadata } from "next";
import AppNav from "@/components/AppNav";
import LocalStatsMigration from "@/components/LocalStatsMigration";
import LanguageProvider from "@/components/LanguageProvider";
import { serverLanguage } from "@/lib/server-language";
import "./globals.css";

export const metadata: Metadata = { title: "TCF Lab — Study Instrument", description: "A focused French study instrument for TCF Canada." };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const language = await serverLanguage();
  return (
    <html lang={language === "zh" ? "zh-CN" : language}>
      <body>
        <LanguageProvider initialLanguage={language}>
          <AppNav />
          <LocalStatsMigration />
          <main className="app-main">{children}</main>
        </LanguageProvider>
      </body>
    </html>
  );
}
