import Link from "next/link";

import { JoinCodeForm } from "@/components/join-code-form";
import { AppSurface, Badge, Button, Panel, SectionHeading } from "@/components/ui";

export default function HomePage() {
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
