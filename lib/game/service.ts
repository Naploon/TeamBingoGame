import { randomBytes, randomInt } from "crypto";

import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  adminAuditLogs,
  challenges,
  gameInstances,
  playerRegistrations,
  playerSessions,
  tasks,
  teams,
  teamTaskStates,
  type ChallengeRecord,
  type GameInstanceRecord,
  type PlayerRegistrationRecord,
  type TaskRecord,
  type TeamRecord,
} from "@/lib/db/schema";
import {
  buildLeaderboard,
  generateBoardAssignments,
  generateTeamPlan,
  recomputeTeamTaskStates,
} from "@/lib/game/engine";
import {
  createChallengeSchema,
  createEventSchema,
  createTaskSchema,
  overrideChallengeSchema,
  registerPlayerSchema,
  renameTeamSchema,
  resolveChallengeSchema,
  switchCaptainSchema,
  updateEventSchema,
} from "@/lib/game/validation";
import { generateJoinCode, normalizeKey, slugify } from "@/lib/utils";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

function toFriendlyError(error: unknown, duplicateMessage: string): never {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  ) {
    throw new AppError(duplicateMessage);
  }

  throw error;
}

function createSessionToken() {
  return randomBytes(32).toString("hex");
}

function isCompleted(tier: string) {
  return tier !== "none";
}

async function ensureUniqueSlug(title: string) {
  const base = slugify(title) || "bingo-challenge";

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const existing = await db.query.gameInstances.findFirst({
      where: eq(gameInstances.slug, slug),
      columns: { id: true },
    });

    if (!existing) {
      return slug;
    }
  }

  return `${base}-${Date.now()}`;
}

async function ensureUniqueJoinCode() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const joinCode = generateJoinCode(Date.now() + attempt + randomInt(1, 1000));
    const existing = await db.query.gameInstances.findFirst({
      where: eq(gameInstances.joinCode, joinCode),
      columns: { id: true },
    });

    if (!existing) {
      return joinCode;
    }
  }

  return generateJoinCode(Date.now() + randomInt(1000, 5000));
}

async function getEventBySlug(slug: string) {
  const event = await db.query.gameInstances.findFirst({
    where: eq(gameInstances.slug, slug),
  });

  if (!event) {
    throw new AppError("Event not found", 404);
  }

  return event;
}

async function getEventByJoinCode(joinCode: string) {
  const event = await db.query.gameInstances.findFirst({
    where: eq(gameInstances.joinCode, joinCode.toUpperCase()),
  });

  if (!event) {
    throw new AppError("Join code not found", 404);
  }

  return event;
}

async function getPlayerContext(slug: string, sessionToken: string) {
  const sessionRow = await db
    .select({
      event: gameInstances,
      player: playerRegistrations,
      session: playerSessions,
    })
    .from(playerSessions)
    .innerJoin(playerRegistrations, eq(playerSessions.playerId, playerRegistrations.id))
    .innerJoin(gameInstances, eq(playerSessions.gameInstanceId, gameInstances.id))
    .where(eq(playerSessions.sessionToken, sessionToken))
    .limit(1);

  const row = sessionRow[0];

  if (!row || row.event.slug !== slug) {
    throw new AppError("Your session is no longer valid for this event.", 401);
  }

  if (new Date(row.session.expiresAt).getTime() < Date.now()) {
    throw new AppError("Your session has expired. Join again to continue.", 401);
  }

  const team = row.player.teamId
    ? await db.query.teams.findFirst({
        where: eq(teams.id, row.player.teamId),
      })
    : null;

  return {
    event: row.event,
    player: row.player,
    session: row.session,
    team,
  };
}

