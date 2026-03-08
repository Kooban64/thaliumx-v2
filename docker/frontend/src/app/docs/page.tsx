export default function DocsPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Documentation</h1>
      <p className="text-muted-foreground">
        Welcome to the ThaliumX platform documentation.
      </p>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Getting Started</h2>
        <p className="text-sm text-muted-foreground">
          Learn how to get started with trading, staking, and other platform features.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">API Documentation</h2>
        <p className="text-sm text-muted-foreground">
          For API documentation, please refer to the Swagger documentation available at <code className="bg-muted px-1 rounded">/api/docs</code>.
        </p>
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
