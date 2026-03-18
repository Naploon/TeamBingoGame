"use client";

import { useEffect, useId, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { createPortal } from "react-dom";

import { MarkdownContent } from "@/components/markdown-content";
import { PlayerSignOutButton } from "@/components/player-sign-out-button";
import { Badge, Button, Input, JoinCodeBadge, Panel, SectionHeading, Textarea } from "@/components/ui";
import type { getPlayerState } from "@/lib/game/service";
import type { PlayerViewId } from "@/lib/game/types";
import { cn } from "@/lib/utils";

type PlayerState = Awaited<ReturnType<typeof getPlayerState>>;
type PlayerView = PlayerViewId;
type HistoryFilter = "all" | "wins" | "losses" | "co-op";
type TaskSheetMode = "details" | "challenge" | "result" | "rating";

const STAR_PATH =
  "M12 1.75l3.14 6.35 7.01 1.02-5.08 4.95 1.2 6.98L12 17.74 5.73 21.05l1.2-6.98-5.08-4.95 7.01-1.02L12 1.75Z";

const BIRTHDAY_CONFETTI_PIECES = [
  "left-[4%] top-12 h-12 w-12 rounded-full bg-fuchsia-300/70 blur-[1px] animate-pulse",
  "left-[18%] top-36 h-5 w-16 -rotate-12 rounded-full bg-amber-300/80",
  "right-[12%] top-20 h-14 w-14 rounded-full bg-cyan-300/75 blur-[1px] animate-pulse",
  "right-[6%] top-48 h-5 w-20 rotate-12 rounded-full bg-rose-300/80",
  "left-[10%] bottom-40 h-16 w-16 rounded-full bg-orange-300/65 blur-sm",
  "left-[32%] bottom-20 h-4 w-14 -rotate-[24deg] rounded-full bg-lime-300/80",
  "right-[24%] bottom-24 h-16 w-16 rounded-full bg-violet-300/60 blur-sm",
  "right-[8%] bottom-44 h-4 w-12 rotate-[28deg] rounded-full bg-sky-300/80",
];

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

function getBoardTileStatus(card: PlayerState["board"][number]) {
  if (card.isActiveChallengeTask) {
    return {
      label: "Live",
      className: "bg-sea text-white ring-1 ring-sea/20",
    };
  }

  switch (card.completionTier) {
    case "platinum":
      return {
        label: "Diamond",
        className: "bg-cyan-100 text-cyan-900 ring-1 ring-cyan-200",
      };
    case "gold":
      return {
        label: "Gold",
        className: "bg-amber-100 text-amber-900 ring-1 ring-amber-200",
      };
    case "base":
      return {
        label: "Done",
        className: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
      };
    default:
      return {
        label: "Open",
        className: "bg-white/90 text-ink/70 ring-1 ring-ink/10",
      };
  }
}

function getBoardTileTypeLabel(type: PlayerState["board"][number]["type"]) {
  return type === "competitive" ? "VS" : "CO";
}

function formatStars(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function progressPillClasses(kind: "rank" | "win" | "loss", value?: string) {
  if (kind === "win") {
    return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200";
  }

  if (kind === "loss") {
    return "bg-rose-100 text-rose-800 ring-1 ring-rose-200";
  }

  switch (value) {
    case "base":
      return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200";
    case "gold":
      return "bg-amber-100 text-amber-900 ring-1 ring-amber-200";
    case "platinum":
      return "bg-cyan-100 text-cyan-900 ring-1 ring-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.22)]";
    default:
      return "bg-ink/5 text-ink/65 ring-1 ring-ink/10";
  }
}

function ProgressPill({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        className,
      )}
    >
      {children}
    </span>
  );
}