async function writeAuditLog(
  executor: any,
  input: {
    adminId: string;
    gameInstanceId: string;
    actionType: string;
    entityType: string;
    entityId: string;
    beforeJson?: unknown;
    afterJson?: unknown;
  },
) {
  await executor.insert(adminAuditLogs).values({
    adminId: input.adminId,
    gameInstanceId: input.gameInstanceId,
    actionType: input.actionType,
    entityType: input.entityType,
    entityId: input.entityId,
    beforeJson: input.beforeJson ?? null,
    afterJson: input.afterJson ?? null,
  });
}

async function recomputeAndPersistEvent(executor: any, gameInstanceId: string) {
  const eventTeams = await executor
    .select()
    .from(teams)
    .where(eq(teams.gameInstanceId, gameInstanceId))
    .orderBy(asc(teams.createdAt));

  if (eventTeams.length === 0) {
    return;
  }

  const teamIds: string[] = eventTeams.map((team: TeamRecord) => team.id);
  const assignmentRows = await executor
    .select()
    .from(teamTaskStates)
    .where(inArray(teamTaskStates.teamId, teamIds));

  if (assignmentRows.length === 0) {
    return;
  }

  const taskIds = Array.from(new Set<string>(assignmentRows.map((row: any) => row.taskId as string)));
  const eventTasks = await executor.select().from(tasks).where(inArray(tasks.id, taskIds));
  const eventChallenges = await executor
    .select()
    .from(challenges)
    .where(eq(challenges.gameInstanceId, gameInstanceId));

  const computed = recomputeTeamTaskStates({
    assignments: assignmentRows.map((row: any) => ({
      teamId: row.teamId,
      taskId: row.taskId,
      boardPosition: row.boardPosition,
    })),
    tasks: eventTasks.map((task: TaskRecord) => ({
      id: task.id,
      type: task.type,
    })),
    challenges: eventChallenges.map((challenge: ChallengeRecord) => ({
      id: challenge.id,
      taskId: challenge.taskId,
      challengerTeamId: challenge.challengerTeamId,
      opponentTeamId: challenge.opponentTeamId,
      type: challenge.type,
      status: challenge.status,
      winnerTeamId: challenge.winnerTeamId,
      createdAt: challenge.createdAt,
      resolvedAt: challenge.resolvedAt,
    })),
  });

  await executor.delete(teamTaskStates).where(inArray(teamTaskStates.teamId, teamIds));
  await executor.insert(teamTaskStates).values(
    computed.map((state) => ({
      teamId: state.teamId,
      taskId: state.taskId,
      boardPosition: state.boardPosition,
      completionTier: state.completionTier,
      completionSource: state.completionSource,
      winCount: state.winCount,
      lossCount: state.lossCount,
      lastLossOpponentTeamId: state.lastLossOpponentTeamId,
    })),
  );
}

export async function listEvents() {
  return db.select().from(gameInstances).orderBy(desc(gameInstances.createdAt));
}

export async function createEvent(input: unknown) {
  const parsed = createEventSchema.parse(input);
  const slug = await ensureUniqueSlug(parsed.title);
  const joinCode = await ensureUniqueJoinCode();

  const [event] = await db
    .insert(gameInstances)
    .values({
      title: parsed.title,
      slug,
      joinCode,
      targetTeamSize: parsed.targetTeamSize,
      seed: randomInt(100_000, 999_999_999),
    })
    .returning();

  return event;
}

export async function updateEvent(slug: string, input: unknown, adminId: string) {
  const parsed = updateEventSchema.parse(input);
  const event = await getEventBySlug(slug);

  if (event.status === "ended") {
    throw new AppError("Ended events are read-only.");
  }

  const nextValues =
    event.status === "draft" || event.status === "registration_open"
      ? {
          title: parsed.title,
          targetTeamSize: parsed.targetTeamSize,
          updatedAt: new Date(),
        }
      : {
          title: parsed.title,
          updatedAt: new Date(),
        };

  const [updated] = await db
    .update(gameInstances)
    .set(nextValues)
    .where(eq(gameInstances.id, event.id))
    .returning();

  await writeAuditLog(db, {
    adminId,
    gameInstanceId: event.id,
    actionType: "update_event",
    entityType: "game_instance",
    entityId: event.id,
    beforeJson: event,
    afterJson: updated,
  });

  return updated;
}

