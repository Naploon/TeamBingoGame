import Link from "next/link";
import { redirect } from "next/navigation";

import { JoinCodeForm } from "@/components/join-code-form";
import { PlayerAuthForm } from "@/components/player-auth-form";
import { PlayerSignOutButton } from "@/components/player-sign-out-button";
import { Button } from "@/components/ui";
import { getPlayerAuthUser } from "@/lib/auth/player";
import { AppError, getJoinEvent, resumePlayerRegistration } from "@/lib/game/service";
import { AppSurface, Badge, Panel, SectionHeading } from "@/components/ui";
import { RegisterPlayerForm } from "@/components/register-player-form";

export const dynamic = "force-dynamic";

export default async function JoinEventPage({
  params,
}: {
  params: { joinCode: string };
}) {
  const joinCode = params.joinCode.toUpperCase();
  const event = await (async () => {
    try {
      return await getJoinEvent(joinCode);
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 404) {
        return null;
      }

      throw error;
    }
  })();

  if (!event) {
    return (
      <AppSurface className="flex items-center justify-center">
        <Panel className="w-full max-w-xl">
          <Badge tone="danger">Code not found</Badge>
          <div className="mt-4">
            <SectionHeading
              eyebrow="Join event"
              title={`We couldn't find ${joinCode}`}
              description="Check the code with the organizer and try again. If the game was just created, make sure you received the latest join code."
            />
          </div>
          <div className="mt-6 rounded-[1.75rem] bg-ink/5 p-4">
            <JoinCodeForm initialJoinCode={joinCode} submitLabel="Try another code" />
          </div>
          <div className="mt-4">
            <Link href="/">
              <Button tone="ghost">Back to home</Button>
            </Link>
          </div>
        </Panel>
      </AppSurface>
    );
  }

  const playerUser = await getPlayerAuthUser();

  if (playerUser) {
    try {
      await resumePlayerRegistration(event.slug, playerUser.id);
      redirect(`/play/${event.slug}`);
    } catch (error) {
      if (!(error instanceof AppError) || error.statusCode !== 401) {
        throw error;
      }
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
              playerUser
                ? event.status === "registration_open"
                  ? "You are signed in. Finish this event registration with the display name other teams will see."
                  : "Registration is closed. If this account joined earlier, you would be sent straight back into the event."
                : event.status === "registration_open"
                  ? "Create a player account or sign in with email and password. Once you're back, the same account restores your event state."
                  : "Registration is closed. Sign in with the player account you used earlier to resume this event."
            }
          />
        </div>
        {playerUser ? (
          <>
            <div className="mt-6 rounded-[1.75rem] bg-ink/5 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-ink/50">Signed in as</p>
              <p className="mt-2 font-semibold text-ink">{playerUser.email}</p>
            </div>
            {event.status === "registration_open" ? (
              <RegisterPlayerForm joinCode={event.joinCode} disabled={false} />
            ) : (
              <p className="mt-6 rounded-[1.6rem] bg-coral/10 px-4 py-3 text-sm text-coral">
                This account is not registered for the event. Ask the organizer to reopen registration or sign in with the account that joined earlier.
              </p>
            )}
            <div className="mt-4">
              <PlayerSignOutButton redirectTo={`/join/${event.joinCode}`} tone="ghost" />
            </div>
          </>
        ) : (
          <PlayerAuthForm
            joinCode={event.joinCode}
            registrationOpen={event.status === "registration_open"}
          />
        )}
      </Panel>
    </AppSurface>
  );
}
