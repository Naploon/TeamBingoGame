import { getPlayerAuthUser } from "@/lib/auth/player";
import { AppError, renameTeam } from "@/lib/game/service";
import { jsonError, jsonOk } from "@/lib/http";

export async function POST(
  request: Request,
  { params }: { params: { slug: string } },
) {
  const playerUser = await getPlayerAuthUser();

  if (!playerUser) {
    return jsonError(new AppError("Unauthorized", 401));
  }

  try {
    const body = await request.json();
    const team = await renameTeam(params.slug, playerUser.id, body);
    return jsonOk({ team });
  } catch (error) {
    return jsonError(error);
  }
}
