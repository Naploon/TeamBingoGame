import { cookies } from "next/headers";

export const PLAYER_SESSION_COOKIE = "bingo_player_session";

export function getPlayerSessionToken() {
  return cookies().get(PLAYER_SESSION_COOKIE)?.value ?? null;
}

export function setPlayerSessionToken(token: string) {
  cookies().set(PLAYER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export function clearPlayerSessionToken() {
  cookies().delete(PLAYER_SESSION_COOKIE);
}
