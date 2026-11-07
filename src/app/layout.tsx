import type { Metadata } from "next";
import { Allura, Bodoni_Moda, Jost } from "next/font/google";
import "./globals.css";

const bodoni = Bodoni_Moda({ subsets: ["latin"], variable: "--font-bodoni", style: ["normal", "italic"] });
const jost = Jost({ subsets: ["latin"], variable: "--font-jost" });
const allura = Allura({ subsets: ["latin"], weight: "400", variable: "--font-allura" });

export const metadata: Metadata = {
  title: "Kitty — the AI treasurer for group trips",
  description:
    "An AI agent that collects, holds and spends a group's shared money through PayPal — inside a mandate the group signs and votes on.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${bodoni.variable} ${jost.variable} ${allura.variable} antialiased`}>{children}</body>
    </html>
  );
}
