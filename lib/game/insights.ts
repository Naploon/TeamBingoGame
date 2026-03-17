import type {
  ChallengeEngineInput,
  ChallengeStatus,
  ComputedTeamTaskState,
  EventRecap,
  GameNumberStat,
  LeaderboardRow,
  RivalryAward,
  TaskAward,
  TaskType,
  TeamAward,
  TeamRecap,
  TeamRecapTaskSummary,
} from "@/lib/game/types";

interface InsightTeam {
  id: string;
  teamName: string;
}

interface InsightTask {
  id: string;
  title: string;
  type: TaskType;
}

interface InsightRating {
  challengeId: string;
  taskId: string;
  teamId: string;
  stars: number;
}

interface BuildRecapsInput {
  teams: InsightTeam[];
  tasks: InsightTask[];
  challenges: ChallengeEngineInput[];
  ratings: InsightRating[];
  states: ComputedTeamTaskState[];
  leaderboard: LeaderboardRow[];
  myTeamId: string | null;
  startedAt?: string | Date | null;
  endedAt?: string | Date | null;
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatAverage(value: number) {
  return Number.isInteger(value) ? `${value.toFixed(0)}` : value.toFixed(1);
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDuration(startedAt?: string | Date | null, endedAt?: string | Date | null) {
  if (!startedAt || !endedAt) {
    return null;
  }

  const milliseconds = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return null;
  }

  const totalMinutes = Math.round(milliseconds / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${minutes}m`;
}

function isResolvedStatus(status: ChallengeStatus) {
  return status === "resolved" || status === "failed";
}

function compareText(left: string, right: string) {
  return left.localeCompare(right);
}

function chooseTeamAward<T extends { teamId: string; teamName: string }>(
  candidates: T[],
  compare: (left: T, right: T) => number,
  rankByTeamId: Map<string, number>,
) {
  return [...candidates].sort((left, right) => {
    const comparison = compare(left, right);
    if (comparison !== 0) {
      return comparison;
    }

    const leftRank = rankByTeamId.get(left.teamId) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rankByTeamId.get(right.teamId) ?? Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return compareText(left.teamName, right.teamName);
  })[0] ?? null;
}

function chooseTaskAward<T extends { taskId: string; taskTitle: string }>(
  candidates: T[],
  compare: (left: T, right: T) => number,
) {
  return [...candidates].sort((left, right) => {
    const comparison = compare(left, right);
    if (comparison !== 0) {
      return comparison;
    }

    return compareText(left.taskTitle, right.taskTitle);
  })[0] ?? null;
}

function createTaskSummary(
  taskId: string,
  taskTitle: string,
  taskType: TaskType,
  value: string,
  detail: string,
): TeamRecapTaskSummary {
  return {
    taskId,
    taskTitle,
    taskType,
    value,
    detail,
  };
}

export function buildPlayerRecaps(input: BuildRecapsInput): {
  teamRecap: TeamRecap | null;
  eventRecap: EventRecap;
} {
  const teamNameById = new Map(input.teams.map((team) => [team.id, team.teamName]));
  const taskById = new Map(input.tasks.map((task) => [task.id, task]));
  const rankByTeamId = new Map(input.leaderboard.map((row, index) => [row.teamId, index + 1]));
  const leaderboardRowByTeamId = new Map(input.leaderboard.map((row) => [row.teamId, row]));
  const ratingsByTaskId = new Map<string, number[]>();
  const ratingsByTeamTaskId = new Map<string, number[]>();

  input.ratings.forEach((rating) => {
    const taskRatings = ratingsByTaskId.get(rating.taskId) ?? [];
    taskRatings.push(rating.stars);
    ratingsByTaskId.set(rating.taskId, taskRatings);

    const teamTaskKey = `${rating.teamId}:${rating.taskId}`;
    const teamTaskRatings = ratingsByTeamTaskId.get(teamTaskKey) ?? [];
    teamTaskRatings.push(rating.stars);
    ratingsByTeamTaskId.set(teamTaskKey, teamTaskRatings);
  });

  const resolvedChallenges = input.challenges.filter((challenge) => isResolvedStatus(challenge.status));
  const competitiveChallenges = resolvedChallenges.filter((challenge) => challenge.type === "competitive" && challenge.status === "resolved" && challenge.winnerTeamId);
  const cooperativeChallenges = resolvedChallenges.filter((challenge) => challenge.type === "cooperative");

  const teamStats = new Map<
    string,
    {
      teamId: string;
      teamName: string;
      resolvedChallenges: number;
      competitiveWins: number;
      competitiveLosses: number;
      competitiveMatches: number;
      cooperativeSuccesses: number;
      cooperativeFailures: number;
    }
  >();
  const teamTaskStats = new Map<
    string,
    {
      attempts: number;
      failures: number;
    }
  >();
  const taskStats = new Map<
    string,
    {
      taskId: string;
      taskTitle: string;
      taskType: TaskType;
      resolvedChallenges: number;
      teamParticipations: number;
      successfulParticipations: number;
    }
  >();
  const rivalryStats = new Map<
    string,
    {
      key: string;
      teamIds: [string, string];
      matchup: string;
      count: number;
    }
  >();

  input.teams.forEach((team) => {
    teamStats.set(team.id, {
      teamId: team.id,
      teamName: team.teamName,
      resolvedChallenges: 0,
      competitiveWins: 0,
      competitiveLosses: 0,
      competitiveMatches: 0,
      cooperativeSuccesses: 0,
      cooperativeFailures: 0,
    });
  });

  resolvedChallenges.forEach((challenge) => {
    const task = taskById.get(challenge.taskId);
    const challengerStats = teamStats.get(challenge.challengerTeamId);
    const opponentStats = teamStats.get(challenge.opponentTeamId);

    if (!task || !challengerStats || !opponentStats) {
      return;
    }

    const taskEntry = taskStats.get(challenge.taskId) ?? {
      taskId: task.id,
      taskTitle: task.title,
      taskType: task.type,
      resolvedChallenges: 0,
      teamParticipations: 0,
      successfulParticipations: 0,
    };
    taskEntry.resolvedChallenges += 1;
    taskEntry.teamParticipations += 2;

    challengerStats.resolvedChallenges += 1;
    opponentStats.resolvedChallenges += 1;

    const teamTaskKeys = [
      `${challenge.challengerTeamId}:${challenge.taskId}`,
      `${challenge.opponentTeamId}:${challenge.taskId}`,
    ];
    teamTaskKeys.forEach((key) => {
      const current = teamTaskStats.get(key) ?? { attempts: 0, failures: 0 };
      current.attempts += 1;
      teamTaskStats.set(key, current);
    });

    const rivalryTeamIds = [challenge.challengerTeamId, challenge.opponentTeamId].sort((left, right) =>
      compareText(teamNameById.get(left) ?? left, teamNameById.get(right) ?? right),
    ) as [string, string];
    const rivalryKey = rivalryTeamIds.join(":");
    const rivalry = rivalryStats.get(rivalryKey) ?? {
      key: rivalryKey,
      teamIds: rivalryTeamIds,
      matchup: `${teamNameById.get(rivalryTeamIds[0]) ?? "Team"} vs ${teamNameById.get(rivalryTeamIds[1]) ?? "Team"}`,
      count: 0,
    };
    rivalry.count += 1;
    rivalryStats.set(rivalryKey, rivalry);

    if (challenge.type === "competitive" && challenge.status === "resolved" && challenge.winnerTeamId) {
      challengerStats.competitiveMatches += 1;
      opponentStats.competitiveMatches += 1;
      taskEntry.successfulParticipations += 1;

      const losingTeamId =
        challenge.winnerTeamId === challenge.challengerTeamId
          ? challenge.opponentTeamId
          : challenge.challengerTeamId;
      const winnerStats = teamStats.get(challenge.winnerTeamId);
      const loserStats = teamStats.get(losingTeamId);

      if (winnerStats && loserStats) {
        winnerStats.competitiveWins += 1;
        loserStats.competitiveLosses += 1;

        const losingTaskKey = `${losingTeamId}:${challenge.taskId}`;
        const losingTaskStats = teamTaskStats.get(losingTaskKey);
        if (losingTaskStats) {
          losingTaskStats.failures += 1;
        }
      }

      taskStats.set(challenge.taskId, taskEntry);
      return;
    }

    if (challenge.type === "cooperative" && challenge.status === "resolved") {
      challengerStats.cooperativeSuccesses += 1;
      opponentStats.cooperativeSuccesses += 1;
      taskEntry.successfulParticipations += 2;
      taskStats.set(challenge.taskId, taskEntry);
      return;
    }

    if (challenge.type === "cooperative" && challenge.status === "failed") {
      challengerStats.cooperativeFailures += 1;
      opponentStats.cooperativeFailures += 1;
      teamTaskKeys.forEach((key) => {
        const current = teamTaskStats.get(key);
        if (current) {
          current.failures += 1;
        }
      });
      taskStats.set(challenge.taskId, taskEntry);
      return;
    }

    taskStats.set(challenge.taskId, taskEntry);
  });

  const teamAwards: TeamAward[] = [];

  const mostActive = chooseTeamAward(
    [...teamStats.values()].filter((team) => team.resolvedChallenges > 0),
    (left, right) => right.resolvedChallenges - left.resolvedChallenges,
    rankByTeamId,
  );
  if (mostActive) {
    teamAwards.push({
      kind: "most_active",
      label: "Most Active Team",
      teamId: mostActive.teamId,
      teamName: mostActive.teamName,
      value: `${mostActive.resolvedChallenges} plays`,
      detail: "Highest number of resolved challenges across the event.",
    });
  }

  const mostSuccessful = chooseTeamAward(
    [...teamStats.values()].filter((team) => team.competitiveMatches >= 3 && team.competitiveWins > 0),
    (left, right) => {
      if (right.competitiveWins !== left.competitiveWins) {
        return right.competitiveWins - left.competitiveWins;
      }

      const leftRate = left.competitiveWins / left.competitiveMatches;
      const rightRate = right.competitiveWins / right.competitiveMatches;
      return rightRate - leftRate;
    },
    rankByTeamId,
  );
  if (mostSuccessful) {
    const winRate = mostSuccessful.competitiveWins / mostSuccessful.competitiveMatches;
    teamAwards.push({
      kind: "most_successful",
      label: "Most Successful Team",
      teamId: mostSuccessful.teamId,
      teamName: mostSuccessful.teamName,
      value: `${mostSuccessful.competitiveWins} wins`,
      detail: `${formatPercent(winRate)} win rate across ${mostSuccessful.competitiveMatches} competitive matches.`,
    });
  }

  const roughestNight = chooseTeamAward(
    [...teamStats.values()].filter(
      (team) => team.competitiveLosses + team.cooperativeFailures > 0,
    ),
    (left, right) =>
      right.competitiveLosses +
      right.cooperativeFailures -
      (left.competitiveLosses + left.cooperativeFailures),
    rankByTeamId,
  );
  if (roughestNight) {
    const setbacks = roughestNight.competitiveLosses + roughestNight.cooperativeFailures;
    teamAwards.push({
      kind: "roughest_night",
      label: "Roughest Night",
      teamId: roughestNight.teamId,
      teamName: roughestNight.teamName,
      value: `${setbacks} setbacks`,
      detail: `${roughestNight.competitiveLosses} competitive losses and ${roughestNight.cooperativeFailures} co-op failures.`,
    });
  }

  const platinumByTeamId = new Map(
    input.states.reduce<Array<[string, number]>>((entries, state) => {
      if (state.completionTier !== "platinum") {
        return entries;
      }

      const current = entries.find((entry) => entry[0] === state.teamId);
      if (current) {
        current[1] += 1;
        return entries;
      }

      entries.push([state.teamId, 1]);
      return entries;
    }, []),
  );
  const diamondHunters = chooseTeamAward(
    [...teamStats.values()]
      .map((team) => ({
        ...team,
        platinumCount: platinumByTeamId.get(team.teamId) ?? 0,
      }))
      .filter((team) => team.platinumCount > 0),
    (left, right) => right.platinumCount - left.platinumCount,
    rankByTeamId,
  );
  if (diamondHunters && "platinumCount" in diamondHunters) {
    teamAwards.push({
      kind: "diamond_hunters",
      label: "Diamond Hunters",
      teamId: diamondHunters.teamId,
      teamName: diamondHunters.teamName,
      value: `${diamondHunters.platinumCount} diamond`,
      detail: "Most tasks pushed all the way to diamond rank.",
    });
  }

  const taskAwards: TaskAward[] = [];

  const favoriteTask = chooseTaskAward(
    [...taskStats.values()]
      .map((task) => ({
        ...task,
        ratingAverage: average(ratingsByTaskId.get(task.taskId) ?? []),
        ratingCount: (ratingsByTaskId.get(task.taskId) ?? []).length,
      }))
      .filter((task) => task.ratingAverage !== null && task.ratingCount >= 4),
    (left, right) => {
      if ((right.ratingAverage ?? 0) !== (left.ratingAverage ?? 0)) {
        return (right.ratingAverage ?? 0) - (left.ratingAverage ?? 0);
      }

      return right.ratingCount - left.ratingCount;
    },
  );
  if (favoriteTask && favoriteTask.ratingAverage !== null) {
    taskAwards.push({
      kind: "favorite_task",
      label: "Favorite Task",
      taskId: favoriteTask.taskId,
      taskTitle: favoriteTask.taskTitle,
      taskType: favoriteTask.taskType,
      value: `${formatAverage(favoriteTask.ratingAverage)} / 5`,
      detail: `${favoriteTask.ratingCount} ratings across both teams.`,
    });
  }

  const mostReplayedTask = chooseTaskAward(
    [...taskStats.values()].filter((task) => task.resolvedChallenges > 0),
    (left, right) => right.resolvedChallenges - left.resolvedChallenges,
  );
  if (mostReplayedTask) {
    taskAwards.push({
      kind: "most_replayed_task",
      label: "Most Replayed Task",
      taskId: mostReplayedTask.taskId,
      taskTitle: mostReplayedTask.taskTitle,
      taskType: mostReplayedTask.taskType,
      value: `${mostReplayedTask.resolvedChallenges} plays`,
      detail: "Appeared in the highest number of resolved challenges.",
    });
  }

  const hardestTask = chooseTaskAward(
    [...taskStats.values()]
      .map((task) => ({
        ...task,
        successRate:
          task.teamParticipations > 0 ? task.successfulParticipations / task.teamParticipations : 0,
      }))
      .filter((task) => task.resolvedChallenges >= 3),
    (left, right) => {
      if (left.successRate !== right.successRate) {
        return left.successRate - right.successRate;
      }

      return right.resolvedChallenges - left.resolvedChallenges;
    },
  );
  if (hardestTask) {
    taskAwards.push({
      kind: "hardest_task",
      label: "Hardest Task",
      taskId: hardestTask.taskId,
      taskTitle: hardestTask.taskTitle,
      taskType: hardestTask.taskType,
      value: `${formatPercent(hardestTask.successRate)} success`,
      detail: `${hardestTask.resolvedChallenges} resolved plays with the lowest success rate.`,
    });
  }

  const rivalryAward =
    [...rivalryStats.values()]
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }

        return compareText(left.matchup, right.matchup);
      })[0] ?? null;
  const bestRivalry: RivalryAward | null =
    rivalryAward && rivalryAward.count > 0
      ? {
          label: "Best Rivalry",
          teamIds: rivalryAward.teamIds,
          matchup: rivalryAward.matchup,
          value: `${rivalryAward.count} meetings`,
          detail: "The most repeated head-to-head matchup of the event.",
        }
      : null;

  const averageTaskRating = average(input.ratings.map((rating) => rating.stars));
  const duration = formatDuration(input.startedAt, input.endedAt);
  const numbers: GameNumberStat[] = [
    {
      label: "Resolved plays",
      value: `${resolvedChallenges.length}`,
      detail: "Resolved and failed challenges combined.",
    },
    {
      label: "Competitive",
      value: `${competitiveChallenges.length}`,
      detail: "Resolved competitive challenges.",
    },
    {
      label: "Co-op",
      value: `${cooperativeChallenges.length}`,
      detail: "Resolved or failed cooperative challenges.",
    },
    {
      label: "Ratings",
      value: `${input.ratings.length}`,
      detail: averageTaskRating === null ? "No task ratings recorded." : `Average ${formatAverage(averageTaskRating)} / 5.`,
    },
    {
      label: "Cancelled",
      value: `${input.challenges.filter((challenge) => challenge.status === "cancelled").length}`,
      detail: "Cancelled challenges never affect progression.",
    },
    {
      label: "Duration",
      value: duration ?? "N/A",
      detail: duration ? "Time between event start and finish." : "Shown once both start and end times exist.",
    },
  ];

  const eventRecap: EventRecap = {
    podium: input.leaderboard.slice(0, 3),
    myTeamRank: input.myTeamId ? (rankByTeamId.get(input.myTeamId) ?? null) : null,
    totalTeams: input.teams.length,
    numbers,
    teamAwards,
    taskAwards,
    rivalryAward: bestRivalry,
    shareText: (() => {
      const winners = input.leaderboard[0];
      const myTeamName =
        (input.myTeamId ? teamNameById.get(input.myTeamId) : null) ??
        (winners ? winners.teamName : "My team");
      const myRank = input.myTeamId ? (rankByTeamId.get(input.myTeamId) ?? null) : null;
      const winnersName = winners?.teamName ?? "A team";
      const summary = myRank
        ? `${myTeamName} finished #${myRank}. ${winnersName} won the event.`
        : `${winnersName} won the event.`;
      return summary;
    })(),
  };

  if (!input.myTeamId) {
    return {
      teamRecap: null,
      eventRecap,
    };
  }

  const myTeamRow = leaderboardRowByTeamId.get(input.myTeamId);
  const myTeamStats = teamStats.get(input.myTeamId);
  const myTeamName = teamNameById.get(input.myTeamId) ?? "Your team";
  const myRatings = input.ratings.filter((rating) => rating.teamId === input.myTeamId);
  const myRatingsAverage = average(myRatings.map((rating) => rating.stars));

  const myTaskEntries = input.tasks.map((task) => {
    const teamTaskKey = `${input.myTeamId}:${task.id}`;
    const stats = teamTaskStats.get(teamTaskKey) ?? { attempts: 0, failures: 0 };
    const teamTaskRatings = ratingsByTeamTaskId.get(teamTaskKey) ?? [];
    const averageRating = average(teamTaskRatings);

    return {
      taskId: task.id,
      taskTitle: task.title,
      taskType: task.type,
      attempts: stats.attempts,
      failures: stats.failures,
      averageRating,
      ratingCount: teamTaskRatings.length,
      successRate:
        stats.attempts > 0 ? (stats.attempts - stats.failures) / stats.attempts : 0,
    };
  });

  const mostReplayedTeamTask = chooseTaskAward(
    myTaskEntries.filter((task) => task.attempts > 0),
    (left, right) => right.attempts - left.attempts,
  );
  const favoriteTeamTask = chooseTaskAward(
    myTaskEntries.filter((task) => task.averageRating !== null),
    (left, right) => {
      if ((right.averageRating ?? 0) !== (left.averageRating ?? 0)) {
        return (right.averageRating ?? 0) - (left.averageRating ?? 0);
      }

      return right.ratingCount - left.ratingCount;
    },
  );
  const toughestTeamTask = chooseTaskAward(
    myTaskEntries.filter((task) => task.failures > 0),
    (left, right) => {
      if (right.failures !== left.failures) {
        return right.failures - left.failures;
      }

      if (left.successRate !== right.successRate) {
        return left.successRate - right.successRate;
      }

      return right.attempts - left.attempts;
    },
  );

  const teamRecap: TeamRecap = {
    teamId: input.myTeamId,
    teamName: myTeamName,
    finalRank: rankByTeamId.get(input.myTeamId) ?? null,
    completedCount: myTeamRow?.completedCount ?? 0,
    goldCount: myTeamRow?.goldCount ?? 0,
    platinumCount: myTeamRow?.platinumCount ?? 0,
    resolvedChallenges: myTeamStats?.resolvedChallenges ?? 0,
    competitiveWins: myTeamStats?.competitiveWins ?? 0,
    competitiveLosses: myTeamStats?.competitiveLosses ?? 0,
    cooperativeSuccesses: myTeamStats?.cooperativeSuccesses ?? 0,
    cooperativeFailures: myTeamStats?.cooperativeFailures ?? 0,
    averageRatingGiven: myRatingsAverage,
    mostReplayedTask: mostReplayedTeamTask
      ? createTaskSummary(
          mostReplayedTeamTask.taskId,
          mostReplayedTeamTask.taskTitle,
          mostReplayedTeamTask.taskType,
          `${mostReplayedTeamTask.attempts} plays`,
          "Your team returned to this task more than any other.",
        )
      : null,
    favoriteTask:
      favoriteTeamTask && favoriteTeamTask.averageRating !== null
        ? createTaskSummary(
            favoriteTeamTask.taskId,
            favoriteTeamTask.taskTitle,
            favoriteTeamTask.taskType,
            `${formatAverage(favoriteTeamTask.averageRating)} / 5`,
            `${favoriteTeamTask.ratingCount} rating${favoriteTeamTask.ratingCount === 1 ? "" : "s"} from your team.`,
          )
        : null,
    toughestTask: toughestTeamTask
      ? createTaskSummary(
          toughestTeamTask.taskId,
          toughestTeamTask.taskTitle,
          toughestTeamTask.taskType,
          `${toughestTeamTask.failures} setbacks`,
          `${formatPercent(toughestTeamTask.successRate)} success across ${toughestTeamTask.attempts} attempts.`,
        )
      : null,
  };

  return {
    teamRecap,
    eventRecap,
  };
}
