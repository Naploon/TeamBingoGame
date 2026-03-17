"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";

import { Badge, Button, Input, JoinCodeBadge, Panel, SectionHeading } from "@/components/ui";
import type { listEvents } from "@/lib/game/service";

type AdminEvents = Awaited<ReturnType<typeof listEvents>>;

export function AdminIndex({ initialEvents }: { initialEvents: AdminEvents }) {
  const [events, setEvents] = useState(initialEvents);
  const [title, setTitle] = useState("");
  const [targetTeamSize, setTargetTeamSize] = useState("4");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          targetTeamSize: Number(targetTeamSize),
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not create event.");
      }

      setMessage("Event created.");
      setEvents((current) => [payload.event, ...current]);
      window.location.href = `/admin/events/${payload.event.slug}`;
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Create event failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Panel>
        <SectionHeading
          eyebrow="Admin"
          title="Create a new bingo challenge"
          description="Spin up an event, set the target team size, then open registration when the task deck is ready."
        />
        <form className="mt-6 grid gap-3 sm:grid-cols-[1fr_180px_auto]" onSubmit={handleSubmit}>
          <Input
            placeholder="Spring challenge night"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
          <Input
            type="number"
            min={1}
            max={10}
            value={targetTeamSize}
            onChange={(event) => setTargetTeamSize(event.target.value)}
            required
          />
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create event"}
          </Button>
        </form>
        {message ? <p className="mt-3 text-sm text-sea">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-coral">{error}</p> : null}
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        {events.map((event) => (
          <Link key={event.id} href={`/admin/events/${event.slug}`}>
            <Panel className="h-full transition hover:-translate-y-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-ink">{event.title}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink/60">
                    <span>Join code</span>
                    <JoinCodeBadge code={event.joinCode} />
                  </div>
                </div>
                <Badge tone={event.status === "live" ? "accent" : "default"}>
                  {event.status.replace("_", " ")}
                </Badge>
              </div>
              <p className="mt-4 text-sm text-ink/60">
                Team size target {event.targetTeamSize}
              </p>
            </Panel>
          </Link>
        ))}
      </div>
    </div>
  );
}
