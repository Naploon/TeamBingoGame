import { AppError, getPlayerState } from "@/lib/game/service";
import { PLAYER_SESSION_COOKIE } from "@/lib/auth/player";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(
  request: Request,
  { params }: { params: { slug: string } },
) {
  const sessionToken =
    request.headers.get("cookie")
      ?.split(";")
      .map((chunk) => chunk.trim())
      .find((chunk) => chunk.startsWith(`${PLAYER_SESSION_COOKIE}=`))
      ?.split("=")[1] ?? null;

  if (!sessionToken) {
    return jsonError(new AppError("Unauthorized", 401));
  }

  try {
    const state = await getPlayerState(params.slug, sessionToken);
    return jsonOk(state);
  } catch (error) {
    return jsonError(error);
  }
}
