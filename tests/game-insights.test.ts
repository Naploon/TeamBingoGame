import { buildLeaderboard, generateBoardAssignments, recomputeTeamTaskStates } from "@/lib/game/engine";
import { buildPlayerRecaps } from "@/lib/game/insights";

describe("game insights", () => {
  it("builds team recap stats and excludes cancelled plays from recap awards", () => {
    const teams = [
      { id: "team-a", teamName: "Alpha" },
      { id: "team-b", teamName: "Beta" },
      { id: "team-c", teamName: "Gamma" },
    ];
    const tasks = [
      { id: "task-race", title: "Relay Race", type: "competitive" as const },
      { id: "task-puzzle", title: "Puzzle Box", type: "cooperative" as const },
      { id: "task-quiz", title: "Quiz Show", type: "competitive" as const },
    ];
    const challenges = [
      {
        id: "challenge-1",
        taskId: "task-race",
        challengerTeamId: "team-a",
        opponentTeamId: "team-b",
        type: "competitive" as const,
        status: "resolved" as const,
        winnerTeamId: "team-a",
        createdAt: "2026-03-17T09:00:00.000Z",
      },
      {
        id: "challenge-2",
        taskId: "task-race",
        challengerTeamId: "team-b",
        opponentTeamId: "team-c",
        type: "competitive" as const,
        status: "resolved" as const,
        winnerTeamId: "team-c",
        createdAt: "2026-03-17T09:05:00.000Z",
      },
      {
        id: "challenge-3",
        taskId: "task-puzzle",
        challengerTeamId: "team-a",
        opponentTeamId: "team-b",
        type: "cooperative" as const,
        status: "failed" as const,
        winnerTeamId: null,
        createdAt: "2026-03-17T09:10:00.000Z",
      },
      {
        id: "challenge-4",
        taskId: "task-puzzle",
        challengerTeamId: "team-a",
        opponentTeamId: "team-b",
        type: "cooperative" as const,
        status: "resolved" as const,
        winnerTeamId: null,
        createdAt: "2026-03-17T09:15:00.000Z",
      },
      {
        id: "challenge-5",
        taskId: "task-quiz",
        challengerTeamId: "team-a",
        opponentTeamId: "team-c",
        type: "competitive" as const,
        status: "resolved" as const,
        winnerTeamId: "team-a",
        createdAt: "2026-03-17T09:20:00.000Z",
      },
      {
        id: "challenge-6",
        taskId: "task-quiz",
        challengerTeamId: "team-b",
        opponentTeamId: "team-a",
        type: "competitive" as const,
        status: "resolved" as const,
        winnerTeamId: "team-b",
        createdAt: "2026-03-17T09:25:00.000Z",
      },
      {
        id: "challenge-7",
        taskId: "task-race",
        challengerTeamId: "team-a",
        opponentTeamId: "team-c",
        type: "competitive" as const,
        status: "resolved" as const,
        winnerTeamId: "team-a",
        createdAt: "2026-03-17T09:30:00.000Z",
      },
      {
        id: "challenge-8",
        taskId: "task-puzzle",
        challengerTeamId: "team-b",
        opponentTeamId: "team-c",
        type: "cooperative" as const,
        status: "cancelled" as const,
        winnerTeamId: null,
        createdAt: "2026-03-17T09:35:00.000Z",
      },
    ];
    const ratings = [
      { challengeId: "challenge-1", taskId: "task-race", teamId: "team-a", stars: 4.5 },
      { challengeId: "challenge-1", taskId: "task-race", teamId: "team-b", stars: 4 },
      { challengeId: "challenge-2", taskId: "task-race", teamId: "team-b", stars: 4.5 },
      { challengeId: "challenge-2", taskId: "task-race", teamId: "team-c", stars: 4.5 },
      { challengeId: "challenge-3", taskId: "task-puzzle", teamId: "team-a", stars: 5 },
      { challengeId: "challenge-3", taskId: "task-puzzle", teamId: "team-b", stars: 4.5 },
      { challengeId: "challenge-4", taskId: "task-puzzle", teamId: "team-a", stars: 5 },
      { challengeId: "challenge-4", taskId: "task-puzzle", teamId: "team-b", stars: 4.5 },
    ];

    const assignments = generateBoardAssignments(
      teams.map((team) => team.id),
      tasks.map((task) => task.id),
      42,
    );
    const states = recomputeTeamTaskStates({
      assignments,
      tasks: tasks.map((task) => ({ id: task.id, type: task.type })),
      challenges,
    });
    const leaderboard = buildLeaderboard({ teams, states });

    const { teamRecap, eventRecap } = buildPlayerRecaps({
      teams,
      tasks,
      challenges,
      ratings,
      states,
      leaderboard,
      myTeamId: "team-a",
      startedAt: "2026-03-17T09:00:00.000Z",
      endedAt: "2026-03-17T10:00:00.000Z",
    });

    expect(teamRecap).toMatchObject({
      teamName: "Alpha",
      resolvedChallenges: 6,
      competitiveWins: 3,
      competitiveLosses: 1,
      cooperativeSuccesses: 1,
      cooperativeFailures: 1,
    });
    expect(teamRecap?.favoriteTask).toMatchObject({
      taskTitle: "Puzzle Box",
      value: "5 / 5",
    });
    expect(eventRecap.taskAwards.find((award) => award.kind === "favorite_task")).toMatchObject({
      taskTitle: "Puzzle Box",
    });
    expect(eventRecap.taskAwards.find((award) => award.kind === "most_replayed_task")).toMatchObject({
      taskTitle: "Relay Race",
      value: "3 plays",
    });
    expect(eventRecap.numbers.find((item) => item.label === "Cancelled")).toMatchObject({
      value: "1",
    });
  });

  it("enforces award thresholds before showing favorite and hardest task awards", () => {
    const teams = [
      { id: "team-a", teamName: "Alpha" },
      { id: "team-b", teamName: "Beta" },
    ];
    const tasks = [
      { id: "task-1", title: "Sprint", type: "competitive" as const },
      { id: "task-2", title: "Tower", type: "cooperative" as const },
    ];
    const challenges = [
      {
        id: "challenge-1",
        taskId: "task-1",
        challengerTeamId: "team-a",
        opponentTeamId: "team-b",
        type: "competitive" as const,
        status: "resolved" as const,
        winnerTeamId: "team-a",
        createdAt: "2026-03-17T11:00:00.000Z",
      },
      {
        id: "challenge-2",
        taskId: "task-2",
        challengerTeamId: "team-a",
        opponentTeamId: "team-b",
        type: "cooperative" as const,
        status: "resolved" as const,
        winnerTeamId: null,
        createdAt: "2026-03-17T11:05:00.000Z",
      },
    ];
    const ratings = [
      { challengeId: "challenge-1", taskId: "task-1", teamId: "team-a", stars: 4 },
      { challengeId: "challenge-1", taskId: "task-1", teamId: "team-b", stars: 4.5 },
      { challengeId: "challenge-2", taskId: "task-2", teamId: "team-a", stars: 5 },
    ];

    const assignments = generateBoardAssignments(
      teams.map((team) => team.id),
      tasks.map((task) => task.id),
      8,
    );
    const states = recomputeTeamTaskStates({
      assignments,
      tasks: tasks.map((task) => ({ id: task.id, type: task.type })),
      challenges,
    });
    const leaderboard = buildLeaderboard({ teams, states });

    const { eventRecap } = buildPlayerRecaps({
      teams,
      tasks,
      challenges,
      ratings,
      states,
      leaderboard,
      myTeamId: "team-a",
    });

    expect(eventRecap.taskAwards.some((award) => award.kind === "favorite_task")).toBe(false);
    expect(eventRecap.taskAwards.some((award) => award.kind === "hardest_task")).toBe(false);
  });

  it("uses final leaderboard order as the tie-breaker for team awards", () => {
    const teams = [
      { id: "team-a", teamName: "Alpha" },
      { id: "team-b", teamName: "Beta" },
    ];
    const tasks = [{ id: "task-1", title: "Arena", type: "competitive" as const }];
    const challenges = [
      {
        id: "challenge-1",
        taskId: "task-1",
        challengerTeamId: "team-a",
        opponentTeamId: "team-b",
        type: "competitive" as const,
        status: "resolved" as const,
        winnerTeamId: "team-b",
        createdAt: "2026-03-17T12:00:00.000Z",
      },
    ];
    const ratings: Array<{ challengeId: string; taskId: string; teamId: string; stars: number }> = [];

    const assignments = generateBoardAssignments(["team-a", "team-b"], ["task-1"], 12);
    const states = recomputeTeamTaskStates({
      assignments,
      tasks: [{ id: "task-1", type: "competitive" as const }],
      challenges,
    });
    const leaderboard = buildLeaderboard({ teams, states });

    const { eventRecap } = buildPlayerRecaps({
      teams,
      tasks,
      challenges,
      ratings,
      states,
      leaderboard,
      myTeamId: "team-a",
    });

    expect(leaderboard[0].teamName).toBe("Beta");
    expect(eventRecap.teamAwards.find((award) => award.kind === "most_active")).toMatchObject({
      teamName: "Beta",
    });
  });
});
