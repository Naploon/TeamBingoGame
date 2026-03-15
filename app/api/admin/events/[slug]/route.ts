import { getAdminUser } from "@/lib/auth/admin";
import { AppError, openRegistration, updateEvent } from "@/lib/game/service";
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

    if (body.action === "open_registration") {
      const event = await openRegistration(params.slug, adminUser.email ?? adminUser.id);
      return jsonOk({ event });
    }

    if (body.action === "update_event") {
      const event = await updateEvent(
        params.slug,
        {
          title: body.title,
          targetTeamSize: body.targetTeamSize,
        },
        adminUser.email ?? adminUser.id,
      );
      return jsonOk({ event });
    }

    throw new AppError("Unknown admin action.");
  } catch (error) {
    return jsonError(error);
  }
}
