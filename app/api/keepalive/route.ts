import { isBackendConfigured, publicDb } from "@/lib/backend";

/**
 * Keep-awake check, called once a day by Vercel Cron (see vercel.json).
 *
 * Supabase's free plan pauses a project after a week of low database
 * activity. This route makes one tiny read (the public Club plan, which
 * any visitor can already see), so the database always has activity even
 * in a quiet week. It reads nothing private and changes nothing.
 *
 * If CRON_SECRET is set in Vercel, only requests carrying it (which Vercel
 * Cron sends automatically) are accepted. Without it, the route is public,
 * which is harmless: it does the same read as loading the Club page.
 */
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401, headers: noStore });
  }
  if (!isBackendConfigured()) {
    return Response.json({ ok: false, error: "database_not_configured" }, { status: 503, headers: noStore });
  }
  try {
    await publicDb().select("subscription_plans", { limit: 1 });
    return Response.json({ ok: true, checkedAt: new Date().toISOString() }, { headers: noStore });
  } catch {
    return Response.json({ ok: false, error: "database_unreachable" }, { status: 503, headers: noStore });
  }
}
