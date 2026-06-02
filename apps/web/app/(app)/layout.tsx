"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Trophy,
  Swords,
  User,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// =============================================================================
// APP LAYOUT
// =============================================================================
// The main shell for all authenticated pages.
//
// Responsibilities:
//   1. Redirects to /login if the user is not authenticated
//   2. Renders a sidebar on desktop (md+) with navigation links
//   3. Renders a bottom tab bar on mobile
//   4. Renders the page content in the main area
//
// The active route is highlighted in the navigation using usePathname().
// =============================================================================

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Tournaments",
    href: "/tournaments",
    icon: Trophy,
  },
  {
    label: "Challenges",
    href: "/challenges",
    icon: Swords,
  },
  {
    label: "Profile",
    href: "/profile",
    icon: User,
  },
];

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { player, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !player) {
      router.replace("/login");
    }
  }, [player, isLoading, router]);

  // Show nothing while checking auth to avoid flash of content
  if (isLoading) return null;
  if (!player) return null;

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <TooltipProvider>
      <div className="flex min-h-screen">
        {/* ----------------------------------------------------------------
            SIDEBAR — visible on md+ screens
        ---------------------------------------------------------------- */}
        <aside className="hidden md:flex flex-col w-16 lg:w-56 border-r bg-card shrink-0">
          {/* App name */}
          <div className="h-16 flex items-center px-4 border-b shrink-0">
            <span className="text-xl">🎱</span>
            <span className="ml-2 font-bold text-lg hidden lg:block">
              Cue Cup
            </span>
          </div>

          {/* Nav links */}
          <nav className="flex-1 py-4 px-2 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Tooltip key={item.href} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className="hidden lg:block">{item.label}</span>
                    </Link>
                  </TooltipTrigger>
                  {/* Show tooltip only on collapsed sidebar (md, not lg) */}
                  <TooltipContent side="right" className="lg:hidden">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          {/* Player info + logout */}
          <div className="border-t p-2">
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">
                  {player.nickname[0]?.toUpperCase()}
                </span>
              </div>
              <span className="text-sm font-medium hidden lg:block truncate">
                {player.nickname}
              </span>
            </div>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span className="hidden lg:block">Logout</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="lg:hidden">
                Logout
              </TooltipContent>
            </Tooltip>
          </div>
        </aside>

        {/* ----------------------------------------------------------------
            MAIN CONTENT
        ---------------------------------------------------------------- */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Page content */}
          <div className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
            {children}
          </div>
        </main>

        {/* ----------------------------------------------------------------
            BOTTOM TAB BAR — visible on mobile only
        ---------------------------------------------------------------- */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-card z-50">
          <div className="flex items-center justify-around h-16">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-1 px-4 py-2 text-xs font-medium transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </TooltipProvider>
  );
}
