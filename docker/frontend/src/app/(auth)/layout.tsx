import { HeaderLogo } from '@/components/layout/HeaderLogo';
import { PublicAuthMenu } from '@/components/layout/PublicAuthMenu';
import Link from 'next/link';

/**
 * Auth Pages Layout (Login/Register)
 * Minimal header with logo and auth buttons, no AppFrame
 * Uses PublicAuthMenu to avoid API calls that cause 401 errors
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="sticky top-0 z-40 h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-4 md:px-6">
        <Link href="/landing">
          <HeaderLogo publicOnly={true} />
        </Link>
        <PublicAuthMenu />
      </header>
      <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>
    </>
  );
}
