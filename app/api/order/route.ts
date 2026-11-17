import { handleOrderRequest } from "@/lib/handlers";
import { formDeps } from "@/lib/wiring";

export async function POST(request: Request) {
  return handleOrderRequest(request, await formDeps());
}
