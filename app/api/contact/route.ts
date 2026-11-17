import { handleContactRequest } from "@/lib/handlers";
import { formDeps } from "@/lib/wiring";

export async function POST(request: Request) {
  return handleContactRequest(request, await formDeps());
}
