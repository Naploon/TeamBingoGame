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
    return `${teamName} is already in motion. Open the event and jump straight back in.`;
  }

  if (status === "live") {
    return "The game is already humming. Open the event to see where your team is waiting for you.";
  }

  if (status === "ended") {
    return "The game is over, but this account can still peek at the final standings and awards.";
  }

  return "This player account is already registered. Open the event and pick up from the very same game state.";
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
          <Badge tone="accent">Mobile-ready player flow</Badge>
          <div className="mt-4">
            <SectionHeading
              eyebrow="Bingo Challenge"
              title="Join with a code, play from your phone, and hop right back in when the action starts humming"
              description="Enter the six-character code from the organizer, sign in once, and let the game remember your team, board, and next move. When things go live, everything you need sits on one tidy phone screen."
            />
          </div>
          {showSessionNotice ? (
            <p className="mt-6 rounded-[1.6rem] bg-coral/12 px-4 py-3 text-sm text-coral">
              Your player session drifted off. Sign in again and hop back into the game.
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
                  <Button tone="secondary">Jump back in</Button>
                </Link>
                <PlayerSignOutButton redirectTo="/" tone="ghost" />
              </div>
            </div>
          ) : null}
          <div className="mt-8 rounded-[2rem] bg-ink p-6 text-white">
            <p className="text-sm uppercase tracking-[0.24em] text-white/60">Step into the game</p>
            <p className="mt-3 max-w-xl text-sm text-white/75">
              Use the six-character code from the organizer. The same player account brings you back to the right team, board, and bit of chaos if you leave and return later.
            </p>
            <div className="mt-4">
              <JoinCodeForm />
            </div>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel>
            <SectionHeading
              eyebrow="How it works"
              title="A quick tour before the bingo mischief begins"
              description="The organizer sets the stage once. After that, your phone nudges you from join code to team setup to live challenges and the final recap."
            />
            <div className="mt-6 space-y-3 text-sm text-ink/70">
              <p>1. Enter the game code and sign in with one player account.</p>
              <p>2. Wait for your team, then lock in your team name with your captain.</p>
              <p>3. Open tasks, pick opponents, submit results, and chase gold or diamond progress.</p>
              <p>4. When the game wraps up, enjoy the recap, awards, and final leaderboard.</p>
            </div>
          </Panel>

          <Panel className="bg-white/75">
            <SectionHeading
              eyebrow="Organizer corner"
              title="Admin dashboard"
              description="Open this only if you are the one conducting the whole bingo orchestra."
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
