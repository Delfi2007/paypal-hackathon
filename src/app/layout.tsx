import type { Metadata, Viewport } from "next";
import { Inter_Tight, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import SwRegister from "@/components/SwRegister";

const tight = Inter_Tight({ subsets: ["latin"], variable: "--font-tight", weight: ["300", "400", "500", "600", "700"] });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: "Kitty — the AI treasurer for group money",
  applicationName: "Kitty",
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Kitty", statusBarStyle: "default" },
  description:
    "An AI agent that collects, holds and spends a group's shared money through PayPal — inside a mandate the group signs and votes on.",
};

export const viewport: Viewport = { themeColor: "#3b6cff" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${tight.variable} ${jakarta.variable} antialiased`}>{children}<SwRegister /></body>
    </html>
  );
}
