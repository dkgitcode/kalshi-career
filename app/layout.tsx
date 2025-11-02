import type { Metadata } from "next";
import { Geist_Mono, Inter, PT_Serif } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";

import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const ptSerif = PT_Serif({
  variable: "--font-pt-serif",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Kalshi Career Summary",
    template: "%s | Kalshi Career Summary",
  },
  description: "Career summary of Kalshi portfolio and trading history",
  authors: [{ name: "dk", url: "https://twitter.com/dkposts" }],
  creator: "dk",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${ptSerif.variable} ${geistMono.variable} ${inter.variable} antialiased`}>
        <div className="flex min-h-screen flex-col bg-background text-foreground">
          <main className="flex-1">{children}</main>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