export async function openRegistration(slug: string, adminId: string) {
  const event = await getEventBySlug(slug);

  if (event.status !== "draft") {
    throw new AppError("Only draft events can open registration.");
  }

  const [updated] = await db
    .update(gameInstances)
    .set({
      status: "registration_open",
      updatedAt: new Date(),
    })
    .where(eq(gameInstances.id, event.id))
    .returning();

  await writeAuditLog(db, {
    adminId,
    gameInstanceId: event.id,
    actionType: "open_registration",
    entityType: "game_instance",
    entityId: event.id,
    beforeJson: event,
    afterJson: updated,
  });

  return updated;
}

export async function registerPlayer(joinCode: string, input: unknown) {
  const parsed = registerPlayerSchema.parse(input);
  const event = await getEventByJoinCode(joinCode);

  if (event.status !== "registration_open") {
    throw new AppError("This event is not accepting registrations right now.");
  }

  return db.transaction(async (tx) => {
    try {
      const [player] = await tx
        .insert(playerRegistrations)
        .values({
          gameInstanceId: event.id,
          displayName: parsed.displayName,
          displayNameKey: normalizeKey(parsed.displayName),
        })
        .returning();

      const sessionToken = createSessionToken();
      await tx.insert(playerSessions).values({
        gameInstanceId: event.id,
        playerId: player.id,
        sessionToken,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
      });

      return {
        eventSlug: event.slug,
        sessionToken,
        playerId: player.id,
      };
    } catch (error) {
      toFriendlyError(error, "That display name is already taken in this event.");
    }
  });
}

export async function resumePlayerSession(slug: string, sessionToken: string) {
  return getPlayerContext(slug, sessionToken);
}

export async function getJoinEvent(joinCode: string) {
  const event = await getEventByJoinCode(joinCode);
  return {
    id: event.id,
    title: event.title,
    slug: event.slug,
    joinCode: event.joinCode,
    status: event.status,
    targetTeamSize: event.targetTeamSize,
  };
}

