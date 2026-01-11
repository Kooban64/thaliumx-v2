import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Providers } from "./providers";
import { ChatWidget } from "@/components/support/ChatWidget";
import { PolicyViolationAlertContainer } from "@/components/opa/PolicyViolationAlertContainer";
import { AppFrame } from "@/components/layout/AppFrame";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppFooter } from "@/components/layout/AppFooter";
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <ErrorBoundary>
            <AppFrame>
              <AppHeader />
              <main className="flex-1 overflow-auto p-4 md:p-6">
                {children}
              </main>
              <AppFooter />
            </AppFrame>
            <ChatWidget />
            <PolicyViolationAlertContainer />
          </ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
