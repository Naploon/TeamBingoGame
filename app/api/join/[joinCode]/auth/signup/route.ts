import { z } from "zod";

import { AppError, getJoinEvent } from "@/lib/game/service";
import { jsonOk, jsonError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const createPlayerAccountSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(72),
});

function looksLikeExistingUserError(error: { message?: string; code?: string; status?: number }) {
  const message = error.message?.toLowerCase() ?? "";

  return (
    message.includes("already registered") ||
    message.includes("already been registered") ||
    message.includes("already exists") ||
    error.code === "email_exists" ||
    error.status === 422
  );
}

export async function POST(
  request: Request,
  { params }: { params: { joinCode: string } },
) {
  try {
    const event = await getJoinEvent(params.joinCode.toUpperCase());

    if (event.status !== "registration_open") {
      throw new AppError("Registration is closed for this event.");
    }

    const body = createPlayerAccountSchema.parse(await request.json());
    const normalizedEmail = body.email.toLowerCase();
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: body.password,
      email_confirm: true,
    });

    if (error) {
      if (looksLikeExistingUserError(error)) {
        const { data, error: listError } = await supabase.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });

        if (listError) {
          throw listError;
        }

        const existingUser = data.users.find(
          (user) => user.email?.toLowerCase() === normalizedEmail,
        );

        if (!existingUser) {
          throw new AppError("An account with this email already exists. Sign in instead.");
        }

        const { error: updateError } = await supabase.auth.admin.updateUserById(
          existingUser.id,
          {
            email_confirm: true,
          },
        );

        if (updateError) {
          throw updateError;
        }

        return jsonOk({
          message:
            "This account already exists. Email confirmation is already handled, so you can sign in right away.",
        });
      }

      throw error;
    }

    return jsonOk({
      message: "Account created. Email confirmation is skipped for now, so you can sign in right away.",
    });
  } catch (error) {
    return jsonError(error);
  }
}
