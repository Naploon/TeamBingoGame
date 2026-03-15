import { getAdminUser } from "@/lib/auth/admin";
import { AppError } from "@/lib/game/service";
import { jsonError, jsonOk } from "@/lib/http";
import { createEvent } from "@/lib/game/service";

export async function POST(request: Request) {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return jsonError(new AppError("Unauthorized", 401));
  }

  try {
    const body = await request.json();
    const event = await createEvent(body);
    return jsonOk({ event });
  } catch (error) {
    return jsonError(error);
  }
}
