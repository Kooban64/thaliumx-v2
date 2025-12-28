export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="text-muted-foreground">
        This is a placeholder Terms of Service page for the ThaliumX platform.
      </p>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Use of the Platform</h2>
        <p className="text-sm text-muted-foreground">
          By accessing the platform you agree to comply with applicable laws and platform policies.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Contact</h2>
        <p className="text-sm text-muted-foreground">
          Questions: <a className="underline" href="mailto:legal@thaliumx.com">legal@thaliumx.com</a>
        </p>
      </section>
    </div>
  );
}