export async function getPlayerState(slug: string, sessionToken: string) {
  const context = await getPlayerContext(slug, sessionToken);
  const eventId = context.event.id;

  const [eventTeams, registrations, eventTasks, stateRows, eventChallenges] = await Promise.all([
    db.select().from(teams).where(eq(teams.gameInstanceId, eventId)).orderBy(asc(teams.createdAt)),
    db
      .select()
      .from(playerRegistrations)
      .where(eq(playerRegistrations.gameInstanceId, eventId))
      .orderBy(asc(playerRegistrations.displayName)),
    db.select().from(tasks).where(eq(tasks.gameInstanceId, eventId)).orderBy(asc(tasks.sortOrder)),
    context.player.teamId
      ? db.select().from(teamTaskStates).where(eq(teamTaskStates.teamId, context.player.teamId))
      : Promise.resolve([]),
    db.select().from(challenges).where(eq(challenges.gameInstanceId, eventId)).orderBy(desc(challenges.createdAt)),
  ]);

  const membersByTeam = new Map<string, PlayerRegistrationRecord[]>();
  registrations.forEach((registration) => {
    if (!registration.teamId) {
      return;
    }

    const teamMembers = membersByTeam.get(registration.teamId) ?? [];
    teamMembers.push(registration);
    membersByTeam.set(registration.teamId, teamMembers);
  });

  const myTeam = context.team;
  const activeChallenge = myTeam
    ? eventChallenges.find(
        (challenge) =>
          challenge.status === "open" &&
          (challenge.challengerTeamId === myTeam.id || challenge.opponentTeamId === myTeam.id),
      ) ?? null
    : null;

  const taskById = new Map(eventTasks.map((task) => [task.id, task]));
  const board = stateRows
    .map((state) => {
      const task = taskById.get(state.taskId);
      if (!task) {
        return null;
      }

      return {
        taskId: task.id,
        boardPosition: state.boardPosition,
        title: task.title,
        shortDescription: task.shortDescription,
        fullDescription: task.fullDescription,
        type: task.type,
        completionTier: state.completionTier,
        completionSource: state.completionSource,
        winCount: state.winCount,
        lossCount: state.lossCount,
        lastLossOpponentTeamId: state.lastLossOpponentTeamId,
        canChallenge:
          context.event.status === "live" &&
          !activeChallenge &&
          !(task.type === "cooperative" && isCompleted(state.completionTier)),
      };
    })
    .filter((card): card is NonNullable<typeof card> => card !== null)
    .sort((left, right) => left!.boardPosition - right!.boardPosition);

  const leaderboard = buildLeaderboard({
    teams: eventTeams.map((team) => ({
      id: team.id,
      teamName: team.name ?? team.autoName,
    })),
    states:
      eventTeams.length > 0
        ? await db
            .select()
            .from(teamTaskStates)
            .where(inArray(teamTaskStates.teamId, eventTeams.map((team) => team.id)))
        : [],
  });

  return {
    event: {
      id: context.event.id,
      slug: context.event.slug,
      title: context.event.title,
      status: context.event.status,
      startedAt: context.event.startedAt,
      endedAt: context.event.endedAt,
      joinCode: context.event.joinCode,
    },
    me: {
      id: context.player.id,
      displayName: context.player.displayName,
      teamId: context.player.teamId,
      isCaptain: context.player.isCaptain,
    },
    team: myTeam
      ? {
          id: myTeam.id,
          name: myTeam.name,
          autoName: myTeam.autoName,
          captainPlayerId: myTeam.captainPlayerId,
          members: membersByTeam.get(myTeam.id) ?? [],
        }
      : null,
    board,
    teams: eventTeams.map((team) => ({
      id: team.id,
      name: team.name ?? team.autoName,
      captainPlayerId: team.captainPlayerId,
      members: (membersByTeam.get(team.id) ?? []).map((player) => ({
        id: player.id,
        displayName: player.displayName,
        isCaptain: player.isCaptain,
      })),
    })),
    activeChallenge: activeChallenge
      ? {
          id: activeChallenge.id,
          taskId: activeChallenge.taskId,
          taskTitle: taskById.get(activeChallenge.taskId)?.title ?? "Task",
          challengerTeamId: activeChallenge.challengerTeamId,
          opponentTeamId: activeChallenge.opponentTeamId,
          winnerTeamId: activeChallenge.winnerTeamId,
          note: activeChallenge.note,
          type: activeChallenge.type,
          createdAt: activeChallenge.createdAt,
          isResolvableByMe: activeChallenge.challengerTeamId === myTeam?.id,
        }
      : null,
    leaderboard,
  };
}

export async function renameTeam(slug: string, sessionToken: string, input: unknown) {
  const parsed = renameTeamSchema.parse(input);
  const context = await getPlayerContext(slug, sessionToken);

  if (!context.team) {
    throw new AppError("You are not on a team yet.");
  }

  if (!context.player.isCaptain) {
    throw new AppError("Only the captain can rename the team.", 403);
  }

  try {
    const [updated] = await db
      .update(teams)
      .set({
        name: parsed.teamName,
        nameKey: normalizeKey(parsed.teamName),
        updatedAt: new Date(),
      })
      .where(eq(teams.id, context.team.id))
      .returning();

    return updated;
  } catch (error) {
    toFriendlyError(error, "That team name is already taken.");
  }
}

