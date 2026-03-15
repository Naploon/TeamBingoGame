import { randomInt } from "crypto";

import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  adminAuditLogs,
  challenges,
  gameInstances,
  playerRegistrations,
  taskRatings,
  taskTemplates,
  tasks,
  teams,
  teamTaskStates,
  type ChallengeRecord,
  type PlayerRegistrationRecord,
  type TaskRatingRecord,
  type TaskRecord,
  type TaskTemplateRecord,
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
  createTaskFromTemplateSchema,
  createTaskTemplateSchema,
  overrideChallengeSchema,
  rateTaskSchema,
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

function isUniqueViolation(error: unknown, constraint?: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505" &&
    (constraint === undefined || ("constraint" in error && error.constraint === constraint))
  );
}

function toFriendlyError(error: unknown, duplicateMessage: string): never {
  if (isUniqueViolation(error)) {
    throw new AppError(duplicateMessage);
  }

  throw error;
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
    const joinCode = generateJoinCode();
    const existing = await db.query.gameInstances.findFirst({
      where: eq(gameInstances.joinCode, joinCode),
      columns: { id: true },
    });

    if (!existing) {
      return joinCode;
    }
  }

  return generateJoinCode();
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

async function getPlayerRow(slug: string, authUserId: string) {
  const playerRows = await db
    .select({
      event: gameInstances,
      player: playerRegistrations,
    })
    .from(playerRegistrations)
    .innerJoin(gameInstances, eq(playerRegistrations.gameInstanceId, gameInstances.id))
    .where(
      and(
        eq(playerRegistrations.authUserId, authUserId),
        eq(gameInstances.slug, slug),
      ),
    )
    .limit(1);

  return playerRows[0] ?? null;
}

async function getPlayerTeam(player: Pick<PlayerRegistrationRecord, "teamId">) {
  if (!player.teamId) {
    return null;
  }

  return db.query.teams.findFirst({
    where: eq(teams.id, player.teamId),
  });
}

async function getPlayerContext(slug: string, authUserId: string) {
  const row = await getPlayerRow(slug, authUserId);

  if (!row) {
    throw new AppError("You are not registered for this event.", 401);
  }

  const team = await getPlayerTeam(row.player);

  return {
    event: row.event,
    player: row.player,
    team,
  };
}

function ensureCustomTeamName(team: Pick<TeamRecord, "name"> | null | undefined) {
  if (!team?.name) {
    throw new AppError("Your captain must choose a team name before your team can start tasks.");
  }
}

function ensureChallengeableTeamName(team: Pick<TeamRecord, "name"> | null | undefined) {
  if (!team?.name) {
    throw new AppError("That team must lock in a name before it can be challenged.");
  }
}

function taskRatingKey(challengeId: string, teamId: string) {
  return `${challengeId}:${teamId}`;
}

function buildTaskRatingSummary(ratings: TaskRatingRecord[]) {
  const byTask = new Map<string, { ratingCount: number; ratingAverage: number | null }>();
  const grouped = new Map<string, number[]>();

  ratings.forEach((rating) => {
    const current = grouped.get(rating.taskId) ?? [];
    current.push(rating.stars);
    grouped.set(rating.taskId, current);
  });

  grouped.forEach((stars, taskId) => {
    const total = stars.reduce((sum, value) => sum + value, 0);
    byTask.set(taskId, {
      ratingCount: stars.length,
      ratingAverage: stars.length > 0 ? total / stars.length : null,
    });
  });

  return byTask;
}

function getMatchHistoryResult(input: {
  status: ChallengeRecord["status"];
  type: ChallengeRecord["type"];
  winnerTeamId: string | null;
  myTeamId: string;
}) {
  if (input.status === "open") {
    return "in_progress";
  }

  if (input.type === "cooperative") {
    if (input.status === "resolved") {
      return "completed";
    }

    if (input.status === "failed") {
      return "failed";
    }

    return "cancelled";
  }

  if (!input.winnerTeamId) {
    return input.status === "cancelled" ? "cancelled" : "no_result";
  }

  return input.winnerTeamId === input.myTeamId ? "win" : "loss";
}

