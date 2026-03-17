import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const gameStatusEnum = pgEnum("game_status", [
  "draft",
  "registration_open",
  "live",
  "ended",
]);

export const taskTypeEnum = pgEnum("task_type", ["competitive", "cooperative"]);

export const challengeStatusEnum = pgEnum("challenge_status", [
  "open",
  "resolved",
  "failed",
  "cancelled",
]);

export const completionTierEnum = pgEnum("completion_tier", [
  "none",
  "base",
  "gold",
  "platinum",
]);

export const completionSourceEnum = pgEnum("completion_source", [
  "none",
  "win",
  "loss_protection",
  "cooperative",
]);

export const gameInstances = pgTable(
  "game_instances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    joinCode: text("join_code").notNull(),
    title: text("title").notNull(),
    status: gameStatusEnum("status").notNull().default("draft"),
    targetTeamSize: integer("target_team_size").notNull().default(4),
    seed: integer("seed").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex("game_instances_slug_idx").on(table.slug),
    joinCodeIdx: uniqueIndex("game_instances_join_code_idx").on(table.joinCode),
  }),
);

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameInstanceId: uuid("game_instance_id")
      .notNull()
      .references(() => gameInstances.id, { onDelete: "cascade" }),
    name: text("name"),
    nameKey: text("name_key"),
    autoName: text("auto_name").notNull(),
    captainPlayerId: uuid("captain_player_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueNameIdx: uniqueIndex("teams_game_name_idx").on(table.gameInstanceId, table.nameKey),
  }),
);

export const playerRegistrations = pgTable(
  "player_registrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameInstanceId: uuid("game_instance_id")
      .notNull()
      .references(() => gameInstances.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    authUserId: text("auth_user_id"),
    email: text("email"),
    displayName: text("display_name").notNull(),
    displayNameKey: text("display_name_key").notNull(),
    isCaptain: boolean("is_captain").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniquePlayerNameIdx: uniqueIndex("player_registrations_game_display_name_idx").on(
      table.gameInstanceId,
      table.displayNameKey,
    ),
    uniquePlayerAuthUserIdx: uniqueIndex("player_registrations_game_auth_user_idx").on(
      table.gameInstanceId,
      table.authUserId,
    ),
  }),
);

export const playerSessions = pgTable(
  "player_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameInstanceId: uuid("game_instance_id")
      .notNull()
      .references(() => gameInstances.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => playerRegistrations.id, { onDelete: "cascade" }),
    sessionToken: text("session_token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sessionTokenIdx: uniqueIndex("player_sessions_session_token_idx").on(table.sessionToken),
  }),
);

export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    emailKey: text("email_key").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailKeyIdx: uniqueIndex("admin_users_email_key_idx").on(table.emailKey),
  }),
);

export const taskTemplates = pgTable("task_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  shortDescription: text("short_description").notNull(),
  fullDescription: text("full_description").notNull(),
  type: taskTypeEnum("type").notNull(),
  imagePath: text("image_path"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameInstanceId: uuid("game_instance_id")
    .notNull()
    .references(() => gameInstances.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  shortDescription: text("short_description").notNull(),
  fullDescription: text("full_description").notNull(),
  type: taskTypeEnum("type").notNull(),
  imagePath: text("image_path"),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teamTaskStates = pgTable(
  "team_task_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    boardPosition: integer("board_position").notNull(),
    completionTier: completionTierEnum("completion_tier").notNull().default("none"),
    completionSource: completionSourceEnum("completion_source").notNull().default("none"),
    winCount: integer("win_count").notNull().default(0),
    lossCount: integer("loss_count").notNull().default(0),
    lastLossOpponentTeamId: uuid("last_loss_opponent_team_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueTeamTaskIdx: uniqueIndex("team_task_states_team_task_idx").on(table.teamId, table.taskId),
  }),
);

export const challenges = pgTable("challenges", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameInstanceId: uuid("game_instance_id")
    .notNull()
    .references(() => gameInstances.id, { onDelete: "cascade" }),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  challengerTeamId: uuid("challenger_team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  opponentTeamId: uuid("opponent_team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  type: taskTypeEnum("type").notNull(),
  status: challengeStatusEnum("status").notNull().default("open"),
  submittedByPlayerId: uuid("submitted_by_player_id")
    .notNull()
    .references(() => playerRegistrations.id, { onDelete: "cascade" }),
  winnerTeamId: uuid("winner_team_id"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const taskRatings = pgTable(
  "task_ratings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameInstanceId: uuid("game_instance_id")
      .notNull()
      .references(() => gameInstances.id, { onDelete: "cascade" }),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    stars: real("stars").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueChallengeTeamIdx: uniqueIndex("task_ratings_challenge_team_idx").on(
      table.challengeId,
      table.teamId,
    ),
  }),
);

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminId: text("admin_id").notNull(),
  gameInstanceId: uuid("game_instance_id")
    .notNull()
    .references(() => gameInstances.id, { onDelete: "cascade" }),
  actionType: text("action_type").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  beforeJson: jsonb("before_json"),
  afterJson: jsonb("after_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GameInstanceRecord = typeof gameInstances.$inferSelect;
export type TeamRecord = typeof teams.$inferSelect;
export type PlayerRegistrationRecord = typeof playerRegistrations.$inferSelect;
export type PlayerSessionRecord = typeof playerSessions.$inferSelect;
export type AdminUserRecord = typeof adminUsers.$inferSelect;
export type TaskTemplateRecord = typeof taskTemplates.$inferSelect;
export type TaskRecord = typeof tasks.$inferSelect;
export type TeamTaskStateRecord = typeof teamTaskStates.$inferSelect;
export type ChallengeRecord = typeof challenges.$inferSelect;
export type TaskRatingRecord = typeof taskRatings.$inferSelect;
