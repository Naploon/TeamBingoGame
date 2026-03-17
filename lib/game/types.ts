export type GameStatus = "draft" | "registration_open" | "live" | "ended";
export type TaskType = "competitive" | "cooperative";
export type ChallengeStatus = "open" | "resolved" | "failed" | "cancelled";
export type CompletionTier = "none" | "base" | "gold" | "platinum";
export type CompletionSource = "none" | "win" | "loss_protection" | "cooperative";
export type PlayerViewId = "board" | "history" | "leaderboard" | "team" | "recap";

export interface TeamSeedInput {
  id: string;
}

export interface PlayerSeedInput {
  id: string;
  displayName: string;
}

export interface TaskSeedInput {
  id: string;
  type: TaskType;
}

export interface ChallengeEngineInput {
  id: string;
  taskId: string;
  challengerTeamId: string;
  opponentTeamId: string;
  type: TaskType;
  status: ChallengeStatus;
  winnerTeamId: string | null;
  createdAt: string | Date;
  resolvedAt?: string | Date | null;
}

export interface BoardAssignment {
  teamId: string;
  taskId: string;
  boardPosition: number;
}

export interface ComputedTeamTaskState extends BoardAssignment {
  completionTier: CompletionTier;
  completionSource: CompletionSource;
  winCount: number;
  lossCount: number;
  lastLossOpponentTeamId: string | null;
}

export interface LeaderboardRow {
  teamId: string;
  teamName: string;
  completedCount: number;
  goldCount: number;
  platinumCount: number;
}

export interface BoardOpponentOption {
  teamId: string;
  teamName: string;
  leaderboardRank: number | null;
  completionTier: CompletionTier;
  isNameLocked: boolean;
  isBlockedAfterLoss: boolean;
  canChallenge: boolean;
  reason: string | null;
}

export interface PlayerBoardCard {
  taskId: string;
  boardPosition: number;
  title: string;
  shortDescription: string;
  fullDescription: string;
  imageUrl: string | null;
  type: TaskType;
  completionTier: CompletionTier;
  completionSource: CompletionSource;
  winCount: number;
  lossCount: number;
  lastLossOpponentTeamId: string | null;
  ratingAverage: number | null;
  ratingCount: number;
  canChallenge: boolean;
  isActiveChallengeTask: boolean;
  opponentOptions: BoardOpponentOption[];
}

export interface PendingAction {
  kind:
    | "wait_for_start"
    | "wait_for_team"
    | "lock_team_name"
    | "wait_for_captain"
    | "open_active_challenge"
    | "submit_result"
    | "rate_task"
    | "wait_for_rating"
    | "view_recap"
    | "start_next_challenge";
  title: string;
  description: string;
  ctaLabel: string;
  targetView: PlayerViewId;
  taskId: string | null;
}

export interface GameNumberStat {
  label: string;
  value: string;
  detail?: string;
}

export interface TeamAward {
  kind: "most_active" | "most_successful" | "roughest_night" | "diamond_hunters";
  label: string;
  teamId: string;
  teamName: string;
  value: string;
  detail: string;
}

export interface TaskAward {
  kind: "favorite_task" | "most_replayed_task" | "hardest_task";
  label: string;
  taskId: string;
  taskTitle: string;
  taskType: TaskType;
  value: string;
  detail: string;
}

export interface RivalryAward {
  label: string;
  teamIds: [string, string];
  matchup: string;
  value: string;
  detail: string;
}

export interface TeamRecapTaskSummary {
  taskId: string;
  taskTitle: string;
  taskType: TaskType;
  value: string;
  detail: string;
}

export interface TeamRecap {
  teamId: string;
  teamName: string;
  finalRank: number | null;
  completedCount: number;
  goldCount: number;
  platinumCount: number;
  resolvedChallenges: number;
  competitiveWins: number;
  competitiveLosses: number;
  cooperativeSuccesses: number;
  cooperativeFailures: number;
  averageRatingGiven: number | null;
  mostReplayedTask: TeamRecapTaskSummary | null;
  favoriteTask: TeamRecapTaskSummary | null;
  toughestTask: TeamRecapTaskSummary | null;
}

export interface EventRecap {
  podium: LeaderboardRow[];
  myTeamRank: number | null;
  totalTeams: number;
  numbers: GameNumberStat[];
  teamAwards: TeamAward[];
  taskAwards: TaskAward[];
  rivalryAward: RivalryAward | null;
  shareText: string;
}
