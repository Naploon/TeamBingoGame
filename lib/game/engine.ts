import type {
  BoardAssignment,
  ChallengeEngineInput,
  ComputedTeamTaskState,
  CompletionSource,
  CompletionTier,
  LeaderboardRow,
  PlayerSeedInput,
  TaskSeedInput,
} from "@/lib/game/types";

function mulberry32(seed: number) {
  return () => {
    let cursor = (seed += 0x6d2b79f5);
    cursor = Math.imul(cursor ^ (cursor >>> 15), cursor | 1);
    cursor ^= cursor + Math.imul(cursor ^ (cursor >>> 7), cursor | 61);
    return ((cursor ^ (cursor >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], seed: number) {
  const result = [...items];
  const random = mulberry32(seed);

  for (let cursor = result.length - 1; cursor > 0; cursor -= 1) {
    const swapIndex = Math.floor(random() * (cursor + 1));
    [result[cursor], result[swapIndex]] = [result[swapIndex], result[cursor]];
  }

  return result;
}

function tierFromWins(winCount: number): CompletionTier {
  if (winCount >= 3) {
    return "platinum";
  }

  if (winCount >= 2) {
    return "gold";
  }

  if (winCount >= 1) {
    return "base";
  }

  return "none";
}

function sourceFromState(
  winCount: number,
  lossCount: number,
  type: TaskSeedInput["type"],
): CompletionSource {
  if (type === "cooperative") {
    return "cooperative";
  }

  if (winCount >= 1) {
    return "win";
  }

  if (lossCount >= 3) {
    return "loss_protection";
  }

  return "none";
}

export function generateTeamPlan(players: PlayerSeedInput[], targetTeamSize: number, seed: number) {
  const shuffled = shuffle(players, seed);
  const teamCount = Math.max(2, Math.ceil(shuffled.length / targetTeamSize));
  const baseSize = Math.floor(shuffled.length / teamCount);
  const remainder = shuffled.length % teamCount;
  const teams = [];
  let cursor = 0;

  for (let index = 0; index < teamCount; index += 1) {
    const size = baseSize + (index < remainder ? 1 : 0);
    const members = shuffled.slice(cursor, cursor + size);
    cursor += size;

    teams.push({
      autoName: `Squad ${index + 1}`,
      playerIds: members.map((player) => player.id),
      captainPlayerId: members[(seed + index * 13) % members.length]?.id ?? members[0]?.id,
    });
  }

  return teams;
}

export function generateBoardAssignments(teamIds: string[], taskIds: string[], seed: number) {
  const assignments: BoardAssignment[] = [];

  teamIds.forEach((teamId, index) => {
    const shuffledTaskIds = shuffle(taskIds, seed + (index + 1) * 97);
    shuffledTaskIds.forEach((taskId, boardPosition) => {
      assignments.push({
        teamId,
        taskId,
        boardPosition,
      });
    });
  });

  return assignments;
}

function applyCompetitiveWin(
  state: ComputedTeamTaskState,
  taskType: TaskSeedInput["type"],
) {
  state.winCount = Math.min(3, state.winCount + 1);
  state.lastLossOpponentTeamId = null;
  const computedTier = tierFromWins(state.winCount);
  if (computedTier !== "none") {
    state.completionTier = computedTier;
  }
  state.completionSource = sourceFromState(state.winCount, state.lossCount, taskType);
}

function applyCompetitiveLoss(state: ComputedTeamTaskState, winnerTeamId: string) {
  state.lossCount += 1;
  state.lastLossOpponentTeamId = winnerTeamId;

  if (state.completionTier === "none" && state.lossCount >= 3) {
    state.completionTier = "base";
  }

  if (state.winCount === 0 && state.lossCount >= 3) {
    state.completionSource = "loss_protection";
  }
}

function applyCooperativeCompletion(state: ComputedTeamTaskState) {
  if (state.completionTier === "none") {
    state.completionTier = "base";
  }
  state.completionSource = "cooperative";
  state.lastLossOpponentTeamId = null;
}

function taskStateKey(teamId: string, taskId: string) {
  return `${teamId}:${taskId}`;
}

export function recomputeTeamTaskStates(input: {
  assignments: BoardAssignment[];
  tasks: TaskSeedInput[];
  challenges: ChallengeEngineInput[];
}) {
  const taskTypeById = new Map(input.tasks.map((task) => [task.id, task.type]));
  const stateMap = new Map<string, ComputedTeamTaskState>();

  input.assignments.forEach((assignment) => {
    stateMap.set(taskStateKey(assignment.teamId, assignment.taskId), {
      ...assignment,
      completionTier: "none",
      completionSource: "none",
      winCount: 0,
      lossCount: 0,
      lastLossOpponentTeamId: null,
    });
  });

  const resolvedChallenges = input.challenges
    .filter((challenge) => challenge.status === "resolved")
    .sort((left, right) => {
      const leftDate = new Date(left.resolvedAt ?? left.createdAt).getTime();
      const rightDate = new Date(right.resolvedAt ?? right.createdAt).getTime();
      return leftDate - rightDate;
    });

  resolvedChallenges.forEach((challenge) => {
    const challengerState = stateMap.get(
      taskStateKey(challenge.challengerTeamId, challenge.taskId),
    );
    const opponentState = stateMap.get(taskStateKey(challenge.opponentTeamId, challenge.taskId));
    const taskType = taskTypeById.get(challenge.taskId);

    if (!challengerState || !opponentState || !taskType) {
      return;
    }

    if (challenge.type === "cooperative") {
      applyCooperativeCompletion(challengerState);
      applyCooperativeCompletion(opponentState);
      return;
    }

    if (!challenge.winnerTeamId) {
      return;
    }

    if (challenge.winnerTeamId === challenge.challengerTeamId) {
      applyCompetitiveWin(challengerState, taskType);
      applyCompetitiveLoss(opponentState, challenge.challengerTeamId);
      return;
    }

    if (challenge.winnerTeamId === challenge.opponentTeamId) {
      applyCompetitiveWin(opponentState, taskType);
      applyCompetitiveLoss(challengerState, challenge.opponentTeamId);
    }
  });

  return Array.from(stateMap.values());
}

export function buildLeaderboard(input: {
  teams: Array<{ id: string; teamName: string }>;
  states: ComputedTeamTaskState[];
}) {
  const byTeam = new Map<string, LeaderboardRow>();

  input.teams.forEach((team) => {
    byTeam.set(team.id, {
      teamId: team.id,
      teamName: team.teamName,
      completedCount: 0,
      goldCount: 0,
      platinumCount: 0,
    });
  });

  input.states.forEach((state) => {
    const row = byTeam.get(state.teamId);
    if (!row || state.completionTier === "none") {
      return;
    }

    row.completedCount += 1;
    if (state.completionTier === "gold") {
      row.goldCount += 1;
    }
    if (state.completionTier === "platinum") {
      row.platinumCount += 1;
    }
  });

  return Array.from(byTeam.values()).sort((left, right) => {
    if (right.completedCount !== left.completedCount) {
      return right.completedCount - left.completedCount;
    }

    return left.teamName.localeCompare(right.teamName);
  });
}
