'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to landing page
    router.push('/landing');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
      <div className="text-center">
        <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center mx-auto mb-4">
          <span className="text-primary-foreground font-bold text-2xl">T</span>
        </div>
        <h1 className="text-2xl font-bold mb-2">ThaliumX</h1>
        <p className="text-muted-foreground">Redirecting...</p>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mt-4"></div>
      </div>
    </div>
  );
}