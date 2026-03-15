export type GameStatus = "draft" | "registration_open" | "live" | "ended";
export type TaskType = "competitive" | "cooperative";
export type ChallengeStatus = "open" | "resolved" | "cancelled";
export type CompletionTier = "none" | "base" | "gold" | "platinum";
export type CompletionSource = "none" | "win" | "loss_protection" | "cooperative";

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

export interface PlayerBoardCard {
  taskId: string;
  boardPosition: number;
  title: string;
  shortDescription: string;
  fullDescription: string;
  type: TaskType;
  completionTier: CompletionTier;
  completionSource: CompletionSource;
  winCount: number;
  lossCount: number;
  lastLossOpponentTeamId: string | null;
}
