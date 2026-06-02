import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "sonner";

// =============================================================================
// ROOT LAYOUT
// =============================================================================
// The outermost layout — wraps every page in the app.
//
// Responsibilities:
//   1. Sets the HTML lang attribute and document metadata
//   2. Loads and applies the global font
//   3. Wraps the entire app in AuthProvider so every page and component
//      can access the current player via useAuth()
//
// This is a Server Component — it runs on the server and never re-renders
// on the client. The AuthProvider inside it is a Client Component, which
// is fine — Next.js allows Client Components to be children of Server
// Components.
// =============================================================================

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Cue Cup",
    template: "%s | Cue Cup",
  },
  description: "Manage and track your billiard tournaments and challenges",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
        <Toaster richColors />
      </body>
    </html>
  );
}
