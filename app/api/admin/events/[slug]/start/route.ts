import { getAdminUser } from "@/lib/auth/admin";
import { AppError, startGame } from "@/lib/game/service";
import { jsonError, jsonOk } from "@/lib/http";

export async function POST(
  _request: Request,
  { params }: { params: { slug: string } },
) {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return jsonError(new AppError("Unauthorized", 401));
  }

  try {
    const event = await startGame(params.slug, adminUser.email ?? adminUser.id);
    return jsonOk({ event });
  } catch (error) {
    return jsonError(error);
  }
}