function normalizeTaskImage(input: { imagePath?: string | null; imageUrl?: string | null }) {
  const imagePath = input.imagePath?.trim() || null;
  const imageUrl = input.imageUrl?.trim() || null;

  if (Boolean(imagePath) !== Boolean(imageUrl)) {
    throw new AppError("Task image upload is incomplete. Please re-upload the image.");
  }

  return {
    imagePath,
    imageUrl,
  };
}

function mapTaskTemplate(template: TaskTemplateRecord) {
  return {
    ...template,
    imagePath: template.imagePath ?? null,
    imageUrl: template.imageUrl ?? null,
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

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const joinCode = await ensureUniqueJoinCode();

    try {
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
    } catch (error) {
      if (isUniqueViolation(error, "game_instances_join_code_idx")) {
        continue;
      }

      throw error;
    }
  }

  throw new AppError("Could not generate a unique join code. Please try again.", 500);
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

export async function registerPlayer(
  joinCode: string,
  authUser: {
    id: string;
    email: string;
  },
  input: unknown,
) {
  const parsed = registerPlayerSchema.parse(input);
  const event = await getEventByJoinCode(joinCode);

  if (event.status !== "registration_open") {
    throw new AppError("This event is not accepting registrations right now.");
  }

  return db.transaction(async (tx) => {
    const existingPlayer = await tx.query.playerRegistrations.findFirst({
      where: and(
        eq(playerRegistrations.gameInstanceId, event.id),
        eq(playerRegistrations.authUserId, authUser.id),
      ),
    });

    if (existingPlayer) {
      return {
        eventSlug: event.slug,
        playerId: existingPlayer.id,
      };
    }

    try {
      const [player] = await tx
        .insert(playerRegistrations)
        .values({
          gameInstanceId: event.id,
          authUserId: authUser.id,
          email: authUser.email.toLowerCase(),
          displayName: parsed.displayName,
          displayNameKey: normalizeKey(parsed.displayName),
        })
        .returning();

      return {
        eventSlug: event.slug,
        playerId: player.id,
      };
    } catch (error) {
      toFriendlyError(error, "That display name is already taken in this event.");
    }
  });
}

export async function resumePlayerRegistration(slug: string, authUserId: string) {
  return getPlayerContext(slug, authUserId);
}

export async function getLandingPlayerRegistration(authUserId: string) {
  const rows = await db
    .select({
      event: gameInstances,
      player: playerRegistrations,
    })
    .from(playerRegistrations)
    .innerJoin(gameInstances, eq(playerRegistrations.gameInstanceId, gameInstances.id))
    .where(eq(playerRegistrations.authUserId, authUserId))
    .orderBy(desc(playerRegistrations.createdAt));

  const row = rows.find((candidate) => candidate.event.status !== "ended") ?? rows[0] ?? null;

  if (!row) {
    return null;
  }

  const team = await getPlayerTeam(row.player);

  return {
    event: {
      slug: row.event.slug,
      title: row.event.title,
      status: row.event.status,
      joinCode: row.event.joinCode,
    },
    player: {
      id: row.player.id,
      displayName: row.player.displayName,
    },
    team: team
      ? {
          id: team.id,
          name: team.name ?? team.autoName,
        }
      : null,
  };
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

export async function getPlayerState(slug: string, authUserId: string) {
  const context = await getPlayerContext(slug, authUserId);
  const eventId = context.event.id;

  const [eventTeams, registrations, eventTasks, stateRows, eventChallenges, eventRatings] = await Promise.all([
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
    db.select().from(taskRatings).where(eq(taskRatings.gameInstanceId, eventId)),
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
  const ratingsByChallengeTeam = new Map(
    eventRatings.map((rating) => [taskRatingKey(rating.challengeId, rating.teamId), rating]),
  );
  const taskRatingSummary = buildTaskRatingSummary(eventRatings);
  const myTeamId = myTeam?.id ?? null;
  const openChallenge = myTeam
    ? eventChallenges.find(
        (challenge) =>
          challenge.status === "open" &&
          (challenge.challengerTeamId === myTeam.id || challenge.opponentTeamId === myTeam.id),
      ) ?? null
    : null;
  const pendingRatingChallenge =
    myTeam && !openChallenge
      ? eventChallenges.find(
          (challenge) =>
            challenge.status !== "open" &&
            challenge.status !== "cancelled" &&
            (challenge.challengerTeamId === myTeam.id || challenge.opponentTeamId === myTeam.id) &&
            !ratingsByChallengeTeam.has(taskRatingKey(challenge.id, myTeam.id)),
        ) ?? null
      : null;
  const activeChallenge = openChallenge ?? pendingRatingChallenge;

  const taskById = new Map(eventTasks.map((task) => [task.id, task]));
  const matchHistory =
    myTeamId === null
      ? []
      : eventChallenges
          .filter(
            (challenge) =>
              challenge.challengerTeamId === myTeamId || challenge.opponentTeamId === myTeamId,
          )
          .map((challenge) => {
            const task = taskById.get(challenge.taskId);
            const opponentTeamId =
              challenge.challengerTeamId === myTeamId
                ? challenge.opponentTeamId
                : challenge.challengerTeamId;
            const myRating = ratingsByChallengeTeam.get(taskRatingKey(challenge.id, myTeamId));
            const opponentRating = ratingsByChallengeTeam.get(
              taskRatingKey(challenge.id, opponentTeamId),
            );

            return {
              id: challenge.id,
              taskId: challenge.taskId,
              taskTitle: task?.title ?? "Task",
              taskType: challenge.type,
              taskImageUrl: task?.imageUrl ?? null,
              challengerTeamId: challenge.challengerTeamId,
              opponentTeamId,
              opponentTeamName:
                eventTeams.find((team) => team.id === opponentTeamId)?.name ??
                eventTeams.find((team) => team.id === opponentTeamId)?.autoName ??
                "Team",
              status: challenge.status,
              result: getMatchHistoryResult({
                status: challenge.status,
                type: challenge.type,
                winnerTeamId: challenge.winnerTeamId,
                myTeamId,
              }),
              wasChallenger: challenge.challengerTeamId === myTeamId,
              winnerTeamId: challenge.winnerTeamId,
              note: challenge.note,
              createdAt: challenge.createdAt,
              resolvedAt: challenge.resolvedAt,
              myRating: myRating?.stars ?? null,
              opponentRating: opponentRating?.stars ?? null,
            };
          });
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
        imageUrl: task.imageUrl,
        type: task.type,
        completionTier: state.completionTier,
        completionSource: state.completionSource,
        winCount: state.winCount,
        lossCount: state.lossCount,
        lastLossOpponentTeamId: state.lastLossOpponentTeamId,
        ratingAverage: taskRatingSummary.get(task.id)?.ratingAverage ?? null,
        ratingCount: taskRatingSummary.get(task.id)?.ratingCount ?? 0,
        canChallenge:
          context.event.status === "live" &&
          !activeChallenge &&
          state.completionTier !== "platinum",
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
          status: activeChallenge.status,
          createdAt: activeChallenge.createdAt,
          resolvedAt: activeChallenge.resolvedAt,
          isResolvableByMe:
            activeChallenge.status === "open" && activeChallenge.challengerTeamId === myTeam?.id,
          canCancelByMe:
            activeChallenge.status === "open" && activeChallenge.challengerTeamId === myTeam?.id,
          canRateByMe:
            activeChallenge.status !== "open" &&
            activeChallenge.status !== "cancelled" &&
            Boolean(myTeamId) &&
            !ratingsByChallengeTeam.has(taskRatingKey(activeChallenge.id, myTeamId ?? "")),
          myRating: myTeamId
            ? (ratingsByChallengeTeam.get(taskRatingKey(activeChallenge.id, myTeamId))?.stars ?? null)
            : null,
        }
      : null,
    matchHistory,
    leaderboard,
  };
}

export async function renameTeam(slug: string, authUserId: string, input: unknown) {
  const parsed = renameTeamSchema.parse(input);
  const context = await getPlayerContext(slug, authUserId);

  if (!context.team) {
    throw new AppError("You are not on a team yet.");
  }

  if (!context.player.isCaptain) {
    throw new AppError("Only the captain can rename the team.", 403);
  }

  if (context.event.status !== "live") {
    throw new AppError("Team names can only be set once the game is live.");
  }

  if (context.team.name) {
    throw new AppError("Team name is locked once it has been chosen.");
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

export async function createChallenge(slug: string, authUserId: string, input: unknown) {
  const parsed = createChallengeSchema.parse(input);
  const context = await getPlayerContext(slug, authUserId);

  if (context.event.status !== "live") {
    throw new AppError("Challenges are only available once the game is live.");
  }

  if (!context.player.teamId) {
    throw new AppError("You are not on a team yet.");
  }

  ensureCustomTeamName(context.team);

  if (parsed.opponentTeamId === context.player.teamId) {
    throw new AppError("Choose another team to challenge.");
  }

  const [task, challengerState, opponentState, opponentTeam, openChallenges] = await Promise.all([
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
    db.query.teams.findFirst({
      where: and(eq(teams.id, parsed.opponentTeamId), eq(teams.gameInstanceId, context.event.id)),
    }),
    db.select().from(challenges).where(eq(challenges.gameInstanceId, context.event.id)),
  ]);

  if (!task || !challengerState || !opponentState || !opponentTeam) {
    throw new AppError("Task or team state not found.", 404);
  }

  ensureChallengeableTeamName(opponentTeam);

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
    if (challengerState.completionTier === "platinum") {
      throw new AppError("Your team has already reached diamond on this task.");
    }

    if (opponentState.completionTier === "platinum") {
      throw new AppError("That team has already reached diamond on this task.");
    }
  }

  if (task.type === "competitive") {
    if (challengerState.completionTier === "platinum") {
      throw new AppError("Your team has already reached diamond on this task.");
    }

    if (opponentState.completionTier === "platinum") {
      throw new AppError("That team has already reached diamond on this task.");
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
  authUserId: string,
  challengeId: string,
  input: unknown,
) {
  const parsed = resolveChallengeSchema.parse(input);
  const context = await getPlayerContext(slug, authUserId);

  if (!context.player.teamId) {
    throw new AppError("You are not on a team yet.");
  }

  ensureCustomTeamName(context.team);

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

    const status = parsed.status ?? "resolved";

    if (
      challenge.type === "competitive" &&
      status === "resolved" &&
      parsed.winnerTeamId !== challenge.challengerTeamId &&
      parsed.winnerTeamId !== challenge.opponentTeamId
    ) {
      throw new AppError("Pick whether your team won or lost.");
    }

    if (challenge.type === "competitive" && status === "failed") {
      throw new AppError("Competitive challenges must be marked as won, lost, or cancelled.");
    }

    if (challenge.type === "cooperative" && parsed.winnerTeamId) {
      throw new AppError("Cooperative challenges do not have a winner.");
    }

    if (status === "cancelled" && parsed.winnerTeamId) {
      throw new AppError("Cancelled challenges cannot have a winner.");
    }

    const winnerTeamId =
      challenge.type === "competitive" && status === "resolved" ? parsed.winnerTeamId ?? null : null;

    const [updated] = await tx
      .update(challenges)
      .set({
        status,
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

export async function rateChallenge(
  slug: string,
  authUserId: string,
  challengeId: string,
  input: unknown,
) {
  const parsed = rateTaskSchema.parse(input);
  const context = await getPlayerContext(slug, authUserId);

  if (!context.player.teamId) {
    throw new AppError("You are not on a team yet.");
  }

  return db.transaction(async (tx) => {
    const challenge = await tx.query.challenges.findFirst({
      where: and(eq(challenges.id, challengeId), eq(challenges.gameInstanceId, context.event.id)),
    });

    if (!challenge) {
      throw new AppError("Challenge not found.", 404);
    }

    if (challenge.status === "open") {
      throw new AppError("Finish or cancel the challenge before rating the task.");
    }

    if (
      challenge.challengerTeamId !== context.player.teamId &&
      challenge.opponentTeamId !== context.player.teamId
    ) {
      throw new AppError("Only teams in the challenge can rate this task.", 403);
    }

    const existingRating = await tx.query.taskRatings.findFirst({
      where: and(
        eq(taskRatings.challengeId, challenge.id),
        eq(taskRatings.teamId, context.player.teamId),
      ),
    });

    if (existingRating) {
      throw new AppError("Your team has already rated this task.");
    }

    const [rating] = await tx
      .insert(taskRatings)
      .values({
        gameInstanceId: context.event.id,
        challengeId: challenge.id,
        taskId: challenge.taskId,
        teamId: context.player.teamId,
        stars: parsed.stars,
      })
      .returning();

    return rating;
  });
}

export async function createTask(slug: string, input: unknown, adminId: string) {
  const parsed = createTaskSchema.parse(input);
  const event = await getEventBySlug(slug);
  const image = normalizeTaskImage(parsed);

  if (event.status === "live" || event.status === "ended") {
    throw new AppError("Tasks can only be added before the game starts.");
  }

  const existingTasks = await db.select().from(tasks).where(eq(tasks.gameInstanceId, event.id));
  const activeTaskCount = existingTasks.filter((task) => task.isActive).length;

  if (parsed.isActive && activeTaskCount >= 16) {
    throw new AppError("Only 16 tasks can be active at a time. Mark another task inactive first.");
  }

  const [task] = await db
    .insert(tasks)
    .values({
      gameInstanceId: event.id,
      title: parsed.title,
      shortDescription: parsed.shortDescription,
      fullDescription: parsed.fullDescription,
      type: parsed.type,
      imagePath: image.imagePath,
      imageUrl: image.imageUrl,
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
  const image = normalizeTaskImage(parsed);
  const task = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), eq(tasks.gameInstanceId, event.id)),
  });

  if (!task) {
    throw new AppError("Task not found", 404);
  }

  if (event.status === "ended") {
    throw new AppError("Ended events are read-only.");
  }

  if (!task.isActive && parsed.isActive) {
    const activeTaskCount = (
      await db
        .select()
        .from(tasks)
        .where(and(eq(tasks.gameInstanceId, event.id), eq(tasks.isActive, true)))
    ).length;

    if (activeTaskCount >= 16) {
      throw new AppError("Only 16 tasks can be active at a time. Mark another task inactive first.");
    }
  }

  const nextValues =
    event.status === "live"
      ? {
          title: parsed.title,
          shortDescription: parsed.shortDescription,
          fullDescription: parsed.fullDescription,
          imagePath: image.imagePath,
          imageUrl: image.imageUrl,
          updatedAt: new Date(),
        }
      : {
          title: parsed.title,
          shortDescription: parsed.shortDescription,
          fullDescription: parsed.fullDescription,
          type: parsed.type,
          imagePath: image.imagePath,
          imageUrl: image.imageUrl,
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

export async function createTaskTemplate(slug: string, input: unknown, adminId: string) {
  const parsed = createTaskTemplateSchema.parse(input);
  const event = await getEventBySlug(slug);
  const image = normalizeTaskImage(parsed);

  const [template] = await db
    .insert(taskTemplates)
    .values({
      title: parsed.title,
      shortDescription: parsed.shortDescription,
      fullDescription: parsed.fullDescription,
      type: parsed.type,
      imagePath: image.imagePath,
      imageUrl: image.imageUrl,
    })
    .returning();

  await writeAuditLog(db, {
    adminId,
    gameInstanceId: event.id,
    actionType: "create_task_template",
    entityType: "task_template",
    entityId: template.id,
    afterJson: template,
  });

  return mapTaskTemplate(template);
}

export async function listTaskTemplates() {
  const templates = await db.select().from(taskTemplates).orderBy(desc(taskTemplates.updatedAt));
  return templates.map(mapTaskTemplate);
}

export async function saveTaskAsTemplate(
  slug: string,
  taskId: string,
  adminId: string,
  titleOverride?: string,
) {
  const event = await getEventBySlug(slug);
  const task = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), eq(tasks.gameInstanceId, event.id)),
  });

  if (!task) {
    throw new AppError("Task not found", 404);
  }

  const [template] = await db
    .insert(taskTemplates)
    .values({
      title: titleOverride?.trim() || task.title,
      shortDescription: task.shortDescription,
      fullDescription: task.fullDescription,
      type: task.type,
      imagePath: task.imagePath,
      imageUrl: task.imageUrl,
    })
    .returning();

  await writeAuditLog(db, {
    adminId,
    gameInstanceId: event.id,
    actionType: "save_task_as_template",
    entityType: "task_template",
    entityId: template.id,
    beforeJson: task,
    afterJson: template,
  });

  return mapTaskTemplate(template);
}

export async function createTaskFromTemplate(slug: string, input: unknown, adminId: string) {
  const parsed = createTaskFromTemplateSchema.parse(input);
  const event = await getEventBySlug(slug);

  if (event.status === "live" || event.status === "ended") {
    throw new AppError("Tasks can only be added before the game starts.");
  }

  const template = await db.query.taskTemplates.findFirst({
    where: eq(taskTemplates.id, parsed.templateId),
  });

  if (!template) {
    throw new AppError("Task template not found", 404);
  }

  const existingTasks = await db.select().from(tasks).where(eq(tasks.gameInstanceId, event.id));
  const activeTaskCount = existingTasks.filter((task) => task.isActive).length;

  if (parsed.isActive && activeTaskCount >= 16) {
    throw new AppError("Only 16 tasks can be active at a time. Mark another task inactive first.");
  }

  const [task] = await db
    .insert(tasks)
    .values({
      gameInstanceId: event.id,
      title: template.title,
      shortDescription: template.shortDescription,
      fullDescription: template.fullDescription,
      type: template.type,
      imagePath: template.imagePath,
      imageUrl: template.imageUrl,
      isActive: parsed.isActive,
      sortOrder: existingTasks.length,
    })
    .returning();

  await writeAuditLog(db, {
    adminId,
    gameInstanceId: event.id,
    actionType: "create_task_from_template",
    entityType: "task",
    entityId: task.id,
    afterJson: { ...task, templateId: template.id },
  });

  return task;
}

async function loadLaunchInputs(eventId: string) {
  const [registrations, activeTasks, existingTeams] = await Promise.all([
    db
      .select()
      .from(playerRegistrations)
      .where(eq(playerRegistrations.gameInstanceId, eventId))
      .orderBy(asc(playerRegistrations.createdAt)),
    db
      .select()
      .from(tasks)
      .where(and(eq(tasks.gameInstanceId, eventId), eq(tasks.isActive, true)))
      .orderBy(asc(tasks.sortOrder)),
    db.select().from(teams).where(eq(teams.gameInstanceId, eventId)),
  ]);

  return { registrations, activeTasks, existingTeams };
}

function validateLaunchInputs(
  event: Awaited<ReturnType<typeof getEventBySlug>>,
  registrations: PlayerRegistrationRecord[],
  activeTasks: TaskRecord[],
) {
  if (registrations.length < 2) {
    throw new AppError("At least 2 players are required to start the game.");
  }

  if (Math.ceil(registrations.length / event.targetTeamSize) < 2) {
    throw new AppError("The current team size would create fewer than 2 teams.");
  }

  if (activeTasks.length !== 16) {
    throw new AppError("Exactly 16 active tasks are required before the game can start.");
  }
}

async function launchLiveGame(
  executor: any,
  event: Awaited<ReturnType<typeof getEventBySlug>>,
  registrations: PlayerRegistrationRecord[],
  activeTasks: TaskRecord[],
) {
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
    const [team] = await executor
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

    await executor
      .update(playerRegistrations)
      .set({
        teamId: team.id,
        isCaptain: false,
      })
      .where(inArray(playerRegistrations.id, plannedTeam.playerIds));

    await executor
      .update(playerRegistrations)
      .set({
        isCaptain: true,
      })
      .where(eq(playerRegistrations.id, plannedTeam.captainPlayerId));

    await executor
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

  await executor.insert(teamTaskStates).values(
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

  const [updatedEvent] = await executor
    .update(gameInstances)
    .set({
      status: "live",
      startedAt: new Date(),
      endedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(gameInstances.id, event.id))
    .returning();

  return updatedEvent;
}

export async function startGame(slug: string, adminId: string) {
  const event = await getEventBySlug(slug);

  if (event.status !== "registration_open") {
    throw new AppError("Open registration before starting the game.");
  }

  const { registrations, activeTasks, existingTeams } = await loadLaunchInputs(event.id);

  if (existingTeams.length > 0) {
    throw new AppError("This event has already been started.");
  }

  validateLaunchInputs(event, registrations, activeTasks);

  return db.transaction(async (tx) => {
    const updatedEvent = await launchLiveGame(tx, event, registrations, activeTasks);

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

export async function restartGame(slug: string, adminId: string) {
  const event = await getEventBySlug(slug);

  if (event.status !== "live" && event.status !== "ended") {
    throw new AppError("Only live or ended events can be restarted.");
  }

  const { registrations, activeTasks } = await loadLaunchInputs(event.id);
  validateLaunchInputs(event, registrations, activeTasks);

  return db.transaction(async (tx) => {
    await tx
      .update(playerRegistrations)
      .set({
        teamId: null,
        isCaptain: false,
      })
      .where(eq(playerRegistrations.gameInstanceId, event.id));

    await tx.delete(teams).where(eq(teams.gameInstanceId, event.id));

    const updatedEvent = await launchLiveGame(tx, event, registrations, activeTasks);

    await writeAuditLog(tx, {
      adminId,
      gameInstanceId: event.id,
      actionType: "restart_game",
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

    if (challenge.type === "competitive" && parsed.status === "failed") {
      throw new AppError("Competitive challenges cannot be marked as failed.");
    }

    if (parsed.status === "cancelled" && parsed.winnerTeamId) {
      throw new AppError("Cancelled challenges cannot have a winner.");
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
        resolvedAt: parsed.status === "cancelled" ? null : new Date(),
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

export async function removePlayerRegistration(
  slug: string,
  playerId: string,
  adminId: string,
) {
  const event = await getEventBySlug(slug);

  if (event.status !== "draft" && event.status !== "registration_open") {
    throw new AppError("Players can only be removed before the game starts.");
  }

  return db.transaction(async (tx) => {
    const player = await tx.query.playerRegistrations.findFirst({
      where: and(
        eq(playerRegistrations.id, playerId),
        eq(playerRegistrations.gameInstanceId, event.id),
      ),
    });

    if (!player) {
      throw new AppError("Player not found.", 404);
    }

    await tx.delete(playerRegistrations).where(eq(playerRegistrations.id, player.id));

    await writeAuditLog(tx, {
      adminId,
      gameInstanceId: event.id,
      actionType: "remove_registration",
      entityType: "player_registration",
      entityId: player.id,
      beforeJson: player,
    });

    return {
      playerId: player.id,
    };
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
  const [eventTeams, registrations, eventTasks, eventChallenges, eventRatings, auditRows, templates] =
    await Promise.all([
    db.select().from(teams).where(eq(teams.gameInstanceId, event.id)).orderBy(asc(teams.createdAt)),
    db
      .select()
      .from(playerRegistrations)
      .where(eq(playerRegistrations.gameInstanceId, event.id))
      .orderBy(asc(playerRegistrations.createdAt)),
    db.select().from(tasks).where(eq(tasks.gameInstanceId, event.id)).orderBy(asc(tasks.sortOrder)),
    db.select().from(challenges).where(eq(challenges.gameInstanceId, event.id)).orderBy(desc(challenges.createdAt)),
    db.select().from(taskRatings).where(eq(taskRatings.gameInstanceId, event.id)),
    db
      .select()
      .from(adminAuditLogs)
      .where(eq(adminAuditLogs.gameInstanceId, event.id))
        .orderBy(desc(adminAuditLogs.createdAt)),
      listTaskTemplates(),
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
  const taskRatingSummary = buildTaskRatingSummary(eventRatings);

  return {
    event,
    registrations,
    tasks: eventTasks.map((task) => ({
      ...task,
      ratingAverage: taskRatingSummary.get(task.id)?.ratingAverage ?? null,
      ratingCount: taskRatingSummary.get(task.id)?.ratingCount ?? 0,
    })),
    templates,
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
