"use client";

import { useEffect, useId, useState } from "react";
import type { FormEvent } from "react";

import { PlayerSignOutButton } from "@/components/player-sign-out-button";
import { Badge, Button, Input, Panel, SectionHeading, Select, Textarea } from "@/components/ui";
import type { getPlayerState } from "@/lib/game/service";
import { cn } from "@/lib/utils";

type PlayerState = Awaited<ReturnType<typeof getPlayerState>>;

type PlayerView = "board" | "active" | "leaderboard" | "team";

const STAR_PATH =
  "M12 1.75l3.14 6.35 7.01 1.02-5.08 4.95 1.2 6.98L12 17.74 5.73 21.05l1.2-6.98-5.08-4.95 7.01-1.02L12 1.75Z";

function tierClasses(tier: string) {
  switch (tier) {
    case "gold":
      return "border-amber-300 bg-gradient-to-br from-amber-50 via-gold/35 to-amber-200 shadow-[0_8px_20px_rgba(245,158,11,0.18)]";
    case "platinum":
      return "border-cyan-300 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(191,219,254,0.92)_38%,_rgba(125,211,252,0.9)_72%,_rgba(34,211,238,0.82)_100%)] ring-2 ring-cyan-200 shadow-[0_0_24px_rgba(103,232,249,0.45)]";
    case "base":
      return "border-emerald-300 bg-gradient-to-br from-emerald-50 via-mint/40 to-emerald-200 shadow-[0_6px_18px_rgba(52,211,153,0.18)]";
    default:
      return "border-ink/10 bg-white/70";
  }
}

function formatTierLabel(tier: string) {
  switch (tier) {
    case "platinum":
      return "diamond";
    default:
      return tier;
  }
}

