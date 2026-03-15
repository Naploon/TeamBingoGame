import { getPlayerAuthUser } from "@/lib/auth/player";
import { AppError, registerPlayer } from "@/lib/game/service";
import { jsonError } from "@/lib/http";

export async function POST(
  request: Request,
  { params }: { params: { joinCode: string } },
) {
  const playerUser = await getPlayerAuthUser();
  if (!playerUser?.email) {
    return jsonError(new AppError("Unauthorized", 401));
  }

  try {
    const body = await request.json();
    const result = await registerPlayer(
      params.joinCode.toUpperCase(),
      {
        id: playerUser.id,
        email: playerUser.email,
      },
      body,
    );

    return Response.json({
      redirectTo: `/play/${result.eventSlug}`,
    });
  } catch (error) {
    return jsonError(error);
  }
}
