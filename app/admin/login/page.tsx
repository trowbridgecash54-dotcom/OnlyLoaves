import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Field, Flash, Save, param, type Search } from "@/components/admin/ui";
import { Wordmark } from "@/components/Wordmark";
import { checkAdmin } from "@/lib/admin/auth";

export const metadata: Metadata = {
  title: "Owner sign-in",
  robots: { index: false, follow: false },
};

const MESSAGES: Record<string, string> = {
  "not-authorized": "That account isn't authorized for this dashboard.",
};

export default async function LoginPage({ searchParams }: { searchParams: Search }) {
  const check = await checkAdmin();
  if (check.status === "ok") redirect("/admin");

  const error = await param(searchParams, "error");
  const ok = await param(searchParams, "ok");

  return (
    <main id="main" className="mx-auto flex min-h-screen w-full max-w-[26rem] flex-col justify-center px-5 py-16">
      <Link href="/" className="self-start">
        <Wordmark className="text-[2.5rem]" />
      </Link>
      <h1 className="type-title mt-8">Owner sign-in</h1>
      <p className="mb-8 mt-2 text-espresso/75">This area is for the bakery&apos;s owner.</p>

      <Flash ok={ok} error={error ? (MESSAGES[error] ?? error) : undefined} />

      {check.status === "not-configured" ? (
        <p className="border-l-2 border-terracotta-deep bg-paper px-5 py-4">
          The dashboard isn&apos;t connected to a database yet. Whoever set up the website
          needs to add the Supabase settings — see “Connect the database” in the README.
        </p>
      ) : (
        <form method="post" action="/admin/do/login" className="space-y-5">
          <Field label="Email" name="email" type="email" required autoComplete="username" />
          <Field
            label="Password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
          <Save>Sign in</Save>
        </form>
      )}

      <p className="type-small mt-10 text-espresso/70">
        There&apos;s no sign-up here. Owner accounts are created by whoever manages the
        website. Forgot your password? They can reset it for you.
      </p>
    </main>
  );
}
