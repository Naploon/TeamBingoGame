import { getAdminUser } from "@/lib/auth/admin";
import { AppError, createTask } from "@/lib/game/service";
import { jsonError, jsonOk } from "@/lib/http";

export async function POST(
  request: Request,
  { params }: { params: { slug: string } },
) {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return jsonError(new AppError("Unauthorized", 401));
  }

  try {
    const body = await request.json();
    const task = await createTask(params.slug, body, adminUser.email ?? adminUser.id);
    return jsonOk({ task });
  } catch (error) {
    return jsonError(error);
  }
}
