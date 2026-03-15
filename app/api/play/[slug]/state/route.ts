import { getPlayerAuthUser } from "@/lib/auth/player";
import { AppError, getPlayerState } from "@/lib/game/service";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } },
) {
  const playerUser = await getPlayerAuthUser();

  if (!playerUser) {
    return jsonError(new AppError("Unauthorized", 401));
  }

  try {
    const state = await getPlayerState(params.slug, playerUser.id);
    return jsonOk(state);
  } catch (error) {
    return jsonError(error);
  }
}
