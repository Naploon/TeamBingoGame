import { redirect } from "next/navigation";

import { PlayerApp } from "@/components/player-app";
import { AppSurface } from "@/components/ui";
import { getPlayerSessionToken } from "@/lib/auth/player";
import { getPlayerState } from "@/lib/game/service";

export const dynamic = "force-dynamic";

export default async function PlayPage({
  params,
}: {
  params: { slug: string };
}) {
  const sessionToken = getPlayerSessionToken();

  if (!sessionToken) {
    redirect("/");
  }

  const state = await getPlayerState(params.slug, sessionToken);

  return (
    <AppSurface>
      <PlayerApp slug={params.slug} initialState={state} />
    </AppSurface>
  );
}
