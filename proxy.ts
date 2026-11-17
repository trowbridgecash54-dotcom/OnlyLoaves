import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs in front of every /admin request (Next.js 16 "proxy", formerly
 * "middleware"). Two jobs:
 *
 *  1. Keep the owner's Supabase session fresh, so she isn't signed out
 *     mid-task when the short-lived token expires.
 *  2. Send anyone who isn't signed in to the login page before any
 *     dashboard page starts rendering.
 *
 * This is a convenience layer, not the security boundary. Every admin
 * page and every admin action checks the session and the admins table
 * again on the server (lib/admin/auth.ts), and the database enforces
 * the same rule with row-level security.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  ).trim();
  // No database connected: let the login page explain what's missing.
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() validates the token with Supabase Auth and refreshes it if needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/admin/login";
  const isAction = pathname.startsWith("/admin/do/");

  if (!user && !isLogin && !isAction) {
    const login = request.nextUrl.clone();
    login.pathname = "/admin/login";
    login.search = "";
    const redirect = NextResponse.redirect(login);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  // Dashboard pages hold customer details: never cache them anywhere.
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
