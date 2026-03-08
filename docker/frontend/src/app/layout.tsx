import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GlobalErrorHandler } from "@/components/GlobalErrorHandler";
import { Providers } from "./providers";
import { PolicyViolationAlertContainer } from "@/components/opa/PolicyViolationAlertContainer";
import { AppFrame } from "@/components/layout/AppFrame";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppFooter } from "@/components/layout/AppFooter";
import { CommandPalette } from "@/components/navigation/CommandPalette";
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
        <GlobalErrorHandler />
        <Providers>
          <ErrorBoundary>
            <AppFrame>
              <AppHeader />
              <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 min-h-0">
                <div className="max-w-7xl mx-auto w-full">
                  {children}
                </div>
              </main>
              <AppFooter />
            </AppFrame>
            <CommandPalette />
            <PolicyViolationAlertContainer />
          </ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