function BoardTile({
  card,
  index,
  onClick,
  birthdayMode = false,
}: {
  card: PlayerState["board"][number];
  index: number;
  onClick: () => void;
  birthdayMode?: boolean;
}) {
  const status = getBoardTileStatus(card);

  return (
    <button
      type="button"
      className={cn(
        "group aspect-square min-w-0 overflow-hidden rounded-[1.2rem] border p-2 text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sea/60 md:rounded-[1.35rem] md:p-3",
        tierClasses(card.completionTier),
        birthdayMode ? "border-white/80 shadow-[0_14px_26px_rgba(236,72,153,0.16)]" : "",
        card.isActiveChallengeTask ? "ring-2 ring-sea/60" : "",
      )}
      onClick={onClick}
    >
      <div className="flex h-full min-w-0 flex-col">
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white/85 px-2 text-[10px] font-semibold text-ink/65 ring-1 ring-ink/10">
            {index + 1}
          </span>
          <span
            className={cn(
              "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[10px] font-semibold uppercase tracking-[0.14em] ring-1",
              card.type === "competitive"
                ? "bg-coral/10 text-coral ring-coral/20"
                : "bg-mint/20 text-emerald-800 ring-emerald-200",
            )}
          >
            {getBoardTileTypeLabel(card.type)}
          </span>
        </div>

        <div className="mt-2 min-w-0 flex-1">
          <p className="line-clamp-2 break-words text-[13px] font-semibold leading-tight text-ink [overflow-wrap:anywhere] md:text-[15px]">
            {card.title}
          </p>
        </div>

        <div className="mt-2 flex items-end justify-between gap-2">
          <span
            className={cn(
              "inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
              status.className,
            )}
          >
            <span className="truncate">{status.label}</span>
          </span>
          {card.isActiveChallengeTask ? (
            <span className="relative mb-1 mr-0.5 flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sea/45" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sea" />
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function getPlayerViewLabel(view: PlayerView) {
  switch (view) {
    case "history":
      return "History";
    case "leaderboard":
      return "Standings";
    case "team":
      return "Team";
    case "recap":
      return "Recap";
    default:
      return "Board";
  }
}

function getAvailableViews(state: PlayerState): PlayerView[] {
  if (state.event.status === "ended") {
    return state.team ? ["recap", "board", "leaderboard", "history", "team"] : ["recap", "leaderboard"];
  }

  if (state.event.status === "live" && state.team) {
    return ["board", "history", "leaderboard", "team"];
  }

  return state.team ? ["leaderboard", "team"] : ["leaderboard"];
}

function getDefaultView(state: PlayerState): PlayerView {
  return getAvailableViews(state)[0];
}

function formatHistoryResultLabel(result: PlayerState["matchHistory"][number]["result"]) {
  switch (result) {
    case "win":
      return "Won";
    case "loss":
      return "Lost";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    case "in_progress":
      return "In progress";
    default:
      return "No result";
  }
}

function historyResultTone(result: PlayerState["matchHistory"][number]["result"]) {
  switch (result) {
    case "win":
    case "completed":
      return "success" as const;
    case "failed":
    case "loss":
    case "cancelled":
      return "danger" as const;
    case "in_progress":
      return "accent" as const;
    default:
      return "default" as const;
  }
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
        return (
          <StarIcon
            key={index}
            fill={fill}
            sizeClass={starSize}
            clipId={`${idPrefix}-${index}`}
          />
        );
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

function MiniStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="min-w-0 rounded-3xl bg-white/80 p-4 shadow-sm">
      <p className="text-[11px] uppercase tracking-[0.22em] text-ink/45">{label}</p>
      <p className="mt-2 break-words text-xl font-semibold leading-tight text-ink [overflow-wrap:anywhere] sm:text-2xl">
        {value}
      </p>
      {detail ? <p className="mt-2 text-sm leading-6 text-ink/60">{detail}</p> : null}
    </div>
  );
}

function ViewTabs({
  availableViews,
  view,
  onSelect,
  birthdayMode = false,
}: {
  availableViews: PlayerView[];
  view: PlayerView;
  onSelect: (view: PlayerView) => void;
  birthdayMode?: boolean;
}) {
  return (
    <div
      className={cn(
        "hidden gap-2 rounded-full bg-ink/5 p-1 md:flex",
        birthdayMode
          ? "bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(253,242,248,0.92),rgba(254,249,195,0.92),rgba(224,231,255,0.92))] shadow-[0_14px_30px_rgba(236,72,153,0.12)] ring-1 ring-fuchsia-200/60"
          : "",
      )}
    >
      {availableViews.map((tab) => (
        <button
          key={tab}
          type="button"
          className={cn(
            "min-h-11 flex-1 rounded-full px-3 text-sm font-semibold transition",
            view === tab
              ? birthdayMode
                ? "bg-[linear-gradient(135deg,#ec4899,#f97316,#facc15)] text-white shadow-[0_8px_18px_rgba(236,72,153,0.28)]"
                : "bg-ink text-white"
              : birthdayMode
                ? "text-fuchsia-900/80"
                : "text-ink/60",
          )}
          onClick={() => onSelect(tab)}
        >
          {getPlayerViewLabel(tab)}
        </button>
      ))}
    </div>
  );
}

function MobileBottomNav({
  availableViews,
  view,
  onSelect,
  birthdayMode = false,
}: {
  availableViews: PlayerView[];
  view: PlayerView;
  onSelect: (view: PlayerView) => void;
  birthdayMode?: boolean;
}) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-white/60 bg-mist/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-12px_35px_rgba(16,33,47,0.08)] backdrop-blur md:hidden",
        birthdayMode
          ? "border-fuchsia-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(253,242,248,0.94),rgba(254,249,195,0.94),rgba(224,231,255,0.94))]"
          : "",
      )}
    >
      <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto pb-1">
        {availableViews.map((tab) => (
          <button
            key={tab}
            type="button"
            className={cn(
              "min-w-[5rem] shrink-0 rounded-2xl px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.18em] transition",
              view === tab
                ? birthdayMode
                  ? "bg-[linear-gradient(135deg,#ec4899,#f97316,#facc15)] text-white shadow-[0_8px_18px_rgba(236,72,153,0.24)]"
                  : "bg-ink text-white"
                : birthdayMode
                  ? "bg-white/90 text-fuchsia-900/80 ring-1 ring-fuchsia-200/60"
                  : "bg-white/80 text-ink/65",
            )}
            onClick={() => onSelect(tab)}
          >
            {getPlayerViewLabel(tab)}
          </button>
        ))}
      </div>
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
  const [view, setView] = useState<PlayerView>(getDefaultView(initialState));
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskSheetMode, setTaskSheetMode] = useState<TaskSheetMode>("details");
  const [opponentTeamId, setOpponentTeamId] = useState("");
  const [note, setNote] = useState("");
  const [ratingStars, setRatingStars] = useState(0);
  const [teamName, setTeamName] = useState(initialState.team?.name ?? initialState.team?.autoName ?? "");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [birthdayMode, setBirthdayMode] = useState(false);
  const [birthdayModeReady, setBirthdayModeReady] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  const availableViews = getAvailableViews(state);
  const selectedTask = state.board.find((card) => card.taskId === selectedTaskId) ?? null;
  const activeChallenge = state.activeChallenge;
  const titleTeam = state.team ? state.team.name ?? state.team.autoName : null;
  const myTeamId = state.team?.id ?? null;
  const teamNeedsName = Boolean(state.team && !state.team.name);
  const showInitialTeamSetup = state.event.status === "live" && Boolean(state.team) && teamNeedsName;
  const taskStartBlockedMessage = state.me.isCaptain
    ? "Choose a team name before starting any tasks."
    : "Your captain must choose a team name before your team can start tasks.";
  const taskSheetModes: TaskSheetMode[] =
    selectedTask && activeChallenge?.taskId === selectedTask.taskId
      ? activeChallenge.status === "open"
        ? ["details", "result"]
        : activeChallenge.canRateByMe
          ? ["details", "rating"]
          : ["details"]
      : selectedTask?.canChallenge
        ? ["details", "challenge"]
        : ["details"];
  const selectedOpponent =
    selectedTask?.opponentOptions.find((team) => team.teamId === opponentTeamId) ?? null;
  const historyItems = state.matchHistory
    .filter((match) => match.result !== "in_progress")
    .filter((match) => {
      switch (historyFilter) {
        case "wins":
          return match.result === "win" || match.result === "completed";
        case "losses":
          return match.result === "loss" || match.result === "failed";
        case "co-op":
          return match.taskType === "cooperative";
        default:
          return true;
      }
    });
  const birthdayModeStorageKey = `player-birthday-mode:${slug}`;
  const birthdayHeroPanelClass = birthdayMode
    ? "border-fuchsia-300/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(254,240,138,0.9),rgba(249,168,212,0.86),rgba(125,211,252,0.84))] shadow-[0_20px_48px_rgba(236,72,153,0.24)]"
    : "bg-gradient-to-br from-white via-white to-sand/50";
  const birthdayAccentPanelClass = birthdayMode
    ? "border-fuchsia-300/65 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(253,242,248,0.94),rgba(254,249,195,0.9),rgba(224,231,255,0.88),rgba(254,205,211,0.82))] shadow-[0_16px_38px_rgba(236,72,153,0.16)]"
    : "";

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

  function applyState(payload: PlayerState) {
    setState(payload);
    if (payload.team) {
      setTeamName(payload.team.name ?? payload.team.autoName);
    }
  }

  async function refreshNow() {
    try {
      const response = await fetch(`/api/play/${slug}/state`, {
        method: "GET",
        cache: "no-store",
      });
      const payload = await readResponse(response, "Could not refresh state.");
      applyState(payload);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Refresh failed.");
      throw refreshError;
    }
  }

  function openView(targetView: PlayerView, taskId?: string | null) {
    const nextView = availableViews.includes(targetView) ? targetView : availableViews[0];
    setView(nextView);

    if (taskId) {
      setSelectedTaskId(taskId);
    }
  }

  function openPendingAction() {
    openView(state.pendingAction.targetView, state.pendingAction.taskId);
  }

  function getTeamLabel(teamId?: string | null) {
    if (!teamId) {
      return "Team";
    }

    return state.teams.find((team) => team.id === teamId)?.name ?? "Team";
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
          applyState(payload);
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

  useEffect(() => {
    if (!availableViews.includes(view)) {
      setView(availableViews[0]);
    }
  }, [availableViews, view]);

  useEffect(() => {
    if (!selectedTask && !showInitialTeamSetup) {
      return;
    }

    const scrollY = window.scrollY;
    const bodyStyle = document.body.style;
    const htmlStyle = document.documentElement.style;
    const previous = {
      bodyPosition: bodyStyle.position,
      bodyTop: bodyStyle.top,
      bodyLeft: bodyStyle.left,
      bodyRight: bodyStyle.right,
      bodyWidth: bodyStyle.width,
      bodyOverflow: bodyStyle.overflow,
      htmlOverflow: htmlStyle.overflow,
    };

    document.body.dataset.scrollLocked = "true";
    bodyStyle.position = "fixed";
    bodyStyle.top = `-${scrollY}px`;
    bodyStyle.left = "0";
    bodyStyle.right = "0";
    bodyStyle.width = "100%";
    bodyStyle.overflow = "hidden";
    htmlStyle.overflow = "hidden";

    return () => {
      bodyStyle.position = previous.bodyPosition;
      bodyStyle.top = previous.bodyTop;
      bodyStyle.left = previous.bodyLeft;
      bodyStyle.right = previous.bodyRight;
      bodyStyle.width = previous.bodyWidth;
      bodyStyle.overflow = previous.bodyOverflow;
      htmlStyle.overflow = previous.htmlOverflow;
      delete document.body.dataset.scrollLocked;
      window.scrollTo(0, scrollY);
    };
  }, [selectedTask, showInitialTeamSetup]);

  useEffect(() => {
    setOpponentTeamId("");
    setNote("");
    setRatingStars(0);

    if (!selectedTask) {
      return;
    }

    if (activeChallenge && activeChallenge.taskId === selectedTask.taskId) {
      if (activeChallenge.status === "open") {
        setTaskSheetMode("result");
        return;
      }

      if (activeChallenge.canRateByMe) {
        setTaskSheetMode("rating");
        return;
      }
    }

    if (!activeChallenge && selectedTask.canChallenge) {
      setTaskSheetMode("challenge");
      return;
    }

    setTaskSheetMode("details");
  }, [selectedTaskId, activeChallenge?.id, activeChallenge?.status, activeChallenge?.taskId, activeChallenge?.canRateByMe]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setBirthdayMode(window.localStorage.getItem(birthdayModeStorageKey) === "on");
    setBirthdayModeReady(true);
    setPortalRoot(document.body);
  }, [birthdayModeStorageKey]);

  useEffect(() => {
    if (!birthdayModeReady || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(birthdayModeStorageKey, birthdayMode ? "on" : "off");
  }, [birthdayMode, birthdayModeReady, birthdayModeStorageKey]);

  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;

    if (birthdayMode) {
      body.dataset.playerTheme = "birthday";
      html.dataset.playerTheme = "birthday";
    } else {
      delete body.dataset.playerTheme;
      delete html.dataset.playerTheme;
    }

    return () => {
      delete body.dataset.playerTheme;
      delete html.dataset.playerTheme;
    };
  }, [birthdayMode]);

  function toggleBirthdayMode() {
    setBirthdayMode((current) => !current);
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
    if (!selectedTask || !selectedOpponent || !selectedOpponent.canChallenge) {
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
          opponentTeamId: selectedOpponent.teamId,
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
    status?: "resolved" | "failed" | "cancelled";
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

      setMessage(
        input?.status === "cancelled"
          ? "Challenge cancelled."
          : input?.status === "failed"
            ? "Challenge marked as failed."
            : "Result submitted.",
      );
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

  async function handleShareRecap() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${state.event.title} recap`,
          text: state.eventRecap.shareText,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(state.eventRecap.shareText);
        setMessage("Recap summary copied.");
      }
    } catch {
      setError("Could not share the recap right now.");
    }
  }

  function renderBoardView() {
    const boardIsReadOnly = state.event.status === "ended";

    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-ink/45">Task board</p>
            <h3 className="mt-2 text-xl font-semibold text-ink">
              {boardIsReadOnly ? "Your final board" : "Choose the next challenge"}
            </h3>
            <p className="mt-2 text-sm text-ink/65">
              {boardIsReadOnly
                ? "The game is finished, so tasks are view-only now. Open any card to remember what it was about and see how far your team got."
                : "Tap any card to compare opponents, read the full task, or continue the active challenge."}
            </p>
          </div>
          <Badge tone="default">{state.board.length} cards</Badge>
        </div>
        <div className="grid min-w-0 grid-cols-4 gap-2 md:gap-3">
          {state.board.map((card, index) => (
            <BoardTile
              key={card.taskId}
              card={card}
              index={index}
              birthdayMode={birthdayMode}
              onClick={() => setSelectedTaskId(card.taskId)}
            />
          ))}
        </div>
      </div>
    );
  }

  function renderHistoryView() {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-ink/45">Match history</p>
            <h3 className="mt-2 text-xl font-semibold text-ink">Finished tasks your team has played</h3>
            <p className="mt-2 text-sm text-ink/65">
              Filter the resolved matches to scan wins, losses, and co-op attempts quickly on a phone screen.
            </p>
          </div>
          <Badge tone="default">{state.matchHistory.length} matches</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "wins", "losses", "co-op"] as HistoryFilter[]).map((filter) => (
            <button
              key={filter}
              type="button"
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                historyFilter === filter ? "bg-ink text-white" : "bg-ink/5 text-ink/60",
              )}
              onClick={() => setHistoryFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {historyItems.length === 0 ? (
            <p className="rounded-3xl bg-white/80 p-5 text-sm text-ink/65">
              No matches in this filter yet. Open a task from the board to begin.
            </p>
          ) : null}
          {historyItems.map((match) => (
            <div key={match.id} className="rounded-3xl bg-white/85 p-4 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-4">
                  {match.taskImageUrl ? (
                    <img
                      src={match.taskImageUrl}
                      alt={match.taskTitle}
                      className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-ink">{match.taskTitle}</p>
                      <Badge tone={historyResultTone(match.result)}>
                        {formatHistoryResultLabel(match.result)}
                      </Badge>
                      <Badge tone={match.taskType === "competitive" ? "accent" : "success"}>
                        {match.taskType}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-ink/65">
                      {match.wasChallenger ? "You challenged" : "You were challenged by"}{" "}
                      {match.opponentTeamName}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.22em] text-ink/45">
                      {new Date(match.createdAt).toLocaleString("en-GB")}
                      {match.resolvedAt
                        ? ` • finished ${new Date(match.resolvedAt).toLocaleString("en-GB")}`
                        : ""}
                    </p>
                  </div>
                </div>
                <Button type="button" tone="ghost" onClick={() => setSelectedTaskId(match.taskId)}>
                  Open task
                </Button>
              </div>
              {match.note ? (
                <p className="mt-4 rounded-2xl bg-ink/5 px-4 py-3 text-sm leading-6 text-ink/70">
                  {match.note}
                </p>
              ) : null}
              {match.myRating || match.opponentRating ? (
                <div className="mt-4 flex flex-wrap gap-3 text-sm text-ink/65">
                  <div className="rounded-2xl bg-ink/5 px-4 py-3">
                    Your rating: {match.myRating ? `${formatStars(match.myRating)} / 5` : "Not rated"}
                  </div>
                  <div className="rounded-2xl bg-ink/5 px-4 py-3">
                    Opponent rating: {match.opponentRating ? `${formatStars(match.opponentRating)} / 5` : "Not rated"}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderLeaderboardView() {
    return (
      <div className="space-y-3">
        {state.leaderboard.map((team, index) => (
          <div
            key={team.teamId}
            className={cn(
              "flex items-center justify-between rounded-3xl bg-ink/5 px-4 py-4",
              team.teamId === myTeamId ? "ring-2 ring-sea/30" : "",
            )}
          >
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-ink/45">#{index + 1}</p>
              <p className="text-lg font-semibold text-ink">{team.teamName}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <ProgressPill className={progressPillClasses("rank", "gold")}>
                  Gold {team.goldCount}
                </ProgressPill>
                <ProgressPill className={progressPillClasses("rank", "platinum")}>
                  Diamond {team.platinumCount}
                </ProgressPill>
              </div>
            </div>
            <p className="text-2xl font-semibold text-ink">{team.completedCount}</p>
          </div>
        ))}
      </div>
    );
  }

  function renderTeamView() {
    return (
      <div className="space-y-5">
        {state.team ? (
          <>
            <div className="rounded-3xl bg-ink/5 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Team</p>
              <h3 className="mt-2 text-2xl font-semibold text-ink">{state.team.name ?? state.team.autoName}</h3>
              <p className="mt-2 text-sm text-ink/60">
                Captain:{" "}
                {state.team.members.find((member) => member.id === state.team?.captainPlayerId)?.displayName}
              </p>
            </div>
            <div className="space-y-3">
              {state.team.members.map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded-2xl bg-white/80 px-4 py-3">
                  <p className="font-medium text-ink">{member.displayName}</p>
                  {member.isCaptain ? <Badge tone="accent">Captain</Badge> : null}
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="rounded-3xl bg-white/80 p-5 text-sm text-ink/65">You do not have a team yet.</p>
        )}
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
        ) : state.team ? (
          <p className="rounded-3xl bg-ink/5 p-4 text-sm text-ink/60">
            {teamNeedsName
              ? "Only the captain can choose the team name."
              : "Team name is locked in for the rest of the game."}
          </p>
        ) : null}
      </div>
    );
  }

  function renderRecapView() {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
          <div className="rounded-3xl bg-ink p-5 text-white">
            <p className="text-xs uppercase tracking-[0.24em] text-white/60">Final recap</p>
            <h3 className="mt-2 text-2xl font-semibold">Podium and standout stats</h3>
            <p className="mt-2 text-sm text-white/75">
              The game is over. Here is the podium, the awards, and the event numbers that mattered.
            </p>
            <div className="mt-5 space-y-3">
              {state.eventRecap.podium.map((team, index) => (
                <div
                  key={team.teamId}
                  className={cn(
                    "rounded-3xl border border-white/10 px-4 py-4",
                    index === 0 ? "bg-white/10" : "bg-white/5",
                  )}
                >
                  <p className="text-xs uppercase tracking-[0.22em] text-white/55">#{index + 1}</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-lg font-semibold [overflow-wrap:anywhere]">{team.teamName}</p>
                      <p className="mt-1 text-sm text-white/70">
                        Gold {team.goldCount} · Diamond {team.platinumCount}
                      </p>
                    </div>
                    <p className="text-2xl font-semibold">{team.completedCount}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl bg-white/80 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.24em] text-ink/45">Share card</p>
            <h3 className="mt-2 break-words text-xl font-semibold text-ink [overflow-wrap:anywhere]">
              {state.teamRecap ? `${state.teamRecap.teamName} finished #${state.teamRecap.finalRank ?? "-"}` : "Final standings"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-ink/65">{state.eventRecap.shareText}</p>
            {state.teamRecap ? (
              <div className="mt-4 grid grid-cols-3 gap-3">
                <MiniStat label="Completed" value={`${state.teamRecap.completedCount}`} />
                <MiniStat label="Gold" value={`${state.teamRecap.goldCount}`} />
                <MiniStat label="Diamond" value={`${state.teamRecap.platinumCount}`} />
              </div>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={handleShareRecap}>Share summary</Button>
              <Button tone="ghost" onClick={() => openView("leaderboard")}>
                Full leaderboard
              </Button>
              {state.team ? (
                <Button tone="ghost" onClick={() => openView("history")}>
                  Match history
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {state.eventRecap.numbers.map((item) => (
            <MiniStat key={item.label} label={item.label} value={item.value} detail={item.detail} />
          ))}
        </div>

        {state.teamRecap ? (
          <div className="rounded-3xl bg-ink/5 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-ink/45">Your team</p>
                <h3 className="mt-2 break-words text-xl font-semibold text-ink [overflow-wrap:anywhere]">
                  {state.teamRecap.teamName}
                </h3>
                <p className="mt-2 text-sm text-ink/65">
                  Rank #{state.teamRecap.finalRank ?? "-"} · {state.teamRecap.resolvedChallenges} resolved plays
                </p>
              </div>
              {state.teamRecap.averageRatingGiven !== null ? (
                <div className="rounded-2xl bg-white/80 px-4 py-3 text-sm text-ink/65">
                  Avg rating given {formatStars(state.teamRecap.averageRatingGiven)} / 5
                </div>
              ) : null}
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniStat label="Competitive wins" value={`${state.teamRecap.competitiveWins}`} />
              <MiniStat label="Competitive losses" value={`${state.teamRecap.competitiveLosses}`} />
              <MiniStat label="Co-op clears" value={`${state.teamRecap.cooperativeSuccesses}`} />
              <MiniStat label="Co-op failures" value={`${state.teamRecap.cooperativeFailures}`} />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {state.teamRecap.mostReplayedTask ? (
                <MiniStat
                  label="Most replayed"
                  value={state.teamRecap.mostReplayedTask.taskTitle}
                  detail={`${state.teamRecap.mostReplayedTask.value} · ${state.teamRecap.mostReplayedTask.detail}`}
                />
              ) : null}
              {state.teamRecap.favoriteTask ? (
                <MiniStat
                  label="Favorite task"
                  value={state.teamRecap.favoriteTask.taskTitle}
                  detail={`${state.teamRecap.favoriteTask.value} · ${state.teamRecap.favoriteTask.detail}`}
                />
              ) : null}
              {state.teamRecap.toughestTask ? (
                <MiniStat
                  label="Toughest task"
                  value={state.teamRecap.toughestTask.taskTitle}
                  detail={`${state.teamRecap.toughestTask.value} · ${state.teamRecap.toughestTask.detail}`}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-3xl bg-white/80 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.24em] text-ink/45">Team awards</p>
            <div className="mt-4 space-y-3">
              {state.eventRecap.teamAwards.length === 0 ? (
                <p className="text-sm text-ink/60">Not enough finished data for team awards yet.</p>
              ) : null}
              {state.eventRecap.teamAwards.map((award) => (
                <div key={award.kind} className="rounded-3xl bg-ink/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-ink/45">{award.label}</p>
                  <p className="mt-2 break-words text-lg font-semibold text-ink [overflow-wrap:anywhere]">
                    {award.teamName}
                  </p>
                  <p className="mt-1 text-sm font-medium text-ink/75">{award.value}</p>
                  <p className="mt-2 text-sm leading-6 text-ink/60">{award.detail}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl bg-white/80 p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.24em] text-ink/45">Task awards</p>
            <div className="mt-4 space-y-3">
              {state.eventRecap.taskAwards.map((award) => (
                <div key={award.kind} className="rounded-3xl bg-ink/5 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-ink/45">{award.label}</p>
                  <p className="mt-2 break-words text-lg font-semibold text-ink [overflow-wrap:anywhere]">
                    {award.taskTitle}
                  </p>
                  <p className="mt-1 text-sm font-medium text-ink/75">{award.value}</p>
                  <p className="mt-2 text-sm leading-6 text-ink/60">{award.detail}</p>
                </div>
              ))}
              {state.eventRecap.rivalryAward ? (
                <div className="rounded-3xl bg-sea/8 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-sea/80">{state.eventRecap.rivalryAward.label}</p>
                  <p className="mt-2 break-words text-lg font-semibold text-ink [overflow-wrap:anywhere]">
                    {state.eventRecap.rivalryAward.matchup}
                  </p>
                  <p className="mt-1 text-sm font-medium text-ink/75">{state.eventRecap.rivalryAward.value}</p>
                  <p className="mt-2 text-sm leading-6 text-ink/60">{state.eventRecap.rivalryAward.detail}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderMainContent() {
    if (view === "board") {
      return renderBoardView();
    }

    if (view === "history") {
      return renderHistoryView();
    }

    if (view === "leaderboard") {
      return renderLeaderboardView();
    }

    if (view === "team") {
      return renderTeamView();
    }

    return renderRecapView();
  }

  return (
    <div className="relative isolate space-y-5 pb-24 md:pb-0">
      {birthdayMode ? (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -left-16 top-4 h-52 w-52 rounded-full bg-fuchsia-400/35 blur-3xl" />
          <div className="absolute right-0 top-16 h-60 w-60 rounded-full bg-amber-300/35 blur-3xl" />
          <div className="absolute bottom-14 left-10 h-52 w-52 rounded-full bg-cyan-300/30 blur-3xl" />
          <div className="absolute bottom-0 right-10 h-56 w-56 rounded-full bg-rose-300/30 blur-3xl" />
          {BIRTHDAY_CONFETTI_PIECES.map((piece, index) => (
            <span key={index} className={cn("absolute", piece)} />
          ))}
        </div>
      ) : null}

      <Panel className={cn("overflow-hidden", birthdayHeroPanelClass)}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <Badge tone="accent">{state.event.status.replace("_", " ")}</Badge>
            {birthdayMode ? (
              <div className="inline-flex rounded-full bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-fuchsia-700 shadow-sm ring-1 ring-fuchsia-200/70">
                Birthday mode
              </div>
            ) : null}
            <SectionHeading
              eyebrow="Live event"
              title={state.event.title}
              description={
                state.team
                  ? `${titleTeam} is ready.`
                  : "You are registered. Teams and live actions will appear automatically when the event is ready."
              }
            />
          </div>
          <div
            className={cn(
              "rounded-3xl bg-ink p-4 text-white shadow-panel",
              birthdayMode
                ? "bg-[linear-gradient(135deg,#ec4899,#f97316,#facc15,#06b6d4)] text-white ring-2 ring-white/65"
                : "",
            )}
          >
            <p className="text-xs uppercase tracking-[0.24em] text-white/65">You</p>
            <p className="mt-2 text-lg font-semibold">{state.me.displayName}</p>
            <p className="text-sm text-white/75">{state.me.isCaptain ? "Captain" : "Team member"}</p>
            <div className="mt-4">
              <PlayerSignOutButton redirectTo="/" tone="secondary" />
            </div>
          </div>
        </div>

        <div
          className={cn(
            "mt-6 rounded-3xl p-4",
            birthdayMode
              ? "bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(253,242,248,0.92),rgba(254,249,195,0.9))] ring-1 ring-fuchsia-200/65"
              : "bg-ink/5",
          )}
        >
          <div className="flex flex-wrap items-center gap-3 text-sm text-ink/70">
            <span>{birthdayMode ? "Secret mode" : "Join code"}</span>
            <button
              type="button"
              className="group"
              onClick={toggleBirthdayMode}
              aria-pressed={birthdayMode}
              aria-label={birthdayMode ? "Disable birthday mode" : "Enable birthday mode"}
            >
              <JoinCodeBadge
                code={state.event.joinCode}
                className={cn(
                  "cursor-pointer transition group-hover:scale-[1.03] group-focus-visible:outline-none",
                  birthdayMode
                    ? "bg-[linear-gradient(135deg,#ec4899,#f97316,#facc15,#06b6d4)] text-white shadow-[0_12px_26px_rgba(236,72,153,0.34)] ring-2 ring-white/70"
                    : "hover:bg-ink/90",
                )}
              />
            </button>
            {birthdayMode ? (
              <span className="inline-flex rounded-full bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-700 ring-1 ring-fuchsia-200/70">
                Party on
              </span>
            ) : null}
          </div>
          {birthdayMode ? (
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-700/85">
              Tap the code again if you want to calm the colors down.
            </p>
          ) : null}
        </div>
      </Panel>

      {message ? <p className="rounded-2xl bg-mint/15 px-4 py-3 text-sm text-ink">{message}</p> : null}
      {error ? <p className="rounded-2xl bg-coral/15 px-4 py-3 text-sm text-coral">{error}</p> : null}

      <Panel
        className={cn(
          "border-sea/15 bg-gradient-to-br from-white via-white to-sea/10",
          birthdayAccentPanelClass,
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className={cn("text-xs uppercase tracking-[0.24em] text-sea/80", birthdayMode ? "text-fuchsia-700" : "")}>
              What happens now
            </p>
            <h3 className="mt-2 text-xl font-semibold text-ink">{state.pendingAction.title}</h3>
            <p className="mt-2 text-sm leading-6 text-ink/65">{state.pendingAction.description}</p>
          </div>
          <Button onClick={openPendingAction}>{state.pendingAction.ctaLabel}</Button>
        </div>
      </Panel>

      {activeChallenge ? (
        <Panel className={cn("border-sea/15 bg-sea/8", birthdayAccentPanelClass)}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className={cn("text-xs uppercase tracking-[0.24em] text-sea/80", birthdayMode ? "text-fuchsia-700" : "")}>
                Active challenge
              </p>
              <h3 className="mt-2 text-xl font-semibold text-ink">{activeChallenge.taskTitle}</h3>
              <p className="mt-2 text-sm text-ink/65">
                {getTeamLabel(activeChallenge.challengerTeamId)} vs {getTeamLabel(activeChallenge.opponentTeamId)}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button tone="secondary" onClick={() => setSelectedTaskId(activeChallenge.taskId)}>
                Open active task
              </Button>
              <Button tone="ghost" onClick={() => openView("history")}>
                History
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}

      {state.event.status !== "live" && state.event.status !== "ended" ? (
        <Panel className={birthdayAccentPanelClass}>
          <SectionHeading
            eyebrow="Lobby"
            title="Waiting for the start"
            description="Keep this page open. Teams, tasks, and challenge actions will appear automatically when the game starts."
          />
          {state.team ? (
            <div className="mt-6 rounded-3xl bg-sea/8 p-4">
              <p className="text-sm text-ink/70">Assigned team</p>
              <p className="mt-1 text-xl font-semibold text-ink">{state.team.name ?? state.team.autoName}</p>
            </div>
          ) : null}
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-ink/55">Current leaderboard</h3>
            {renderLeaderboardView()}
          </div>
        </Panel>
      ) : state.event.status === "live" && !state.team ? (
        <Panel className={birthdayAccentPanelClass}>
          <SectionHeading
            eyebrow="Team assignment"
            title="Waiting for your team"
            description="You are in the live event, but your team is not visible yet. It should appear automatically as soon as the assignment reaches your device."
          />
          <div className="mt-6 space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-ink/55">Current leaderboard</h3>
            {renderLeaderboardView()}
          </div>
        </Panel>
      ) : (
        <>
          <ViewTabs availableViews={availableViews} view={view} onSelect={setView} birthdayMode={birthdayMode} />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
            <Panel className={cn("min-w-0", birthdayAccentPanelClass)}>{renderMainContent()}</Panel>
            <Panel className={cn("hidden lg:block", birthdayAccentPanelClass)}>
              <SectionHeading
                eyebrow={state.event.status === "ended" ? "Final standings" : "Live standings"}
                title={state.event.status === "ended" ? "Where teams finished" : "Where teams stand"}
                description={
                  state.event.status === "ended"
                    ? "Completed tasks remain the main ranking metric after the event ends."
                    : "Keep an eye on the ranking while you move between tasks."
                }
              />
              <div className="mt-5 space-y-3">{renderLeaderboardView()}</div>
            </Panel>
          </div>
          <MobileBottomNav
            availableViews={availableViews}
            view={view}
            onSelect={setView}
            birthdayMode={birthdayMode}
          />
        </>
      )}

      {selectedTask && portalRoot
        ? createPortal(
            <div
              className={cn(
                "fixed inset-0 z-40 overflow-hidden bg-ink/45 p-2 sm:flex sm:items-center sm:justify-center sm:p-6",
                birthdayMode ? "bg-fuchsia-950/35" : "",
              )}
            >
              <div
                className={cn(
                  "flex h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-[1.75rem] bg-mist shadow-panel sm:max-h-[92vh] sm:max-w-3xl sm:rounded-[2rem]",
                  birthdayMode
                    ? "border border-fuchsia-200/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(253,242,248,0.96),rgba(254,249,195,0.88),rgba(224,231,255,0.9))] shadow-[0_24px_70px_rgba(236,72,153,0.25)]"
                    : "",
                )}
              >
                <div
                  className={cn(
                    "sticky top-0 z-10 border-b border-ink/5 bg-mist px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)] sm:px-6 sm:pt-6",
                    birthdayMode ? "bg-white/70 backdrop-blur" : "",
                  )}
                >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <Badge tone={selectedTask.type === "competitive" ? "accent" : "success"}>
                    {selectedTask.type}
                  </Badge>
                  <h3 className="mt-3 break-words text-2xl font-semibold text-ink [overflow-wrap:anywhere]">
                    {selectedTask.title}
                  </h3>
                  <p className="mt-2 text-sm text-ink/60">{selectedTask.shortDescription}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 self-start">
                  {activeChallenge && activeChallenge.taskId === selectedTask.taskId && activeChallenge.canCancelByMe ? (
                    <Button
                      tone="danger"
                      onClick={() => {
                        if (!window.confirm("Are you sure you want to cancel this challenge for both teams?")) {
                          return;
                        }

                        handleResolveChallenge({ status: "cancelled" });
                      }}
                      disabled={busyAction === "resolve"}
                    >
                      {busyAction === "resolve" ? "Cancelling..." : "Cancel"}
                    </Button>
                  ) : null}
                  <Button tone="ghost" onClick={() => setSelectedTaskId(null)}>
                    Close
                  </Button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {taskSheetModes.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-semibold transition",
                      taskSheetMode === mode
                        ? birthdayMode
                          ? "bg-[linear-gradient(135deg,#ec4899,#f97316,#facc15)] text-white shadow-[0_8px_18px_rgba(236,72,153,0.2)]"
                          : "bg-ink text-white"
                        : birthdayMode
                          ? "bg-white/80 text-fuchsia-900/75 ring-1 ring-fuchsia-200/70"
                          : "bg-ink/5 text-ink/60",
                    )}
                    onClick={() => setTaskSheetMode(mode)}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-32 pt-4 sm:px-6">
              <div className="space-y-4">
                <div className="rounded-3xl bg-white/80 p-5">
                  {selectedTask.imageUrl ? (
                    <img
                      src={selectedTask.imageUrl}
                      alt={selectedTask.title}
                      className="h-52 w-full rounded-3xl object-cover sm:h-64"
                    />
                  ) : null}
                  <div className={selectedTask.imageUrl ? "mt-4" : ""}>
                    <MarkdownContent content={selectedTask.fullDescription} className="text-ink/80" />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <ProgressPill className={progressPillClasses("rank", selectedTask.completionTier)}>
                      {selectedTask.completionTier === "none"
                        ? "Open"
                        : `Rank ${formatTierLabel(selectedTask.completionTier)}`}
                    </ProgressPill>
                    <ProgressPill className={progressPillClasses("win")}>
                      Wins {selectedTask.winCount}
                    </ProgressPill>
                    <ProgressPill className={progressPillClasses("loss")}>
                      Losses {selectedTask.lossCount}
                    </ProgressPill>
                  </div>
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
                  <p className="rounded-2xl bg-gold/15 px-4 py-3 text-sm text-ink/75">
                    Your next attempt on this task cannot be against{" "}
                    {getTeamLabel(selectedTask.lastLossOpponentTeamId)}.
                  </p>
                ) : null}

                {taskSheetMode === "challenge" ? (
                  <div className="space-y-4 rounded-3xl bg-white/80 p-5">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Opponent cards</p>
                      <h4 className="mt-2 text-lg font-semibold text-ink">Pick the right matchup</h4>
                    </div>
                    <div className="space-y-3">
                      {selectedTask.opponentOptions.map((team) => (
                        <button
                          key={team.teamId}
                          type="button"
                          className={cn(
                            "w-full rounded-3xl border px-4 py-4 text-left transition",
                            opponentTeamId === team.teamId
                              ? "border-sea bg-sea/8"
                              : "border-ink/10 bg-white hover:bg-ink/5",
                          )}
                          onClick={() => setOpponentTeamId(team.teamId)}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-xs uppercase tracking-[0.22em] text-ink/45">
                                {team.leaderboardRank ? `#${team.leaderboardRank}` : "Unranked"}
                              </p>
                              <p className="mt-2 text-lg font-semibold text-ink">{team.teamName}</p>
                              <p className="mt-2 text-sm text-ink/65">
                                This task: {formatTierLabel(team.completionTier)}
                              </p>
                            </div>
                            {team.canChallenge ? (
                              <Badge tone="success">Ready</Badge>
                            ) : (
                              <Badge tone="warning">Unavailable</Badge>
                            )}
                          </div>
                          {team.reason ? (
                            <p className="mt-3 text-sm leading-6 text-ink/60">{team.reason}</p>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {taskSheetMode === "result" && activeChallenge && activeChallenge.taskId === selectedTask.taskId ? (
                  <div className="space-y-4 rounded-3xl bg-sea/8 p-5">
                    <h4 className="text-lg font-semibold text-ink">Submit result</h4>
                    <p className="text-sm text-ink/65">
                      {getTeamLabel(activeChallenge.challengerTeamId)} vs{" "}
                      {getTeamLabel(activeChallenge.opponentTeamId)}
                    </p>
                    {activeChallenge.isResolvableByMe ? (
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
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Button
                              className="bg-mint text-ink hover:bg-mint/90"
                              onClick={() => handleResolveChallenge({ status: "resolved" })}
                              disabled={busyAction === "resolve"}
                            >
                              {busyAction === "resolve" ? "Submitting..." : "Completed"}
                            </Button>
                            <Button
                              tone="danger"
                              onClick={() => handleResolveChallenge({ status: "failed" })}
                              disabled={busyAction === "resolve"}
                            >
                              {busyAction === "resolve" ? "Submitting..." : "Failed"}
                            </Button>
                          </div>
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
                    )}
                  </div>
                ) : null}

                {taskSheetMode === "rating" && activeChallenge && activeChallenge.taskId === selectedTask.taskId ? (
                  <div className="space-y-4 rounded-3xl bg-sea/8 p-5">
                    <h4 className="text-lg font-semibold text-ink">Rate this task</h4>
                    {activeChallenge.canRateByMe ? (
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
                      </>
                    ) : (
                      <p className="rounded-2xl bg-white/75 px-4 py-3 text-sm text-ink/65">
                        Waiting for the other team to finish its rating first.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

                <div
                  className={cn(
                    "sticky bottom-0 border-t border-ink/5 bg-mist/95 px-4 py-4 backdrop-blur sm:px-6",
                    birthdayMode ? "bg-white/70" : "",
                  )}
                >
              {taskSheetMode === "details" ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-ink/60">
                    {activeChallenge && activeChallenge.taskId === selectedTask.taskId
                      ? activeChallenge.status === "open"
                        ? "Move to the result step when you are ready to submit."
                        : activeChallenge.canRateByMe
                          ? "Move to the rating step to finish the flow."
                          : "This task is waiting on the other team."
                      : selectedTask.canChallenge
                        ? "Compare the opponent cards and start the next challenge."
                        : "This task is view-only right now."}
                  </p>
                  {taskSheetModes.length > 1 ? (
                    <Button
                      tone="secondary"
                      onClick={() => setTaskSheetMode(taskSheetModes[1])}
                    >
                      {taskSheetModes[1] === "challenge"
                        ? "Pick opponent"
                        : taskSheetModes[1] === "result"
                          ? "Submit result"
                          : "Rate task"}
                    </Button>
                  ) : null}
                </div>
              ) : taskSheetMode === "challenge" ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-ink/60">
                    {selectedOpponent?.reason ?? "Choose one opponent card to create the challenge."}
                  </p>
                  <Button
                    onClick={handleCreateChallenge}
                    disabled={!selectedOpponent?.canChallenge || busyAction === "challenge"}
                  >
                    {busyAction === "challenge" ? "Creating..." : "Create challenge"}
                  </Button>
                </div>
              ) : taskSheetMode === "rating" ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-ink/60">Submit a rating so your team can move on.</p>
                  <Button onClick={handleRateChallenge} disabled={busyAction === "rate" || ratingStars < 1}>
                    {busyAction === "rate" ? "Saving..." : "Submit rating"}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-ink/60">
                  Choose the final result above, and add a note if you want more context in history.
                </p>
              )}
                </div>
              </div>
            </div>,
            portalRoot,
          )
        : null}

      {showInitialTeamSetup && state.team && portalRoot
        ? createPortal(
            <div
              className={cn(
                "fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/55 p-4 sm:p-6",
                birthdayMode ? "bg-fuchsia-950/35" : "",
              )}
            >
              <div
                className={cn(
                  "max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-mist p-5 shadow-panel sm:max-h-[calc(100dvh-3rem)] sm:p-6",
                  birthdayMode
                    ? "border border-fuchsia-200/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(253,242,248,0.96),rgba(254,249,195,0.88),rgba(224,231,255,0.9))] shadow-[0_24px_70px_rgba(236,72,153,0.25)]"
                    : "",
                )}
              >
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
            </div>,
            portalRoot,
          )
        : null}
    </div>
  );
}
