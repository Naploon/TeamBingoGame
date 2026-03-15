import { AppError, renameTeam } from "@/lib/game/service";
import { PLAYER_SESSION_COOKIE } from "@/lib/auth/player";
import { jsonError, jsonOk } from "@/lib/http";

function readSessionToken(request: Request) {
  return (
    request.headers.get("cookie")
      ?.split(";")
      .map((chunk) => chunk.trim())
      .find((chunk) => chunk.startsWith(`${PLAYER_SESSION_COOKIE}=`))
      ?.split("=")[1] ?? null
  );
}

export async function POST(
  request: Request,
  { params }: { params: { slug: string } },
) {
  const sessionToken = readSessionToken(request);

  if (!sessionToken) {
    return jsonError(new AppError("Unauthorized", 401));
  }

  try {
    const body = await request.json();
    const team = await renameTeam(params.slug, sessionToken, body);
    return jsonOk({ team });
  } catch (error) {
    return jsonError(error);
  }
}
