import { getAdminUser } from "@/lib/auth/admin";
import { AppError, overrideChallenge } from "@/lib/game/service";
import { jsonError, jsonOk } from "@/lib/http";

export async function POST(
  request: Request,
  { params }: { params: { slug: string; challengeId: string } },
) {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return jsonError(new AppError("Unauthorized", 401));
  }

  try {
    const body = await request.json();
    const challenge = await overrideChallenge(
      params.slug,
      params.challengeId,
      body,
      adminUser.email ?? adminUser.id,
    );
    return jsonOk({ challenge });
  } catch (error) {
    return jsonError(error);
  }
}
