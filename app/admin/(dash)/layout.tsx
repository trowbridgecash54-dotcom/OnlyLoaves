import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin/client";
import { Wordmark } from "@/components/Wordmark";
import { requireAdmin } from "@/lib/admin/auth";

export const metadata: Metadata = {
  title: "Owner dashboard",
  robots: { index: false, follow: false },
};

/**
 * The frame around every dashboard page. Signing in is checked here and
 * again inside each page and each action — this layout is not the lock.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { email } = await requireAdmin();

  return (
    <div className="min-h-screen">
      <header className="border-b border-espresso/15 bg-paper">
        <div className="mx-auto w-full max-w-[72rem] px-5 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
            <Link href="/admin" className="flex min-h-11 items-center gap-3">
              <Wordmark className="text-[1.75rem]" />
              <span className="type-small text-espresso/70">Owner dashboard</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/" className="type-small underline underline-offset-4 hover:text-terracotta-deep">
                View website
              </Link>
              <form method="post" action="/admin/do/logout">
                <button
                  type="submit"
                  className="type-small min-h-11 underline underline-offset-4 hover:text-terracotta-deep"
                  title={`Signed in as ${email}`}
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
          <AdminNav />
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-[72rem] px-5 pb-24 pt-10 sm:px-8">
        {children}
      </main>
    </div>
  );
}
