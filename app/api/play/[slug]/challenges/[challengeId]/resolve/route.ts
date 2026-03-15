import { AppError, resolveChallenge } from "@/lib/game/service";
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
  { params }: { params: { slug: string; challengeId: string } },
) {
  const sessionToken = readSessionToken(request);

  if (!sessionToken) {
    return jsonError(new AppError("Unauthorized", 401));
  }

  try {
    const body = await request.json();
    const challenge = await resolveChallenge(params.slug, sessionToken, params.challengeId, body);
    return jsonOk({ challenge });
  } catch (error) {
    return jsonError(error);
  }
}
