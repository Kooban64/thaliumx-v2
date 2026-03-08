export default function FeaturesPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Platform Features</h1>
      <p className="text-muted-foreground">
        Discover the comprehensive features available on the ThaliumX platform.
      </p>

      <section className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Trading</h2>
          <p className="text-sm text-muted-foreground">
            Spot trading, margin trading, futures, and options. Access multiple exchanges through our unified interface.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Decentralized Exchange (DEX)</h2>
          <p className="text-sm text-muted-foreground">
            Trade directly on-chain with our integrated DEX. Swap tokens with minimal slippage and competitive fees.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold">NFT Marketplace</h2>
          <p className="text-sm text-muted-foreground">
            Buy, sell, and trade NFTs. Create collections and manage your digital assets.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Staking</h2>
          <p className="text-sm text-muted-foreground">
            Stake your tokens to earn rewards. Multiple staking pools with flexible terms.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Token Presale</h2>
          <p className="text-sm text-muted-foreground">
            Participate in token presales with secure vesting schedules and compliance features.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Wallet Management</h2>
          <p className="text-sm text-muted-foreground">
            Hot wallets, Web3 wallet integration, and fiat on/off ramps. Complete wallet solution for all your needs.
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Contact</h2>
        <p className="text-sm text-muted-foreground">
          Questions: <a className="underline" href="mailto:support@thaliumx.com">support@thaliumx.com</a>
        </p>
      </section>
    </div>
  );
}
