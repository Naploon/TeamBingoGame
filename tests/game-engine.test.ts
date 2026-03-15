import {
  buildLeaderboard,
  generateBoardAssignments,
  generateTeamPlan,
  recomputeTeamTaskStates,
} from "@/lib/game/engine";

describe("game engine", () => {
  it("creates balanced teams with one captain each", () => {
    const players = Array.from({ length: 10 }, (_, index) => ({
      id: `player-${index + 1}`,
      displayName: `Player ${index + 1}`,
    }));

    const teams = generateTeamPlan(players, 4, 12_345);
    const sizes = teams.map((team) => team.playerIds.length);

    expect(teams).toHaveLength(3);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    teams.forEach((team) => {
      expect(team.playerIds).toContain(team.captainPlayerId);
    });
  });

  it("supports solo teams when target size is 1", () => {
    const players = Array.from({ length: 4 }, (_, index) => ({
      id: `player-${index + 1}`,
      displayName: `Player ${index + 1}`,
    }));

    const teams = generateTeamPlan(players, 1, 12_345);

    expect(teams).toHaveLength(4);
    teams.forEach((team) => {
      expect(team.playerIds).toHaveLength(1);
      expect(team.playerIds[0]).toBe(team.captainPlayerId);
    });
  });

  it("still creates two team slots when fewer than two teams would exist", () => {
    const teams = generateTeamPlan(
      [
        {
          id: "player-1",
          displayName: "Player 1",
        },
      ],
      4,
      12_345,
    );

    expect(teams).toHaveLength(2);
    expect(teams[0]).toMatchObject({
      autoName: "Squad 1",
      playerIds: ["player-1"],
      captainPlayerId: "player-1",
    });
    expect(teams[1]).toMatchObject({
      autoName: "Squad 2",
      playerIds: [],
      captainPlayerId: undefined,
    });
  });

  it("creates a unique board order per team from the same 16 tasks", () => {
    const taskIds = Array.from({ length: 16 }, (_, index) => `task-${index + 1}`);
    const assignments = generateBoardAssignments(["team-a", "team-b"], taskIds, 99);

    const teamA = assignments
      .filter((assignment) => assignment.teamId === "team-a")
      .sort((left, right) => left.boardPosition - right.boardPosition)
      .map((assignment) => assignment.taskId);
    const teamB = assignments
      .filter((assignment) => assignment.teamId === "team-b")
      .sort((left, right) => left.boardPosition - right.boardPosition)
      .map((assignment) => assignment.taskId);

    expect(teamA).toHaveLength(16);
    expect(teamB).toHaveLength(16);
    expect(new Set(teamA)).toEqual(new Set(taskIds));
    expect(new Set(teamB)).toEqual(new Set(taskIds));
    expect(teamA).not.toEqual(teamB);
  });

  it("applies wins, medals, and three-loss protection correctly", () => {
    const assignments = generateBoardAssignments(
      ["team-a", "team-b", "team-c"],
      ["task-1"],
      777,
    );

    const states = recomputeTeamTaskStates({
      assignments,
      tasks: [{ id: "task-1", type: "competitive" }],
      challenges: [
        {
          id: "challenge-1",
          taskId: "task-1",
          challengerTeamId: "team-a",
          opponentTeamId: "team-b",
          type: "competitive",
          status: "resolved",
          winnerTeamId: "team-b",
          createdAt: "2026-03-15T10:00:00.000Z",
        },
        {
          id: "challenge-2",
          taskId: "task-1",
          challengerTeamId: "team-a",
          opponentTeamId: "team-c",
          type: "competitive",
          status: "resolved",
          winnerTeamId: "team-c",
          createdAt: "2026-03-15T10:05:00.000Z",
        },
        {
          id: "challenge-3",
          taskId: "task-1",
          challengerTeamId: "team-a",
          opponentTeamId: "team-b",
          type: "competitive",
          status: "resolved",
          winnerTeamId: "team-b",
          createdAt: "2026-03-15T10:10:00.000Z",
        },
        {
          id: "challenge-4",
          taskId: "task-1",
          challengerTeamId: "team-a",
          opponentTeamId: "team-c",
          type: "competitive",
          status: "resolved",
          winnerTeamId: "team-a",
          createdAt: "2026-03-15T10:20:00.000Z",
        },
        {
          id: "challenge-5",
          taskId: "task-1",
          challengerTeamId: "team-a",
          opponentTeamId: "team-b",
          type: "competitive",
          status: "resolved",
          winnerTeamId: "team-a",
          createdAt: "2026-03-15T10:25:00.000Z",
        },
      ],
    });

    const teamA = states.find((state) => state.teamId === "team-a")!;
    const teamB = states.find((state) => state.teamId === "team-b")!;

    expect(teamA.lossCount).toBe(3);
    expect(teamA.winCount).toBe(2);
    expect(teamA.completionTier).toBe("gold");
    expect(teamA.lastLossOpponentTeamId).toBeNull();

    expect(teamB.winCount).toBe(2);
    expect(teamB.completionTier).toBe("gold");
  });

  it("marks cooperative tasks complete for both teams and counts the leaderboard by completed cards only", () => {
    const assignments = generateBoardAssignments(
      ["team-a", "team-b"],
      ["task-1", "task-2"],
      101,
    );
    const states = recomputeTeamTaskStates({
      assignments,
      tasks: [
        { id: "task-1", type: "competitive" },
        { id: "task-2", type: "cooperative" },
      ],
      challenges: [
        {
          id: "challenge-1",
          taskId: "task-1",
          challengerTeamId: "team-a",
          opponentTeamId: "team-b",
          type: "competitive",
          status: "resolved",
          winnerTeamId: "team-a",
          createdAt: "2026-03-15T10:00:00.000Z",
        },
        {
          id: "challenge-2",
          taskId: "task-2",
          challengerTeamId: "team-b",
          opponentTeamId: "team-a",
          type: "cooperative",
          status: "resolved",
          winnerTeamId: null,
          createdAt: "2026-03-15T10:05:00.000Z",
        },
      ],
    });

    const leaderboard = buildLeaderboard({
      teams: [
        { id: "team-a", teamName: "Alpha" },
        { id: "team-b", teamName: "Beta" },
      ],
      states,
    });

    expect(
      states
        .filter((state) => state.taskId === "task-2")
        .every((state) => state.completionTier === "base"),
    ).toBe(true);
    expect(leaderboard[0]).toMatchObject({ teamName: "Alpha", completedCount: 2 });
    expect(leaderboard[1]).toMatchObject({ teamName: "Beta", completedCount: 1 });
  });

  it("lets cooperative tasks level up to diamond through repeat completions", () => {
    const assignments = generateBoardAssignments(["team-a", "team-b"], ["task-1"], 202);

    const states = recomputeTeamTaskStates({
      assignments,
      tasks: [{ id: "task-1", type: "cooperative" }],
      challenges: [
        {
          id: "challenge-1",
          taskId: "task-1",
          challengerTeamId: "team-a",
          opponentTeamId: "team-b",
          type: "cooperative",
          status: "resolved",
          winnerTeamId: null,
          createdAt: "2026-03-15T10:00:00.000Z",
        },
        {
          id: "challenge-2",
          taskId: "task-1",
          challengerTeamId: "team-a",
          opponentTeamId: "team-b",
          type: "cooperative",
          status: "resolved",
          winnerTeamId: null,
          createdAt: "2026-03-15T10:05:00.000Z",
        },
        {
          id: "challenge-3",
          taskId: "task-1",
          challengerTeamId: "team-a",
          opponentTeamId: "team-b",
          type: "cooperative",
          status: "resolved",
          winnerTeamId: null,
          createdAt: "2026-03-15T10:10:00.000Z",
        },
      ],
    });

    expect(states.every((state) => state.winCount === 3)).toBe(true);
    expect(states.every((state) => state.completionTier === "platinum")).toBe(true);
    expect(states.every((state) => state.completionSource === "cooperative")).toBe(true);
  });

  it("caps competitive wins at platinum", () => {
    const assignments = generateBoardAssignments(["team-a", "team-b"], ["task-1"], 55);

    const states = recomputeTeamTaskStates({
      assignments,
      tasks: [{ id: "task-1", type: "competitive" }],
      challenges: [
        {
          id: "challenge-1",
          taskId: "task-1",
          challengerTeamId: "team-a",
          opponentTeamId: "team-b",
          type: "competitive",
          status: "resolved",
          winnerTeamId: "team-a",
          createdAt: "2026-03-15T10:00:00.000Z",
        },
        {
          id: "challenge-2",
          taskId: "task-1",
          challengerTeamId: "team-a",
          opponentTeamId: "team-b",
          type: "competitive",
          status: "resolved",
          winnerTeamId: "team-a",
          createdAt: "2026-03-15T10:05:00.000Z",
        },
        {
          id: "challenge-3",
          taskId: "task-1",
          challengerTeamId: "team-a",
          opponentTeamId: "team-b",
          type: "competitive",
          status: "resolved",
          winnerTeamId: "team-a",
          createdAt: "2026-03-15T10:10:00.000Z",
        },
        {
          id: "challenge-4",
          taskId: "task-1",
          challengerTeamId: "team-a",
          opponentTeamId: "team-b",
          type: "competitive",
          status: "resolved",
          winnerTeamId: "team-a",
          createdAt: "2026-03-15T10:15:00.000Z",
        },
      ],
    });

    const teamA = states.find((state) => state.teamId === "team-a")!;

    expect(teamA.winCount).toBe(3);
    expect(teamA.completionTier).toBe("platinum");
  });
});
