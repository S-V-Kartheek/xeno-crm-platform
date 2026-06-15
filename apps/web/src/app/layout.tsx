import type { Metadata } from "next";
import "./globals.css";
import TopNav from "@/components/TopNav";

export const metadata: Metadata = {
  title: "SmartCRM — AI-native D2C CRM",
  description: "AI-native mini CRM for D2C fashion shopper engagement by Xeno"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <TopNav />
        <main className="page-content">
          {children}
        </main>
      </body>
    </html>
  );
}
