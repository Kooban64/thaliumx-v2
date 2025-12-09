'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">T</span>
            </div>
            <span className="text-xl font-bold">ThaliumX</span>
          </div>
          <nav className="hidden md:flex items-center space-x-4">
            <a href="#features" className="text-sm font-medium hover:text-primary">Features</a>
            <a href="#how" className="text-sm font-medium hover:text-primary">How it works</a>
            <a href="#contact" className="text-sm font-medium hover:text-primary">Contact</a>
          </nav>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" asChild>
              <a href="/auth">Sign In</a>
            </Button>
            <Button asChild>
              <a href="/dashboard">Launch App</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-20">
        <section className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            The unified platform for modern trading
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            CEX + DEX aggregation, margin, wallets, and compliance — built for brokers and power users.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="px-8" asChild>
              <a href="/dashboard">Launch Trading</a>
            </Button>
            <Button size="lg" variant="outline" className="px-8" asChild>
              <a href="/token-presale">Join Presale</a>
            </Button>
          </div>
        </section>

        <section id="features" className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Omni Exchange</CardTitle>
              <CardDescription>Smart routing across top CEX/DEX venues</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Bybit, KuCoin, OKX, Kraken, VALR, Bitstamp, Crypto.com</li>
                <li>• Liquidity-aware routing</li>
                <li>• Fund segregation (user/broker/platform)</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Advanced Margin</CardTitle>
              <CardDescription>User- and broker-level isolation built-in</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Cross/Isolated accounts</li>
                <li>• Real-time risk checks</li>
                <li>• Liquidation protections</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Observability</CardTitle>
              <CardDescription>OpenTelemetry, Prometheus, Grafana, Loki</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Traces, metrics, logs</li>
                <li>• Health dashboards</li>
                <li>• Alerting ready</li>
              </ul>
            </CardContent>
          </Card>
        </section>

        <section id="cta" className="mt-20 text-center">
          <h2 className="text-3xl font-bold">Ready to get started?</h2>
          <p className="mt-2 text-muted-foreground">Trade from any Web3 wallet or broker account.</p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild>
              <a href="/auth">Create Account</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/token-presale">Buy THAL</a>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t bg-background/95 mt-20">
        <div className="container mx-auto px-4 py-8 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">© 2025 ThaliumX</span>
          <div className="space-x-4 text-sm">
            <a href="/privacy" className="hover:text-primary">Privacy</a>
            <a href="/terms" className="hover:text-primary">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
