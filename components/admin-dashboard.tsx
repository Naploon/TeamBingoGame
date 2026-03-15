"use client";

import { useEffect, useState } from "react";

import { Badge, Button, Input, Panel, SectionHeading, Select, Textarea } from "@/components/ui";
import type { getAdminEventState } from "@/lib/game/service";

type AdminState = Awaited<ReturnType<typeof getAdminEventState>>;

export function AdminDashboard({
  slug,
  initialState,
}: {
  slug: string;
  initialState: AdminState;
}) {
  const [state, setState] = useState(initialState);
  const [eventTitle, setEventTitle] = useState(initialState.event.title);
  const [targetTeamSize, setTargetTeamSize] = useState(String(initialState.event.targetTeamSize));
  const [taskDraft, setTaskDraft] = useState({
    title: "",
    shortDescription: "",
    fullDescription: "",
    type: "competitive",
    isActive: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const response = await fetch(`/api/admin/events/${slug}/state`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Could not refresh admin dashboard.");
        }

        if (!cancelled) {
          setState(payload);
          setEventTitle(payload.event.title);
          setTargetTeamSize(String(payload.event.targetTeamSize));
        }
      } catch (refreshError) {
        if (!cancelled) {
          setError(refreshError instanceof Error ? refreshError.message : "Refresh failed.");
        }
      }
    }

    const interval = window.setInterval(refresh, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [slug]);

  async function refreshNow() {
    const response = await fetch(`/api/admin/events/${slug}/state`, {
      method: "GET",
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error ?? "Could not refresh admin state.");
    }
    setState(payload);
  }

  async function postJson(path: string, body: Record<string, unknown>, action: string) {
    setBusyAction(action);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Request failed.");
      }

      setMessage("Saved.");
      await refreshNow();
      return payload;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Request failed.");
      throw requestError;
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <Panel className="bg-gradient-to-r from-white via-white to-sand/50">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <Badge tone={state.event.status === "live" ? "accent" : "default"}>
              {state.event.status.replace("_", " ")}
            </Badge>
            <SectionHeading
              eyebrow="Admin control"
              title={state.event.title}
              description={`Join code ${state.event.joinCode}. ${state.registrations.length} players registered.`}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {state.event.status === "draft" ? (
              <Button
                tone="secondary"
                disabled={busyAction === "open_registration"}
                onClick={() =>
                  postJson(`/api/admin/events/${slug}`, { action: "open_registration" }, "open_registration")
                }
              >
                Open registration
              </Button>
            ) : null}
            {state.event.status === "registration_open" ? (
              <Button
                disabled={busyAction === "start_game"}
                onClick={() => postJson(`/api/admin/events/${slug}/start`, {}, "start_game")}
              >
                Start game
              </Button>
            ) : null}
            {state.event.status === "live" ? (
              <Button
                tone="danger"
                disabled={busyAction === "end_game"}
                onClick={() => postJson(`/api/admin/events/${slug}/end`, {}, "end_game")}
              >
                End game
              </Button>
            ) : null}
          </div>
        </div>
      </Panel>

      {message ? <p className="rounded-2xl bg-mint/15 px-4 py-3 text-sm text-ink">{message}</p> : null}
      {error ? <p className="rounded-2xl bg-coral/15 px-4 py-3 text-sm text-coral">{error}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,0.9fr)]">
        <div className="space-y-6">
          <Panel>
            <SectionHeading
              eyebrow="Settings"
              title="Event settings"
              description="Title is always editable. Team size locks after the game goes live."
            />
            <form
              className="mt-6 grid gap-3 md:grid-cols-[1fr_180px_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                postJson(
                  `/api/admin/events/${slug}`,
                  {
                    action: "update_event",
                    title: eventTitle,
                    targetTeamSize: Number(targetTeamSize),
                  },
                  "update_event",
                );
              }}
            >
              <Input value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} />
              <Input
                type="number"
                min={2}
                max={10}
                value={targetTeamSize}
                onChange={(event) => setTargetTeamSize(event.target.value)}
              />
              <Button type="submit" disabled={busyAction === "update_event"}>
                {busyAction === "update_event" ? "Saving..." : "Save"}
              </Button>
            </form>
          </Panel>

          <Panel>
            <SectionHeading
              eyebrow="Tasks"
              title={`Task deck (${state.tasks.length}/16 active)`}
              description="Create all 16 active tasks before starting. Once live, only task text stays editable."
            />
            <form
              className="mt-6 grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                postJson(`/api/admin/events/${slug}/tasks`, taskDraft, "create_task").then(() => {
                  setTaskDraft({
                    title: "",
                    shortDescription: "",
                    fullDescription: "",
                    type: "competitive",
                    isActive: true,
                  });
                });
              }}
            >
              <Input
                placeholder="Task title"
                value={taskDraft.title}
                onChange={(event) => setTaskDraft((current) => ({ ...current, title: event.target.value }))}
                required
              />
              <Input
                placeholder="Short description"
                value={taskDraft.shortDescription}
                onChange={(event) =>
                  setTaskDraft((current) => ({ ...current, shortDescription: event.target.value }))
                }
                required
              />
              <Textarea
                placeholder="Full description"
                value={taskDraft.fullDescription}
                onChange={(event) =>
                  setTaskDraft((current) => ({ ...current, fullDescription: event.target.value }))
                }
                required
              />
              <div className="grid gap-3 md:grid-cols-3">
                <Select
                  value={taskDraft.type}
                  onChange={(event) =>
                    setTaskDraft((current) => ({ ...current, type: event.target.value as "competitive" | "cooperative" }))
                  }
                >
                  <option value="competitive">Competitive</option>
                  <option value="cooperative">Cooperative</option>
                </Select>
                <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={taskDraft.isActive}
                    onChange={(event) =>
                      setTaskDraft((current) => ({ ...current, isActive: event.target.checked }))
                    }
                  />
                  Active task
                </label>
                <Button type="submit" disabled={busyAction === "create_task"}>
                  {busyAction === "create_task" ? "Saving..." : "Add task"}
                </Button>
              </div>
            </form>

            <div className="mt-6 space-y-4">
              {state.tasks.map((task) => (
                <details key={task.id} className="rounded-3xl bg-ink/5 p-4">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-ink">{task.title}</p>
                        <p className="text-sm text-ink/60">{task.shortDescription}</p>
                      </div>
                      <Badge tone={task.type === "competitive" ? "accent" : "success"}>{task.type}</Badge>
                    </div>
                  </summary>
                  <form
                    className="mt-4 grid gap-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const formData = new FormData(event.currentTarget);
                      postJson(
                        `/api/admin/events/${slug}/tasks/${task.id}`,
                        {
                          title: String(formData.get("title") ?? ""),
                          shortDescription: String(formData.get("shortDescription") ?? ""),
                          fullDescription: String(formData.get("fullDescription") ?? ""),
                          type: String(formData.get("type") ?? "competitive"),
                          isActive: formData.get("isActive") === "on",
                        },
                        `task_${task.id}`,
                      );
                    }}
                  >
                    <Input name="title" defaultValue={task.title} />
                    <Input name="shortDescription" defaultValue={task.shortDescription} />
                    <Textarea name="fullDescription" defaultValue={task.fullDescription} />
                    <div className="grid gap-3 md:grid-cols-3">
                      <Select name="type" defaultValue={task.type}>
                        <option value="competitive">Competitive</option>
                        <option value="cooperative">Cooperative</option>
                      </Select>
                      <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm text-ink">
                        <input name="isActive" type="checkbox" defaultChecked={task.isActive} />
                        Active task
                      </label>
                      <Button type="submit" disabled={busyAction === `task_${task.id}`}>
                        {busyAction === `task_${task.id}` ? "Saving..." : "Update task"}
                      </Button>
                    </div>
                  </form>
                </details>
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionHeading
              eyebrow="Challenges"
              title="Live results and overrides"
              description="Use overrides to correct a wrong winner or cancel an invalid result."
            />
            <div className="mt-6 space-y-4">
              {state.challenges.map((challenge) => (
                <form
                  key={challenge.id}
                  className="rounded-3xl bg-ink/5 p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    const winnerValue = String(formData.get("winnerTeamId") ?? "");
                    postJson(
                      `/api/admin/events/${slug}/challenges/${challenge.id}/override`,
                      {
                        status: String(formData.get("status") ?? "resolved"),
                        winnerTeamId: winnerValue ? winnerValue : null,
                        note: String(formData.get("note") ?? ""),
                      },
                      `override_${challenge.id}`,
                    );
                  }}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-ink/45">
                        {challenge.status}
                      </p>
                      <p className="mt-1 font-semibold text-ink">{challenge.taskTitle}</p>
                      <p className="text-sm text-ink/60">
                        {state.teams.find((team) => team.id === challenge.challengerTeamId)?.displayName} vs{" "}
                        {state.teams.find((team) => team.id === challenge.opponentTeamId)?.displayName}
                      </p>
                    </div>
                    <Badge tone={challenge.type === "competitive" ? "warning" : "success"}>
                      {challenge.type}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <Select name="status" defaultValue={challenge.status}>
                      <option value="resolved">Resolved</option>
                      <option value="cancelled">Cancelled</option>
                    </Select>
                    <Select
                      name="winnerTeamId"
                      defaultValue={challenge.winnerTeamId ?? ""}
                      disabled={challenge.type === "cooperative"}
                    >
                      <option value="">No winner</option>
                      <option value={challenge.challengerTeamId}>
                        {state.teams.find((team) => team.id === challenge.challengerTeamId)?.displayName}
                      </option>
                      <option value={challenge.opponentTeamId}>
                        {state.teams.find((team) => team.id === challenge.opponentTeamId)?.displayName}
                      </option>
                    </Select>
                    <Button type="submit" disabled={busyAction === `override_${challenge.id}`}>
                      {busyAction === `override_${challenge.id}` ? "Saving..." : "Apply override"}
                    </Button>
                  </div>
                  <Textarea
                    className="mt-3"
                    name="note"
                    defaultValue={challenge.note ?? ""}
                    placeholder="Override note"
                  />
                </form>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel>
            <SectionHeading
              eyebrow="Registrations"
              title={`${state.registrations.length} players`}
              description="Players appear here as soon as they register."
            />
            <div className="mt-5 space-y-3">
              {state.registrations.map((player) => (
                <div key={player.id} className="flex items-center justify-between rounded-2xl bg-ink/5 px-4 py-3">
                  <p className="font-medium text-ink">{player.displayName}</p>
                  <p className="text-sm text-ink/55">{player.teamId ? "Assigned" : "Waiting"}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionHeading
              eyebrow="Leaderboard"
              title="Current standings"
              description="Sorted only by completed tasks."
            />
            <div className="mt-5 space-y-3">
              {state.leaderboard.map((team, index) => (
                <div key={team.teamId} className="rounded-3xl bg-ink/5 px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-ink/45">#{index + 1}</p>
                      <p className="font-semibold text-ink">{team.teamName}</p>
                    </div>
                    <p className="text-xl font-semibold text-ink">{team.completedCount}</p>
                  </div>
                  <p className="mt-2 text-xs text-ink/55">
                    Gold {team.goldCount} • Platinum {team.platinumCount}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionHeading
              eyebrow="Teams"
              title={`${state.teams.length} teams`}
              description="Switch captains instantly if you need to rebalance leadership."
            />
            <div className="mt-5 space-y-4">
              {state.teams.map((team) => (
                <form
                  key={team.id}
                  className="rounded-3xl bg-ink/5 p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    postJson(
                      `/api/admin/events/${slug}/captain`,
                      {
                        teamId: team.id,
                        playerId: String(formData.get("playerId") ?? ""),
                      },
                      `captain_${team.id}`,
                    );
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-ink">{team.displayName}</p>
                      <p className="text-sm text-ink/60">{team.completedCount} tasks completed</p>
                    </div>
                    <Badge tone="accent">{team.members.length} members</Badge>
                  </div>
                  <div className="mt-4 space-y-2">
                    {team.members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between rounded-2xl bg-white/75 px-4 py-3">
                        <p className="font-medium text-ink">{member.displayName}</p>
                        {member.isCaptain ? <Badge tone="accent">Captain</Badge> : null}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                    <Select name="playerId" defaultValue={team.captainPlayerId ?? undefined}>
                      {team.members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.displayName}
                        </option>
                      ))}
                    </Select>
                    <Button type="submit" disabled={busyAction === `captain_${team.id}`}>
                      {busyAction === `captain_${team.id}` ? "Switching..." : "Switch captain"}
                    </Button>
                  </div>
                </form>
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionHeading
              eyebrow="Audit"
              title="Recent admin actions"
              description="Every overwrite and control change is logged for cleanup."
            />
            <div className="mt-5 space-y-3">
              {state.auditLog.slice(0, 12).map((entry) => (
                <div key={entry.id} className="rounded-2xl bg-ink/5 px-4 py-3">
                  <p className="text-sm font-semibold text-ink">{entry.actionType}</p>
                  <p className="text-xs text-ink/55">
                    {new Date(entry.createdAt).toLocaleString("en-GB")} • {entry.entityType}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
