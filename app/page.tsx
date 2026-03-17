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
          <Badge tone="accent">iPhone-first live game</Badge>
          <div className="mt-4">
            <SectionHeading
              eyebrow="Bingo Challenge"
              title="Run fast team competitions from one mobile web app"
              description="Players join with a code, get randomly assigned to teams, challenge each other across a shuffled 4x4 task board, and watch the leaderboard move in near real time."
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
            <p className="text-sm uppercase tracking-[0.24em] text-white/60">Join a live instance</p>
            <div className="mt-4">
              <JoinCodeForm />
            </div>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel>
            <SectionHeading
              eyebrow="How it works"
              title="Built for one organizer and up to 40 players"
              description="Admins prep the event on laptop. Players handle the game on their phones."
            />
            <div className="mt-6 space-y-3 text-sm text-ink/70">
              <p>1. Open registration and collect player names.</p>
              <p>2. Start the event to auto-generate teams, captains, and board order.</p>
              <p>3. Players challenge other teams, submit results, and race the leaderboard.</p>
            </div>
          </Panel>

          <Panel>
            <SectionHeading
              eyebrow="Organizer"
              title="Admin dashboard"
              description="Create the event, manage tasks, fix wrong results, and switch captains."
            />
            <div className="mt-6">
              <Link href="/admin">
                <Button tone="secondary">Open admin dashboard</Button>
              </Link>
            </div>
          </Panel>
        </div>
      </div>
    </AppSurface>
  );
}