export async function createChallenge(slug: string, sessionToken: string, input: unknown) {
  const parsed = createChallengeSchema.parse(input);
  const context = await getPlayerContext(slug, sessionToken);

  if (context.event.status !== "live") {
    throw new AppError("Challenges are only available once the game is live.");
  }

  if (!context.player.teamId) {
    throw new AppError("You are not on a team yet.");
  }

  if (parsed.opponentTeamId === context.player.teamId) {
    throw new AppError("Choose another team to challenge.");
  }

  const [task, challengerState, opponentState, openChallenges] = await Promise.all([
    db.query.tasks.findFirst({
      where: and(eq(tasks.id, parsed.taskId), eq(tasks.gameInstanceId, context.event.id)),
    }),
    db.query.teamTaskStates.findFirst({
      where: and(
        eq(teamTaskStates.teamId, context.player.teamId),
        eq(teamTaskStates.taskId, parsed.taskId),
      ),
    }),
    db.query.teamTaskStates.findFirst({
      where: and(eq(teamTaskStates.teamId, parsed.opponentTeamId), eq(teamTaskStates.taskId, parsed.taskId)),
    }),
    db.select().from(challenges).where(eq(challenges.gameInstanceId, context.event.id)),
  ]);

  if (!task || !challengerState || !opponentState) {
    throw new AppError("Task or team state not found.", 404);
  }

  const blockedOpenChallenge = openChallenges.find(
    (challenge) =>
      challenge.status === "open" &&
      [
        challenge.challengerTeamId,
        challenge.opponentTeamId,
      ].some((teamId) => teamId === context.player.teamId || teamId === parsed.opponentTeamId),
  );

  if (blockedOpenChallenge) {
    throw new AppError("One of these teams is already in an active challenge.");
  }

  if (task.type === "cooperative") {
    if (isCompleted(challengerState.completionTier) || isCompleted(opponentState.completionTier)) {
      throw new AppError("Cooperative tasks cannot be replayed after completion.");
    }
  }

  if (
    task.type === "competitive" &&
    challengerState.lastLossOpponentTeamId === parsed.opponentTeamId
  ) {
    throw new AppError("After a loss, your next attempt on this task must be against a different team.");
  }

  const [challenge] = await db
    .insert(challenges)
    .values({
      gameInstanceId: context.event.id,
      taskId: parsed.taskId,
      challengerTeamId: context.player.teamId,
      opponentTeamId: parsed.opponentTeamId,
      type: task.type,
      status: "open",
      submittedByPlayerId: context.player.id,
    })
    .returning();

  return challenge;
}

export async function resolveChallenge(
  slug: string,
  sessionToken: string,
  challengeId: string,
  input: unknown,
) {
  const parsed = resolveChallengeSchema.parse(input);
  const context = await getPlayerContext(slug, sessionToken);

  if (!context.player.teamId) {
    throw new AppError("You are not on a team yet.");
  }

  return db.transaction(async (tx) => {
    const challenge = await tx.query.challenges.findFirst({
      where: and(eq(challenges.id, challengeId), eq(challenges.gameInstanceId, context.event.id)),
    });

    if (!challenge || challenge.status !== "open") {
      throw new AppError("That challenge can no longer be resolved.", 404);
    }

    if (challenge.challengerTeamId !== context.player.teamId) {
      throw new AppError("Only the challenging team can submit the result.", 403);
    }

    if (
      challenge.type === "competitive" &&
      parsed.winnerTeamId !== challenge.challengerTeamId &&
      parsed.winnerTeamId !== challenge.opponentTeamId
    ) {
      throw new AppError("Pick the winning team for this challenge.");
    }

    const winnerTeamId = challenge.type === "competitive" ? parsed.winnerTeamId ?? null : null;

    const [updated] = await tx
      .update(challenges)
      .set({
        status: "resolved",
        winnerTeamId,
        note: parsed.note ?? null,
        resolvedAt: new Date(),
      })
      .where(eq(challenges.id, challenge.id))
      .returning();

    await recomputeAndPersistEvent(tx, context.event.id);

    return updated;
  });
}

