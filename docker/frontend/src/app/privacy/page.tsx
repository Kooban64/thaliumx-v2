export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="text-muted-foreground">
        This is a placeholder Privacy Policy page for the ThaliumX platform.
      </p>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Overview</h2>
        <p className="text-sm text-muted-foreground">
          We collect and process data necessary to operate the platform, comply with regulatory
          requirements, and protect users from fraud and abuse.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Contact</h2>
        <p className="text-sm text-muted-foreground">
          Questions: <a className="underline" href="mailto:privacy@thaliumx.com">privacy@thaliumx.com</a>
        </p>
      </section>
    </div>
  );
}

