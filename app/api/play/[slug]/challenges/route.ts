import { getPlayerAuthUser } from "@/lib/auth/player";
import { AppError, createChallenge } from "@/lib/game/service";
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
    const challenge = await createChallenge(params.slug, playerUser.id, body);
    return jsonOk({ challenge });
  } catch (error) {
    return jsonError(error);
  }
}
