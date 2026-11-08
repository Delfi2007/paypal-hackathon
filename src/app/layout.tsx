import type { Metadata } from "next";
import { Inter_Tight, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const tight = Inter_Tight({ subsets: ["latin"], variable: "--font-tight", weight: ["300", "400", "500", "600", "700"] });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });

export const metadata: Metadata = {
  title: "Kitty — the AI treasurer for group money",
  description:
    "An AI agent that collects, holds and spends a group's shared money through PayPal — inside a mandate the group signs and votes on.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${tight.variable} ${jakarta.variable} antialiased`}>{children}</body>
    </html>
  );
}
