import { canAdminSignIn } from "@/lib/auth/admin";
import { AppError } from "@/lib/game/service";
import { jsonError, jsonOk } from "@/lib/http";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: unknown };

    if (typeof body.email !== "string" || !body.email.trim()) {
      throw new AppError("Email is required.");
    }

    const allowed = await canAdminSignIn(body.email);

    if (!allowed) {
      throw new AppError("This admin account is not enabled.", 401);
    }

    return jsonOk({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