export async function createTask(slug: string, input: unknown, adminId: string) {
  const parsed = createTaskSchema.parse(input);
  const event = await getEventBySlug(slug);

  if (event.status === "live" || event.status === "ended") {
    throw new AppError("Tasks can only be added before the game starts.");
  }

  const existingTasks = await db.select().from(tasks).where(eq(tasks.gameInstanceId, event.id));

  const [task] = await db
    .insert(tasks)
    .values({
      gameInstanceId: event.id,
      title: parsed.title,
      shortDescription: parsed.shortDescription,
      fullDescription: parsed.fullDescription,
      type: parsed.type,
      isActive: parsed.isActive,
      sortOrder: existingTasks.length,
    })
    .returning();

  await writeAuditLog(db, {
    adminId,
    gameInstanceId: event.id,
    actionType: "create_task",
    entityType: "task",
    entityId: task.id,
    afterJson: task,
  });

  return task;
}

export async function updateTask(
  slug: string,
  taskId: string,
  input: unknown,
  adminId: string,
) {
  const parsed = createTaskSchema.parse(input);
  const event = await getEventBySlug(slug);
  const task = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), eq(tasks.gameInstanceId, event.id)),
  });

  if (!task) {
    throw new AppError("Task not found", 404);
  }

  if (event.status === "ended") {
    throw new AppError("Ended events are read-only.");
  }

  const nextValues =
    event.status === "live"
      ? {
          title: parsed.title,
          shortDescription: parsed.shortDescription,
          fullDescription: parsed.fullDescription,
          updatedAt: new Date(),
        }
      : {
          title: parsed.title,
          shortDescription: parsed.shortDescription,
          fullDescription: parsed.fullDescription,
          type: parsed.type,
          isActive: parsed.isActive,
          updatedAt: new Date(),
        };

  const [updated] = await db
    .update(tasks)
    .set(nextValues)
    .where(eq(tasks.id, task.id))
    .returning();

  await writeAuditLog(db, {
    adminId,
    gameInstanceId: event.id,
    actionType: "update_task",
    entityType: "task",
    entityId: task.id,
    beforeJson: task,
    afterJson: updated,
  });

  return updated;
}

