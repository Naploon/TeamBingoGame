import { getAdminUser } from "@/lib/auth/admin";
import { AppError, saveTaskAsTemplate } from "@/lib/game/service";
import { jsonError, jsonOk } from "@/lib/http";

export async function POST(
  request: Request,
  { params }: { params: { slug: string; taskId: string } },
) {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return jsonError(new AppError("Unauthorized", 401));
  }

  try {
    const body = await request.json().catch(() => ({}));
    const template = await saveTaskAsTemplate(
      params.slug,
      params.taskId,
      adminUser.email ?? adminUser.id,
      typeof body.title === "string" ? body.title : undefined,
    );
    return jsonOk({ template });
  } catch (error) {
    return jsonError(error);
  }
}
