import { redirect } from "next/navigation";

import { getPlayerSessionToken } from "@/lib/auth/player";
import { getJoinEvent, resumePlayerSession } from "@/lib/game/service";
import { AppSurface, Badge, Panel, SectionHeading } from "@/components/ui";
import { RegisterPlayerForm } from "@/components/register-player-form";

export const dynamic = "force-dynamic";

export default async function JoinEventPage({
  params,
}: {
  params: { joinCode: string };
}) {
  const joinCode = params.joinCode.toUpperCase();
  const event = await getJoinEvent(joinCode);
  const sessionToken = getPlayerSessionToken();

  if (sessionToken) {
    try {
      await resumePlayerSession(event.slug, sessionToken);
      redirect(`/play/${event.slug}`);
    } catch {
      // Ignore stale sessions and continue to registration.
    }
  }

  return (
    <AppSurface className="flex items-center justify-center">
      <Panel className="w-full max-w-xl">
        <Badge tone="accent">Join {event.joinCode}</Badge>
        <div className="mt-4">
          <SectionHeading
            eyebrow="Player registration"
            title={event.title}
            description={
              event.status === "registration_open"
                ? "Enter your display name to join this event. Teams will be assigned when the admin starts the game."
                : "Registration is currently closed. If you already joined on this device, your existing session will resume automatically."
            }
          />
        </div>
        <RegisterPlayerForm joinCode={event.joinCode} disabled={event.status !== "registration_open"} />
      </Panel>
    </AppSurface>
  );
}
