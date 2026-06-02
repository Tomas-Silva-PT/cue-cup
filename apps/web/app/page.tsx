"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

// =============================================================================
// ROOT PAGE
// =============================================================================
// The app's entry point — immediately redirects based on auth status.
// Logged in → /dashboard
// Not logged in → /login
//
// Shows nothing while the auth status is being determined to avoid
// a flash of incorrect content.
// =============================================================================

export default function RootPage() {
  const { player, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      router.replace(player ? "/dashboard" : "/login");
    }
  }, [player, isLoading, router]);

  return null;
}
