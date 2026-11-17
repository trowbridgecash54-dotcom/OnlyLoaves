import { handleClubRequest } from "@/lib/handlers";
import { formDeps } from "@/lib/wiring";

export async function POST(request: Request) {
  return handleClubRequest(request, await formDeps());
}
