import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ThaliumX - Advanced Trading Platform",
  description: "Unified platform for modern trading with CEX + DEX aggregation, margin trading, and compliance",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <ErrorBoundary>
            <div className="p-4 flex justify-between items-center border-b">
              <div className="font-semibold">ThaliumX</div>
              <div className="flex gap-3 items-center">
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a className="text-sm underline" href="/portfolio">Portfolio</a>
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a className="text-sm underline" href="/auth?next=/dashboard">Login</a>
              </div>
            </div>
            <div className="p-4">{children}</div>
          </ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
