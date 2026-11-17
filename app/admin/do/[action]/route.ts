import { runAdminAction } from "@/lib/admin/http";
import { adminDeps } from "@/lib/wiring";

/**
 * Receives every form the dashboard submits. All checks — same-origin,
 * session, administrator, and the action itself — live in lib/admin.
 */
export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  return runAdminAction(request, action, adminDeps());
}
