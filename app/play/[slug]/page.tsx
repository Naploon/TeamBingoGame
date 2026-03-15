import { redirect } from "next/navigation";

import { PlayerApp } from "@/components/player-app";
import { AppSurface } from "@/components/ui";
import { getPlayerAuthUser } from "@/lib/auth/player";
import { AppError, getPlayerState } from "@/lib/game/service";

export const dynamic = "force-dynamic";

export default async function PlayPage({
  params,
}: {
  params: { slug: string };
}) {
  const playerUser = await getPlayerAuthUser();

  if (!playerUser) {
    redirect("/?notice=session-expired");
  }

  const state = await (async () => {
    try {
      return await getPlayerState(params.slug, playerUser.id);
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 401) {
        redirect("/?notice=session-expired");
      }

      throw error;
    }
  })();

  return (
    <AppSurface>
      <PlayerApp slug={params.slug} initialState={state} />
    </AppSurface>
  );
}
