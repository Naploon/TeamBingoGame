"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { PlayerSignOutButton } from "@/components/player-sign-out-button";
import { Badge, Button, Input, Panel, SectionHeading, Select, Textarea } from "@/components/ui";
import type { getPlayerState } from "@/lib/game/service";
import { cn } from "@/lib/utils";

type PlayerState = Awaited<ReturnType<typeof getPlayerState>>;

type PlayerView = "board" | "active" | "leaderboard" | "team";

function tierClasses(tier: string) {
  switch (tier) {
    case "gold":
      return "border-gold/60 bg-gold/20";
    case "platinum":
      return "border-platinum/70 bg-platinum/25";
    case "base":
      return "border-sea/30 bg-sea/10";
    default:
      return "border-ink/10 bg-white/70";
  }
}

export function PlayerApp({
  slug,
  initialState,
}: {
  slug: string;
  initialState: PlayerState;
}) {
  const [state, setState] = useState(initialState);
  const [view, setView] = useState<PlayerView>("board");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [opponentTeamId, setOpponentTeamId] = useState("");
  const [winnerTeamId, setWinnerTeamId] = useState("");
  const [note, setNote] = useState("");
  const [teamName, setTeamName] = useState(
    initialState.team?.name ?? initialState.team?.autoName ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  async function readResponse(response: Response, fallbackMessage: string) {
    const payload = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        window.location.assign("/?notice=session-expired");
      }

      throw new Error(payload.error ?? fallbackMessage);
    }

    return payload;
  }

  useEffect(() => {
    let cancelled = false;

    async function refreshState() {
      try {
        const response = await fetch(`/api/play/${slug}/state`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = await readResponse(response, "Unable to refresh game state.");

        if (!cancelled) {
          setState(payload);
          if (payload.team) {
            setTeamName(payload.team.name ?? payload.team.autoName);
          }
        }
      } catch (refreshError) {
        if (!cancelled) {
          setError(refreshError instanceof Error ? refreshError.message : "Refresh failed.");
        }
      }
    }

    const interval = window.setInterval(refreshState, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [slug]);

  const selectedTask = state.board.find((card) => card?.taskId === selectedTaskId) ?? null;
  const activeChallenge = state.activeChallenge;
  const myTeamId = state.team?.id ?? null;
  const activeChallengeTaskId = activeChallenge?.taskId ?? null;
  const teamOptions = state.teams.filter((team) => team.id !== myTeamId);

  useEffect(() => {
    if (selectedTask) {
      setOpponentTeamId("");
      setWinnerTeamId("");
      setNote("");
    }
  }, [selectedTaskId]);

  async function refreshNow() {
    const response = await fetch(`/api/play/${slug}/state`, {
      method: "GET",
      cache: "no-store",
    });
    const payload = await readResponse(response, "Could not refresh state.");

    setState(payload);
  }

  async function handleRenameTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("rename");
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/play/${slug}/team-name`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ teamName }),
      });
      await readResponse(response, "Rename failed.");

      setMessage("Team name updated.");
      await refreshNow();
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "Rename failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreateChallenge() {
    if (!selectedTask || !opponentTeamId) {
      return;
    }

    setBusyAction("challenge");
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/play/${slug}/challenges`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId: selectedTask.taskId,
          opponentTeamId,
        }),
      });
      await readResponse(response, "Challenge creation failed.");

      setMessage("Challenge created. Complete the task, then submit the result.");
      await refreshNow();
    } catch (challengeError) {
      setError(challengeError instanceof Error ? challengeError.message : "Challenge failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleResolveChallenge() {
    if (!activeChallenge) {
      return;
    }

    setBusyAction("resolve");
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/play/${slug}/challenges/${activeChallenge.id}/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          winnerTeamId: activeChallenge.type === "competitive" ? winnerTeamId : undefined,
          note,
        }),
      });
      await readResponse(response, "Could not submit the result.");

      setMessage("Result submitted.");
      setSelectedTaskId(null);
      setWinnerTeamId("");
      setNote("");
      await refreshNow();
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "Submission failed.");
    } finally {
      setBusyAction(null);
    }
  }

  const titleTeam = state.team ? state.team.name ?? state.team.autoName : null;

  return (
    <div className="space-y-5">
      <Panel className="overflow-hidden bg-gradient-to-br from-white via-white to-sand/50">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <Badge tone="accent">{state.event.status.replace("_", " ")}</Badge>
            <SectionHeading
              eyebrow="Live event"
              title={state.event.title}
              description={
                state.team
                  ? `${titleTeam} is ready. Join code ${state.event.joinCode}.`
                  : "You are registered. Teams will appear when the admin starts the event."
              }
            />
          </div>
          <div className="rounded-3xl bg-ink p-4 text-white shadow-panel">
            <p className="text-xs uppercase tracking-[0.24em] text-white/65">You</p>
            <p className="mt-2 text-lg font-semibold">{state.me.displayName}</p>
            <p className="text-sm text-white/75">
              {state.me.isCaptain ? "Captain" : "Team member"}
            </p>
            <div className="mt-4">
              <PlayerSignOutButton redirectTo="/" tone="secondary" />
            </div>
          </div>
        </div>
      </Panel>

      {message ? <p className="rounded-2xl bg-mint/15 px-4 py-3 text-sm text-ink">{message}</p> : null}
      {error ? <p className="rounded-2xl bg-coral/15 px-4 py-3 text-sm text-coral">{error}</p> : null}

      {state.event.status !== "live" || !state.team ? (
        <Panel>
          <SectionHeading
            eyebrow="Lobby"
            title={state.event.status === "ended" ? "Game finished" : "Waiting for the start"}
            description={
              state.event.status === "ended"
                ? "The event has ended. Final standings remain visible below."
                : "Keep this page open. Teams and the board will appear automatically when the admin starts the game."
            }
          />
          {state.team ? (
            <div className="mt-6 rounded-3xl bg-sea/8 p-4">
              <p className="text-sm text-ink/70">Assigned team</p>
              <p className="mt-1 text-xl font-semibold text-ink">
                {state.team.name ?? state.team.autoName}
              </p>
            </div>
          ) : null}
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-ink/55">
              Current leaderboard
            </h3>
            <div className="space-y-3">
              {state.leaderboard.map((team, index) => (
                <div
                  key={team.teamId}
                  className="flex items-center justify-between rounded-2xl bg-ink/5 px-4 py-3"
                >
                  <div>
                    <p className="text-sm text-ink/55">#{index + 1}</p>
                    <p className="font-semibold text-ink">{team.teamName}</p>
                  </div>
                  <p className="text-lg font-semibold text-ink">{team.completedCount}</p>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
            <Panel>
              <div className="mb-4 flex gap-2 rounded-full bg-ink/5 p-1">
                {(["board", "active", "leaderboard", "team"] as PlayerView[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={cn(
                      "min-h-11 flex-1 rounded-full px-3 text-sm font-semibold capitalize transition",
                      view === tab ? "bg-ink text-white" : "text-ink/60",
                    )}
                    onClick={() => setView(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {view === "board" ? (
                <div className="grid grid-cols-4 gap-2">
                  {state.board.map((card, index) => (
                    <button
                      key={card.taskId}
                      type="button"
                      className={cn(
                        "aspect-square rounded-[1.35rem] border p-2 text-left transition hover:-translate-y-0.5",
                        tierClasses(card.completionTier),
                      )}
                      onClick={() => setSelectedTaskId(card.taskId)}
                    >
                      <div className="flex h-full flex-col justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/50">
                          {index + 1}
                        </p>
                        <div>
                          <p className="line-clamp-2 text-sm font-semibold text-ink">{card.title}</p>
                          <p className="mt-1 text-[11px] text-ink/60">
                            {card.type === "competitive" ? "Vs task" : "Shared task"}
                          </p>
                        </div>
                        <p className="text-[11px] text-ink/65">
                          {card.completionTier === "none"
                            ? "Open"
                            : `${card.completionTier} • W${card.winCount}/L${card.lossCount}`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}

              {view === "active" ? (
                <div className="space-y-4">
                  {activeChallenge ? (
                    <div className="rounded-3xl border border-sea/20 bg-sea/8 p-5">
                      <p className="text-xs uppercase tracking-[0.24em] text-sea/80">Current challenge</p>
                      <h3 className="mt-2 text-xl font-semibold text-ink">{activeChallenge.taskTitle}</h3>
                      <p className="mt-2 text-sm text-ink/70">
                        {
                          state.teams.find((team) => team.id === activeChallenge.challengerTeamId)?.name
                        }{" "}
                        vs{" "}
                        {state.teams.find((team) => team.id === activeChallenge.opponentTeamId)?.name}
                      </p>
                      <p className="mt-3 text-sm text-ink/60">
                        {activeChallenge.isResolvableByMe
                          ? "Open the task card to submit the result."
                          : "Waiting for the challenging team to submit the result."}
                      </p>
                    </div>
                  ) : (
                    <p className="rounded-3xl bg-ink/5 p-5 text-sm text-ink/65">
                      No active challenge right now.
                    </p>
                  )}
                </div>
              ) : null}

              {view === "leaderboard" ? (
                <div className="space-y-3">
                  {state.leaderboard.map((team, index) => (
                    <div key={team.teamId} className="flex items-center justify-between rounded-3xl bg-ink/5 px-4 py-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-ink/45">#{index + 1}</p>
                        <p className="text-lg font-semibold text-ink">{team.teamName}</p>
                        <p className="text-xs text-ink/55">
                          Gold {team.goldCount} • Platinum {team.platinumCount}
                        </p>
                      </div>
                      <p className="text-2xl font-semibold text-ink">{team.completedCount}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {view === "team" ? (
                <div className="space-y-5">
                  <div className="rounded-3xl bg-ink/5 p-5">
                    <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Team</p>
                    <h3 className="mt-2 text-2xl font-semibold text-ink">
                      {state.team.name ?? state.team.autoName}
                    </h3>
                    <p className="mt-2 text-sm text-ink/60">
                      Captain:{" "}
                      {state.team.members.find((member) => member.id === state.team?.captainPlayerId)?.displayName}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {state.team.members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between rounded-2xl bg-white/75 px-4 py-3">
                        <p className="font-medium text-ink">{member.displayName}</p>
                        {member.isCaptain ? <Badge tone="accent">Captain</Badge> : null}
                      </div>
                    ))}
                  </div>

                  {state.me.isCaptain ? (
                    <form className="space-y-3 rounded-3xl bg-sand/35 p-5" onSubmit={handleRenameTeam}>
                      <p className="text-sm font-semibold text-ink">Rename team</p>
                      <Input
                        value={teamName}
                        onChange={(event) => setTeamName(event.target.value)}
                        placeholder="Choose a team name"
                      />
                      <Button type="submit" disabled={busyAction === "rename"}>
                        {busyAction === "rename" ? "Saving..." : "Save team name"}
                      </Button>
                    </form>
                  ) : (
                    <p className="rounded-3xl bg-ink/5 p-4 text-sm text-ink/60">
                      Only the captain can rename the team.
                    </p>
                  )}
                </div>
              ) : null}
            </Panel>

            <Panel className="hidden lg:block">
              <SectionHeading
                eyebrow="Live leaderboard"
                title="Standings"
                description="Completed tasks decide the ranking. Gold and platinum are visual tie-break-free badges."
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
          </div>

          {selectedTask ? (
            <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-6">
              <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] bg-mist p-5 shadow-panel sm:rounded-[2rem] sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Badge tone={selectedTask.type === "competitive" ? "accent" : "success"}>
                      {selectedTask.type}
                    </Badge>
                    <h3 className="mt-3 text-2xl font-semibold text-ink">{selectedTask.title}</h3>
                    <p className="mt-2 text-sm text-ink/60">{selectedTask.shortDescription}</p>
                  </div>
                  <Button tone="ghost" onClick={() => setSelectedTaskId(null)}>
                    Close
                  </Button>
                </div>

                <div className="mt-6 rounded-3xl bg-white/80 p-5">
                  <p className="text-sm leading-6 text-ink/80">{selectedTask.fullDescription}</p>
                  <p className="mt-4 text-xs uppercase tracking-[0.22em] text-ink/45">
                    Progress: {selectedTask.completionTier} • Wins {selectedTask.winCount} • Losses{" "}
                    {selectedTask.lossCount}
                  </p>
                </div>

                {selectedTask.lastLossOpponentTeamId ? (
                  <p className="mt-4 rounded-2xl bg-gold/15 px-4 py-3 text-sm text-ink/75">
                    Your next attempt on this task cannot be against{" "}
                    {
                      state.teams.find((team) => team.id === selectedTask.lastLossOpponentTeamId)?.name
                    }
                    .
                  </p>
                ) : null}

                {!activeChallenge && selectedTask.canChallenge ? (
                  <div className="mt-6 space-y-4 rounded-3xl bg-white/75 p-5">
                    <h4 className="text-lg font-semibold text-ink">Start a challenge</h4>
                    <Select
                      value={opponentTeamId}
                      onChange={(event) => setOpponentTeamId(event.target.value)}
                    >
                      <option value="">Choose an opponent team</option>
                      {teamOptions.map((team) => {
                        const isBlocked = selectedTask.lastLossOpponentTeamId === team.id;
                        return (
                          <option key={team.id} value={team.id} disabled={isBlocked}>
                            {team.name}
                            {isBlocked ? " (blocked after last loss)" : ""}
                          </option>
                        );
                      })}
                    </Select>
                    <Button
                      onClick={handleCreateChallenge}
                      disabled={!opponentTeamId || busyAction === "challenge"}
                    >
                      {busyAction === "challenge" ? "Creating..." : "Create challenge"}
                    </Button>
                  </div>
                ) : null}

                {activeChallenge && activeChallengeTaskId === selectedTask.taskId ? (
                  <div className="mt-6 space-y-4 rounded-3xl bg-sea/8 p-5">
                    <h4 className="text-lg font-semibold text-ink">Submit result</h4>
                    <p className="text-sm text-ink/65">
                      {state.teams.find((team) => team.id === activeChallenge.challengerTeamId)?.name} vs{" "}
                      {state.teams.find((team) => team.id === activeChallenge.opponentTeamId)?.name}
                    </p>
                    {activeChallenge.isResolvableByMe ? (
                      <>
                        {activeChallenge.type === "competitive" ? (
                          <Select
                            value={winnerTeamId}
                            onChange={(event) => setWinnerTeamId(event.target.value)}
                          >
                            <option value="">Select the winning team</option>
                            <option value={activeChallenge.challengerTeamId}>
                              {
                                state.teams.find((team) => team.id === activeChallenge.challengerTeamId)
                                  ?.name
                              }
                            </option>
                            <option value={activeChallenge.opponentTeamId}>
                              {
                                state.teams.find((team) => team.id === activeChallenge.opponentTeamId)
                                  ?.name
                              }
                            </option>
                          </Select>
                        ) : (
                          <p className="rounded-2xl bg-white/75 px-4 py-3 text-sm text-ink/65">
                            Cooperative task: submitting this marks the task complete for both teams.
                          </p>
                        )}
                        <Textarea
                          placeholder="Optional result note"
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                        />
                        <Button
                          onClick={handleResolveChallenge}
                          disabled={
                            busyAction === "resolve" ||
                            (activeChallenge.type === "competitive" && !winnerTeamId)
                          }
                        >
                          {busyAction === "resolve" ? "Submitting..." : "Submit result"}
                        </Button>
                      </>
                    ) : (
                      <p className="rounded-2xl bg-white/75 px-4 py-3 text-sm text-ink/65">
                        Only the challenging team can submit the result.
                      </p>
                    )}
                  </div>
                ) : null}

                {activeChallenge && activeChallengeTaskId !== selectedTask.taskId ? (
                  <p className="mt-6 rounded-2xl bg-ink/5 px-4 py-3 text-sm text-ink/60">
                    Finish the active challenge first before starting another one.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      )}

      {state.team ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/70 bg-white/90 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-xl gap-2">
            {(["board", "active", "leaderboard", "team"] as PlayerView[]).map((tab) => (
              <button
                key={tab}
                type="button"
                className={cn(
                  "min-h-11 flex-1 rounded-full px-3 text-sm font-semibold capitalize",
                  view === tab ? "bg-ink text-white" : "bg-ink/5 text-ink/60",
                )}
                onClick={() => setView(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
