"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

// =============================================================================
// AUTH LAYOUT
// =============================================================================
// Wraps the login and register pages.
//
// Responsibilities:
//   1. Centers content on screen with a clean, minimal design
//   2. Redirects to /dashboard if the user is already logged in —
//      there's no reason to show the login page to an authenticated user
//
// This is a Client Component because it uses useAuth() and useRouter()
// which require client-side hooks.
// =============================================================================

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { player, isLoading } = useAuth();
  const router = useRouter();

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (!isLoading && player) {
      router.replace("/dashboard");
    }
  }, [player, isLoading, router]);

  // Show nothing while checking auth status to avoid flash of login page
  if (isLoading) return null;

  // If logged in, show nothing while redirect happens
  if (player) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        {/* Logo / App name */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">🎱 Cue Cup</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Manage your billiard tournaments and challenges
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
