import { NextResponse } from "next/server";

import { PLAYER_SESSION_COOKIE } from "@/lib/auth/player";
import { jsonError } from "@/lib/http";
import { registerPlayer } from "@/lib/game/service";

export async function POST(
  request: Request,
  { params }: { params: { joinCode: string } },
) {
  try {
    const body = await request.json();
    const result = await registerPlayer(params.joinCode.toUpperCase(), body);
    const response = NextResponse.json({
      redirectTo: `/play/${result.eventSlug}`,
    });

    response.cookies.set(PLAYER_SESSION_COOKIE, result.sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });

    return response;
  } catch (error) {
    return jsonError(error);
  }
}
