import { getPlayerAuthUser } from "@/lib/auth/player";
import { AppError, rateChallenge } from "@/lib/game/service";
import { jsonError, jsonOk } from "@/lib/http";

export async function POST(
  request: Request,
  { params }: { params: { slug: string; challengeId: string } },
) {
  const playerUser = await getPlayerAuthUser();

  if (!playerUser) {
    return jsonError(new AppError("Unauthorized", 401));
  }

  try {
    const body = await request.json();
    const rating = await rateChallenge(params.slug, playerUser.id, params.challengeId, body);
    return jsonOk({ rating });
  } catch (error) {
    return jsonError(error);
  }
}
