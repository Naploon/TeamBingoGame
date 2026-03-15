import { getAdminUser } from "@/lib/auth/admin";
import { AppError, getAdminEventState } from "@/lib/game/service";
import { jsonError, jsonOk } from "@/lib/http";

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } },
) {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return jsonError(new AppError("Unauthorized", 401));
  }

  try {
    const state = await getAdminEventState(params.slug);
    return jsonOk(state);
  } catch (error) {
    return jsonError(error);
  }
}
