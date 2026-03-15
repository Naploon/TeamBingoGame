import { getAdminUser } from "@/lib/auth/admin";
import { AppError, removePlayerRegistration } from "@/lib/game/service";
import { jsonError, jsonOk } from "@/lib/http";

export async function DELETE(
  _request: Request,
  { params }: { params: { slug: string; playerId: string } },
) {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return jsonError(new AppError("Unauthorized", 401));
  }

  try {
    const result = await removePlayerRegistration(
      params.slug,
      params.playerId,
      adminUser.email ?? adminUser.id,
    );

    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