function formatStars(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function StarIcon({
  fill,
  sizeClass,
  clipId,
}: {
  fill: number;
  sizeClass: string;
  clipId: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={cn("shrink-0", sizeClass)} aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={24 * fill} height="24" />
        </clipPath>
      </defs>
      <path d={STAR_PATH} fill="rgba(15, 23, 42, 0.12)" />
      <path d={STAR_PATH} fill="#fbbf24" clipPath={`url(#${clipId})`} />
    </svg>
  );
}

function StarRatingDisplay({
  value,
  size = "md",
}: {
  value: number;
  size?: "sm" | "md";
}) {
  const idPrefix = useId();
  const starSize = size === "sm" ? "h-4 w-4" : "h-7 w-7";

  return (
    <div className="flex items-center gap-0.5" aria-label={`${formatStars(value)} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => {
        const fill = Math.max(0, Math.min(1, value - index));
        return <StarIcon key={index} fill={fill} sizeClass={starSize} clipId={`${idPrefix}-${index}`} />;
      })}
    </div>
  );
}

function StarRatingPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const idPrefix = useId();
  return (
    <div className="flex items-center justify-center gap-1 rounded-3xl bg-white/85 px-3 py-3">
      {Array.from({ length: 5 }, (_, index) => {
        const starNumber = index + 1;
        const fill = Math.max(0, Math.min(1, value - index));

        return (
          <div key={starNumber} className="relative h-11 w-11">
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <StarIcon fill={fill} sizeClass="h-8 w-8" clipId={`${idPrefix}-${starNumber}`} />
            </div>
            <button
              type="button"
              className="absolute inset-y-0 left-0 w-1/2 rounded-l-full"
              disabled={disabled}
              aria-label={`Rate ${starNumber - 0.5} stars`}
              onClick={() => onChange(starNumber - 0.5)}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 w-1/2 rounded-r-full"
              disabled={disabled}
              aria-label={`Rate ${starNumber} stars`}
              onClick={() => onChange(starNumber)}
            />
          </div>
        );
      })}
    </div>
  );
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
  const [note, setNote] = useState("");
  const [ratingStars, setRatingStars] = useState(0);
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
  const teamNeedsName = Boolean(state.team && !state.team.name);
  const showInitialTeamSetup = state.event.status === "live" && Boolean(state.team) && teamNeedsName;
  const challengeLockActive = Boolean(activeChallenge);
  const taskStartBlockedMessage = state.me.isCaptain
    ? "Choose a team name before starting any tasks."
    : "Your captain must choose a team name before your team can start tasks.";

  function getTeamLabel(teamId?: string | null) {
    if (!teamId) {
      return "Team";
    }

    return state.teams.find((team) => team.id === teamId)?.name ?? "Team";
  }

  useEffect(() => {
    if (selectedTask) {
      setOpponentTeamId("");
      setNote("");
      setRatingStars(0);
    }
  }, [selectedTaskId]);

  useEffect(() => {
    if (activeChallenge) {
      setView("active");
      setSelectedTaskId(activeChallenge.taskId);
    }
  }, [activeChallenge?.id, activeChallenge?.taskId]);

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

  async function handleResolveChallenge(input?: {
    winnerTeamId?: string;
    status?: "resolved" | "cancelled";
  }) {
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
          winnerTeamId: input?.winnerTeamId,
          status: input?.status,
          note,
        }),
      });
      await readResponse(response, "Could not submit the result.");

      setMessage(input?.status === "cancelled" ? "Challenge cancelled." : "Result submitted.");
      setNote("");
      setRatingStars(0);
      await refreshNow();
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : "Submission failed.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRateChallenge() {
    if (!activeChallenge || ratingStars < 1) {
      return;
    }

    setBusyAction("rate");
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/play/${slug}/challenges/${activeChallenge.id}/rating`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stars: ratingStars,
        }),
      });
      await readResponse(response, "Could not save rating.");

      setMessage("Thanks for rating the task.");
      setSelectedTaskId(null);
      setRatingStars(0);
      setNote("");
      await refreshNow();
    } catch (ratingError) {
      setError(ratingError instanceof Error ? ratingError.message : "Rating failed.");
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
      {state.event.status === "live" && state.team && teamNeedsName ? (
        <p className="rounded-2xl bg-gold/20 px-4 py-3 text-sm text-ink">
          {taskStartBlockedMessage}
        </p>
      ) : null}

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
                      challengeLockActive && tab !== "active" ? "cursor-not-allowed opacity-50" : "",
                    )}
                    onClick={() => {
                      if (challengeLockActive && tab !== "active") {
                        return;
                      }

                      setView(tab);
                    }}
                    disabled={challengeLockActive && tab !== "active"}
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
                            : `${formatTierLabel(card.completionTier)} • W${card.winCount}/L${card.lossCount}`}
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
                        {getTeamLabel(activeChallenge.challengerTeamId)} vs{" "}
                        {getTeamLabel(activeChallenge.opponentTeamId)}
                      </p>
                      <p className="mt-3 text-sm text-ink/60">
                        {activeChallenge.status === "open"
                          ? activeChallenge.isResolvableByMe
                            ? "Your team is in this challenge now. Open the task card to submit the result or cancel it for both teams."
                            : "Your team is locked to this challenge until the challenging team submits the result."
                          : activeChallenge.canRateByMe
                            ? "The result is in. Rate the task now to continue."
                            : "Waiting for the other team to finish rating this task."}
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
                          Gold {team.goldCount} • Diamond {team.platinumCount}
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

                  {teamNeedsName && state.me.isCaptain ? (
                    <form className="space-y-3 rounded-3xl bg-sand/35 p-5" onSubmit={handleRenameTeam}>
                      <p className="text-sm font-semibold text-ink">Choose your team name</p>
                      <Input
                        value={teamName}
                        onChange={(event) => setTeamName(event.target.value)}
                        placeholder="Choose a team name"
                      />
                      <Button type="submit" disabled={busyAction === "rename"}>
                        {busyAction === "rename" ? "Saving..." : "Lock in team name"}
                      </Button>
                    </form>
                  ) : state.me.isCaptain ? (
                    <p className="rounded-3xl bg-ink/5 p-4 text-sm text-ink/60">
                      Team name is locked in for the rest of the game.
                    </p>
                  ) : (
                    <p className="rounded-3xl bg-ink/5 p-4 text-sm text-ink/60">
                      {teamNeedsName
                        ? "Only the captain can choose the team name."
                        : "Team name is locked in for the rest of the game."}
                    </p>
                  )}
                </div>
              ) : null}
            </Panel>

            <Panel className="hidden lg:block">
              <SectionHeading
                eyebrow="Live leaderboard"
                title="Standings"
                description="Completed tasks decide the ranking. Gold and diamond are visual tie-break-free badges."
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
                      Gold {team.goldCount} • Diamond {team.platinumCount}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {selectedTask ? (
            <div className="fixed inset-0 z-40 bg-ink/45 sm:flex sm:items-center sm:justify-center sm:p-6">
              <div className="h-[100dvh] w-full overflow-y-auto bg-mist px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[max(env(safe-area-inset-top),1rem)] shadow-panel sm:max-h-[92vh] sm:max-w-2xl sm:rounded-[2rem] sm:p-6">
                <div className="sticky top-0 z-10 -mx-4 -mt-[max(env(safe-area-inset-top),1rem)] flex items-start justify-between gap-4 bg-mist/95 px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)] backdrop-blur sm:static sm:m-0 sm:bg-transparent sm:p-0">
                  <div>
                    <Badge tone={selectedTask.type === "competitive" ? "accent" : "success"}>
                      {selectedTask.type}
                    </Badge>
                    <h3 className="mt-3 text-2xl font-semibold text-ink">{selectedTask.title}</h3>
                    <p className="mt-2 text-sm text-ink/60">{selectedTask.shortDescription}</p>
                  </div>
                  {activeChallenge && activeChallengeTaskId === selectedTask.taskId ? (
                    activeChallenge.canCancelByMe ? (
                      <Button
                        tone="danger"
                        onClick={() => {
                          if (
                            !window.confirm(
                              "Are you sure you want to cancel this challenge for both teams?",
                            )
                          ) {
                            return;
                          }

                          handleResolveChallenge({ status: "cancelled" });
                        }}
                        disabled={busyAction === "resolve"}
                      >
                        {busyAction === "resolve" ? "Cancelling..." : "Cancel challenge"}
                      </Button>
                    ) : (
                      <Button tone="ghost" disabled>
                        Challenge locked
                      </Button>
                    )
                  ) : (
                    <Button tone="ghost" onClick={() => setSelectedTaskId(null)}>
                      Close
                    </Button>
                  )}
                </div>

                <div className="mt-6 space-y-4 rounded-3xl bg-white/80 p-5">
                  {selectedTask.imageUrl ? (
                    <img
                      src={selectedTask.imageUrl}
                      alt={selectedTask.title}
                      className="h-52 w-full rounded-3xl object-cover sm:h-64"
                    />
                  ) : null}
                  <p className="text-sm leading-6 text-ink/80">{selectedTask.fullDescription}</p>
                  <p className="mt-4 text-xs uppercase tracking-[0.22em] text-ink/45">
                    Progress: {formatTierLabel(selectedTask.completionTier)} • Wins {selectedTask.winCount} • Losses{" "}
                    {selectedTask.lossCount}
                  </p>
                  {selectedTask.ratingCount > 0 ? (
                    <div className="mt-3 flex items-center gap-3">
                      <StarRatingDisplay value={selectedTask.ratingAverage ?? 0} size="sm" />
                      <p className="text-xs uppercase tracking-[0.22em] text-ink/45">
                        {selectedTask.ratingAverage?.toFixed(1)} from {selectedTask.ratingCount} ratings
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs uppercase tracking-[0.22em] text-ink/45">
                      Rating: No ratings yet
                    </p>
                  )}
                </div>

                {selectedTask.lastLossOpponentTeamId ? (
                  <p className="mt-4 rounded-2xl bg-gold/15 px-4 py-3 text-sm text-ink/75">
                    Your next attempt on this task cannot be against{" "}
                    {getTeamLabel(selectedTask.lastLossOpponentTeamId)}
                    .
                  </p>
                ) : null}

                {!activeChallenge && selectedTask.canChallenge ? (
                  <div className="mt-6 space-y-4 rounded-3xl bg-white/75 p-5">
                    <h4 className="text-lg font-semibold text-ink">Start a challenge</h4>
                    {teamNeedsName ? (
                      <p className="rounded-2xl bg-gold/15 px-4 py-3 text-sm text-ink/75">
                        {taskStartBlockedMessage}
                      </p>
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>
                ) : null}

                {activeChallenge && activeChallengeTaskId === selectedTask.taskId ? (
                  <div className="mt-6 space-y-4 rounded-3xl bg-sea/8 p-5">
                    <h4 className="text-lg font-semibold text-ink">
                      {activeChallenge.status === "open" ? "Submit result" : "Rate this task"}
                    </h4>
                    <p className="text-sm text-ink/65">
                      {getTeamLabel(activeChallenge.challengerTeamId)} vs{" "}
                      {getTeamLabel(activeChallenge.opponentTeamId)}
                    </p>
                    {activeChallenge.status === "open" ? (
                      activeChallenge.isResolvableByMe ? (
                        <>
                          {teamNeedsName ? (
                            <p className="rounded-2xl bg-gold/15 px-4 py-3 text-sm text-ink/75">
                              {taskStartBlockedMessage}
                            </p>
                          ) : (
                            <>
                              {activeChallenge.type === "competitive" ? (
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <Button
                                    className="bg-mint text-ink hover:bg-mint/90"
                                    onClick={() =>
                                      handleResolveChallenge({
                                        winnerTeamId: activeChallenge.challengerTeamId,
                                      })
                                    }
                                    disabled={busyAction === "resolve"}
                                  >
                                    {busyAction === "resolve" ? "Submitting..." : "We won"}
                                  </Button>
                                  <Button
                                    tone="danger"
                                    onClick={() =>
                                      handleResolveChallenge({
                                        winnerTeamId: activeChallenge.opponentTeamId,
                                      })
                                    }
                                    disabled={busyAction === "resolve"}
                                  >
                                    {busyAction === "resolve" ? "Submitting..." : "We lost"}
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <p className="rounded-2xl bg-white/75 px-4 py-3 text-sm text-ink/65">
                                    Cooperative task: mark whether both teams got it done or had to give up.
                                  </p>
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <Button
                                      className="bg-mint text-ink hover:bg-mint/90"
                                      onClick={() =>
                                        handleResolveChallenge({
                                          status: "resolved",
                                        })
                                      }
                                      disabled={busyAction === "resolve"}
                                    >
                                      {busyAction === "resolve" ? "Submitting..." : "Tegimegi!"}
                                    </Button>
                                    <Button
                                      tone="danger"
                                      onClick={() =>
                                        handleResolveChallenge({
                                          status: "cancelled",
                                        })
                                      }
                                      disabled={busyAction === "resolve"}
                                    >
                                      {busyAction === "resolve" ? "Submitting..." : "ei saand hakkama"}
                                    </Button>
                                  </div>
                                </>
                              )}
                            </>
                          )}
                          <Textarea
                            placeholder="Optional result note"
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                          />
                        </>
                      ) : (
                        <p className="rounded-2xl bg-white/75 px-4 py-3 text-sm text-ink/65">
                          Only the challenging team can submit the result.
                        </p>
                      )
                    ) : activeChallenge.canRateByMe ? (
                      <>
                        <p className="rounded-2xl bg-white/75 px-4 py-3 text-sm text-ink/65">
                          Give this task a star rating before leaving the challenge flow.
                        </p>
                        <div className="space-y-3">
                          <StarRatingPicker
                            value={ratingStars}
                            onChange={setRatingStars}
                            disabled={busyAction === "rate"}
                          />
                          <p className="text-center text-sm text-ink/60">
                            {ratingStars > 0
                              ? `${formatStars(ratingStars)} / 5`
                              : "Tap the left or right side of a star for half or full ratings."}
                          </p>
                        </div>
                        <Button onClick={handleRateChallenge} disabled={busyAction === "rate" || ratingStars < 1}>
                          {busyAction === "rate" ? "Saving..." : "Submit rating"}
                        </Button>
                      </>
                    ) : (
                      <p className="rounded-2xl bg-white/75 px-4 py-3 text-sm text-ink/65">
                        Waiting for the other team to submit its rating.
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
                  challengeLockActive && tab !== "active" ? "cursor-not-allowed opacity-50" : "",
                )}
                onClick={() => {
                  if (challengeLockActive && tab !== "active") {
                    return;
                  }

                  setView(tab);
                }}
                disabled={challengeLockActive && tab !== "active"}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {showInitialTeamSetup && state.team ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/55 p-0 sm:items-center sm:p-6">
          <div className="w-full max-w-2xl rounded-t-[2rem] bg-mist p-5 shadow-panel sm:rounded-[2rem] sm:p-6">
            <Badge tone="accent">Team setup</Badge>
            <div className="mt-4">
              <SectionHeading
                eyebrow="Random teams are ready"
                title={state.me.isCaptain ? "Choose your team name" : "Meet your team"}
                description={
                  state.me.isCaptain
                    ? "Before your team can start tasks, pick a name once and lock it in."
                    : "Your captain must pick a team name before tasks can begin."
                }
              />
            </div>

            <div className="mt-6 rounded-3xl bg-ink/5 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Your teammates</p>
              <div className="mt-4 space-y-3">
                {state.team.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-2xl bg-white/80 px-4 py-3"
                  >
                    <p className="font-medium text-ink">{member.displayName}</p>
                    {member.isCaptain ? <Badge tone="accent">Captain</Badge> : null}
                  </div>
                ))}
              </div>
            </div>

            {state.me.isCaptain ? (
              <form className="mt-6 space-y-3 rounded-3xl bg-sand/35 p-5" onSubmit={handleRenameTeam}>
                <p className="text-sm font-semibold text-ink">Final team name</p>
                <Input
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  placeholder="Choose a team name"
                />
                <Button type="submit" disabled={busyAction === "rename"}>
                  {busyAction === "rename" ? "Saving..." : "Lock in team name"}
                </Button>
              </form>
            ) : (
              <p className="mt-6 rounded-3xl bg-white/80 px-4 py-4 text-sm text-ink/70">
                Waiting for your captain to choose the final team name.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
