import Link from "next/link";

import { JoinCodeForm } from "@/components/join-code-form";
import { PlayerSignOutButton } from "@/components/player-sign-out-button";
import { AppSurface, Badge, Button, JoinCodeBadge, Panel, SectionHeading } from "@/components/ui";
import { getPlayerAuthUser } from "@/lib/auth/player";
import { getLandingPlayerRegistration } from "@/lib/game/service";

export const dynamic = "force-dynamic";

function getResumeDescription(
  status: "draft" | "registration_open" | "live" | "ended",
  teamName: string | null,
) {
  if (status === "live" && teamName) {
    return `${teamName} is already active. Open the event and continue playing.`;
  }

  if (status === "live") {
    return "The game is live. Open the event to see your team and board.";
  }

  if (status === "ended") {
    return "The event has ended, but this account can still open the final standings.";
  }

  return "You are already registered with this player account. Open it to keep the same event state.";
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: { notice?: string | string[] };
}) {
  const playerUser = await getPlayerAuthUser();
  const returningRegistration = playerUser
    ? await getLandingPlayerRegistration(playerUser.id)
    : null;
  const notice = Array.isArray(searchParams?.notice)
    ? searchParams?.notice[0]
    : searchParams?.notice;
  const showSessionNotice = notice === "session-expired";

  return (
    <AppSurface className="flex items-center">
      <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Panel className="overflow-hidden bg-gradient-to-br from-white via-white to-sand/50">
          <Badge tone="accent">Player-first mobile flow</Badge>
          <div className="mt-4">
            <SectionHeading
              eyebrow="Bingo Challenge"
              title="Join fast, play from your phone, and jump back in without friction"
              description="Enter a join code, sign in once, and keep the same player state for the whole event. When the game goes live, your team, board, and challenge flow are all in one mobile screen."
            />
          </div>
          {showSessionNotice ? (
            <p className="mt-6 rounded-[1.6rem] bg-coral/12 px-4 py-3 text-sm text-coral">
              Your player login is no longer active. Sign in again to continue.
            </p>
          ) : null}
          {returningRegistration ? (
            <div className="mt-6 rounded-[2rem] border border-white/10 bg-ink p-6 text-white">
              <p className="text-sm uppercase tracking-[0.24em] text-white/60">Saved player account</p>
              <p className="mt-3 text-2xl font-semibold">{returningRegistration.event.title}</p>
              <p className="mt-2 text-sm text-white/75">
                Continue as {returningRegistration.player.displayName}.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/75">
                <span>Join code</span>
                <JoinCodeBadge code={returningRegistration.event.joinCode} />
              </div>
              {playerUser?.email ? <p className="mt-2 text-sm text-white/60">{playerUser.email}</p> : null}
              <p className="mt-3 text-sm text-white/75">
                {getResumeDescription(
                  returningRegistration.event.status,
                  returningRegistration.team?.name ?? null,
                )}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href={`/play/${returningRegistration.event.slug}`}>
                  <Button tone="secondary">Continue where you left off</Button>
                </Link>
                <PlayerSignOutButton redirectTo="/" tone="ghost" />
              </div>
            </div>
          ) : null}
          <div className="mt-8 rounded-[2rem] bg-ink p-6 text-white">
            <p className="text-sm uppercase tracking-[0.24em] text-white/60">Join a live event</p>
            <p className="mt-3 max-w-xl text-sm text-white/75">
              Use the six-character code from the organizer. The same player account brings you back to the right team and event if you leave and return later.
            </p>
            <div className="mt-4">
              <JoinCodeForm />
            </div>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel>
            <SectionHeading
              eyebrow="Player flow"
              title="Built so the phone experience stays clear under pressure"
              description="The organizer sets things up once. Players join, lock the team name, follow live challenges, and finish with a recap built for mobile."
            />
            <div className="mt-6 space-y-3 text-sm text-ink/70">
              <p>1. Enter the join code and sign in with one player account.</p>
              <p>2. Wait for your team, then follow the next action card when the game starts.</p>
              <p>3. Open tasks, pick opponents, submit results, and track the final recap.</p>
            </div>
          </Panel>

          <Panel className="bg-white/75">
            <SectionHeading
              eyebrow="Organizer tools"
              title="Admin dashboard"
              description="Use this only if you are running the event and need the organizer controls."
            />
            <div className="mt-6">
              <Link href="/admin">
                <Button tone="ghost">Open admin dashboard</Button>
              </Link>
            </div>
          </Panel>
        </div>
      </div>
    </AppSurface>
  );
}