export async function startGame(slug: string, adminId: string) {
  const event = await getEventBySlug(slug);

  if (event.status !== "registration_open") {
    throw new AppError("Open registration before starting the game.");
  }

  const [registrations, activeTasks, existingTeams] = await Promise.all([
    db
      .select()
      .from(playerRegistrations)
      .where(eq(playerRegistrations.gameInstanceId, event.id))
      .orderBy(asc(playerRegistrations.createdAt)),
    db
      .select()
      .from(tasks)
      .where(and(eq(tasks.gameInstanceId, event.id), eq(tasks.isActive, true)))
      .orderBy(asc(tasks.sortOrder)),
    db.select().from(teams).where(eq(teams.gameInstanceId, event.id)),
  ]);

  if (existingTeams.length > 0) {
    throw new AppError("This event has already been started.");
  }

  if (registrations.length < 4) {
    throw new AppError("At least 4 players are required to start the game.");
  }

  if (Math.ceil(registrations.length / event.targetTeamSize) < 2) {
    throw new AppError("The current team size would create fewer than 2 teams.");
  }

  if (activeTasks.length !== 16) {
    throw new AppError("Exactly 16 active tasks are required before the game can start.");
  }

  return db.transaction(async (tx) => {
    const teamPlan = generateTeamPlan(
      registrations.map((player) => ({
        id: player.id,
        displayName: player.displayName,
      })),
      event.targetTeamSize,
      event.seed,
    );

    const createdTeams: TeamRecord[] = [];

    for (const plannedTeam of teamPlan) {
      const [team] = await tx
        .insert(teams)
        .values({
          gameInstanceId: event.id,
          autoName: plannedTeam.autoName,
        })
        .returning();

      createdTeams.push(team);
    }

    for (const [index, plannedTeam] of teamPlan.entries()) {
      const team = createdTeams[index];

      await tx
        .update(playerRegistrations)
        .set({
          teamId: team.id,
          isCaptain: false,
        })
        .where(inArray(playerRegistrations.id, plannedTeam.playerIds));

      await tx
        .update(playerRegistrations)
        .set({
          isCaptain: true,
        })
        .where(eq(playerRegistrations.id, plannedTeam.captainPlayerId));

      await tx
        .update(teams)
        .set({
          captainPlayerId: plannedTeam.captainPlayerId,
          updatedAt: new Date(),
        })
        .where(eq(teams.id, team.id));
    }

    const assignments = generateBoardAssignments(
      createdTeams.map((team) => team.id),
      activeTasks.map((task) => task.id),
      event.seed,
    );

    await tx.insert(teamTaskStates).values(
      assignments.map((assignment) => ({
        teamId: assignment.teamId,
        taskId: assignment.taskId,
        boardPosition: assignment.boardPosition,
        completionTier: "none" as const,
        completionSource: "none" as const,
        winCount: 0,
        lossCount: 0,
      })),
    );

    const [updatedEvent] = await tx
      .update(gameInstances)
      .set({
        status: "live",
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(gameInstances.id, event.id))
      .returning();

    await writeAuditLog(tx, {
      adminId,
      gameInstanceId: event.id,
      actionType: "start_game",
      entityType: "game_instance",
      entityId: event.id,
      beforeJson: event,
      afterJson: updatedEvent,
    });

    return updatedEvent;
  });
}

export async function overrideChallenge(
  slug: string,
  challengeId: string,
  input: unknown,
  adminId: string,
) {
  const parsed = overrideChallengeSchema.parse(input);
  const event = await getEventBySlug(slug);

  return db.transaction(async (tx) => {
    const challenge = await tx.query.challenges.findFirst({
      where: and(eq(challenges.id, challengeId), eq(challenges.gameInstanceId, event.id)),
    });

    if (!challenge) {
      throw new AppError("Challenge not found", 404);
    }

    if (
      challenge.type === "competitive" &&
      parsed.status === "resolved" &&
      parsed.winnerTeamId !== challenge.challengerTeamId &&
      parsed.winnerTeamId !== challenge.opponentTeamId
    ) {
      throw new AppError("Winner must be one of the two teams in the challenge.");
    }

    if (challenge.type === "cooperative" && parsed.winnerTeamId) {
      throw new AppError("Cooperative tasks do not have a winner.");
    }

    const [updated] = await tx
      .update(challenges)
      .set({
        status: parsed.status,
        winnerTeamId:
          challenge.type === "competitive" && parsed.status === "resolved"
            ? parsed.winnerTeamId
            : null,
        note: parsed.note ?? null,
        resolvedAt: parsed.status === "resolved" ? new Date() : null,
      })
      .where(eq(challenges.id, challenge.id))
      .returning();

    await recomputeAndPersistEvent(tx, event.id);

    await writeAuditLog(tx, {
      adminId,
      gameInstanceId: event.id,
      actionType: "override_challenge",
      entityType: "challenge",
      entityId: challenge.id,
      beforeJson: challenge,
      afterJson: updated,
    });

    return updated;
  });
}

export async function switchCaptain(slug: string, input: unknown, adminId: string) {
  const parsed = switchCaptainSchema.parse(input);
  const event = await getEventBySlug(slug);

  return db.transaction(async (tx) => {
    const team = await tx.query.teams.findFirst({
      where: and(eq(teams.id, parsed.teamId), eq(teams.gameInstanceId, event.id)),
    });

    const player = await tx.query.playerRegistrations.findFirst({
      where: and(
        eq(playerRegistrations.id, parsed.playerId),
        eq(playerRegistrations.gameInstanceId, event.id),
        eq(playerRegistrations.teamId, parsed.teamId),
      ),
    });

    if (!team || !player) {
      throw new AppError("Player and team do not match.", 404);
    }

    await tx
      .update(playerRegistrations)
      .set({ isCaptain: false })
      .where(eq(playerRegistrations.teamId, team.id));

    await tx
      .update(playerRegistrations)
      .set({ isCaptain: true })
      .where(eq(playerRegistrations.id, player.id));

    const [updatedTeam] = await tx
      .update(teams)
      .set({
        captainPlayerId: player.id,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, team.id))
      .returning();

    await writeAuditLog(tx, {
      adminId,
      gameInstanceId: event.id,
      actionType: "switch_captain",
      entityType: "team",
      entityId: team.id,
      beforeJson: team,
      afterJson: updatedTeam,
    });

    return updatedTeam;
  });
}

export async function endGame(slug: string, adminId: string) {
  const event = await getEventBySlug(slug);

  if (event.status !== "live") {
    throw new AppError("Only live events can be ended.");
  }

  const [updated] = await db
    .update(gameInstances)
    .set({
      status: "ended",
      endedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(gameInstances.id, event.id))
    .returning();

  await writeAuditLog(db, {
    adminId,
    gameInstanceId: event.id,
    actionType: "end_game",
    entityType: "game_instance",
    entityId: event.id,
    beforeJson: event,
    afterJson: updated,
  });

  return updated;
}

export async function getAdminEventState(slug: string) {
  const event = await getEventBySlug(slug);
  const [eventTeams, registrations, eventTasks, eventChallenges, auditRows] = await Promise.all([
    db.select().from(teams).where(eq(teams.gameInstanceId, event.id)).orderBy(asc(teams.createdAt)),
    db
      .select()
      .from(playerRegistrations)
      .where(eq(playerRegistrations.gameInstanceId, event.id))
      .orderBy(asc(playerRegistrations.createdAt)),
    db.select().from(tasks).where(eq(tasks.gameInstanceId, event.id)).orderBy(asc(tasks.sortOrder)),
    db.select().from(challenges).where(eq(challenges.gameInstanceId, event.id)).orderBy(desc(challenges.createdAt)),
    db
      .select()
      .from(adminAuditLogs)
      .where(eq(adminAuditLogs.gameInstanceId, event.id))
      .orderBy(desc(adminAuditLogs.createdAt)),
  ]);

  const teamIds = eventTeams.map((team) => team.id);
  const stateRows =
    teamIds.length > 0
      ? await db.select().from(teamTaskStates).where(inArray(teamTaskStates.teamId, teamIds))
      : [];

  const membersByTeam = new Map<string, PlayerRegistrationRecord[]>();
  registrations.forEach((registration) => {
    if (!registration.teamId) {
      return;
    }

    const next = membersByTeam.get(registration.teamId) ?? [];
    next.push(registration);
    membersByTeam.set(registration.teamId, next);
  });

  const taskById = new Map(eventTasks.map((task) => [task.id, task]));

  return {
    event,
    registrations,
    tasks: eventTasks,
    leaderboard: buildLeaderboard({
      teams: eventTeams.map((team) => ({
        id: team.id,
        teamName: team.name ?? team.autoName,
      })),
      states: stateRows,
    }),
    teams: eventTeams.map((team) => ({
      ...team,
      displayName: team.name ?? team.autoName,
      members: (membersByTeam.get(team.id) ?? []).sort((left, right) =>
        left.displayName.localeCompare(right.displayName),
      ),
      completedCount: stateRows.filter(
        (state) => state.teamId === team.id && state.completionTier !== "none",
      ).length,
    })),
    challenges: eventChallenges.map((challenge) => ({
      ...challenge,
      taskTitle: taskById.get(challenge.taskId)?.title ?? "Task",
    })),
    auditLog: auditRows,
  };
}
