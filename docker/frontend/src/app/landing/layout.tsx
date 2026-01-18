import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { ChatWidget } from '@/components/support/ChatWidget';

/**
 * Landing Page Layout
 * Overrides root layout to use public header/footer without AppFrame
 */
export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <PublicHeader />
      <main>{children}</main>
      <PublicFooter />
      <ChatWidget isPublic={true} />
    </>
  );
}
