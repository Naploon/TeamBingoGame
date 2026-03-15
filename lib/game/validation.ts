import { z } from "zod";

export const registerPlayerSchema = z.object({
  displayName: z.string().trim().min(2).max(32),
});

export const createEventSchema = z.object({
  title: z.string().trim().min(3).max(80),
  targetTeamSize: z.coerce.number().int().min(1).max(10),
});

export const updateEventSchema = z.object({
  title: z.string().trim().min(3).max(80),
  targetTeamSize: z.coerce.number().int().min(1).max(10),
  status: z.enum(["draft", "registration_open", "live", "ended"]).optional(),
});

const taskImageSchema = z.object({
  imagePath: z.string().trim().min(1).max(500).nullable().optional(),
  imageUrl: z.string().trim().url().max(1000).nullable().optional(),
});

export const createTaskSchema = z
  .object({
  title: z.string().trim().min(3).max(80),
  shortDescription: z.string().trim().min(4).max(120),
  fullDescription: z.string().trim().min(10).max(1200),
  type: z.enum(["competitive", "cooperative"]),
  isActive: z.coerce.boolean().default(true),
  })
  .merge(taskImageSchema);

export const createTaskTemplateSchema = z
  .object({
    title: z.string().trim().min(3).max(80),
    shortDescription: z.string().trim().min(4).max(120),
    fullDescription: z.string().trim().min(10).max(1200),
    type: z.enum(["competitive", "cooperative"]),
  })
  .merge(taskImageSchema);

export const createTaskFromTemplateSchema = z.object({
  templateId: z.string().uuid(),
  isActive: z.coerce.boolean().default(true),
});

export const renameTeamSchema = z.object({
  teamName: z.string().trim().min(2).max(40),
});

export const createChallengeSchema = z.object({
  taskId: z.string().uuid(),
  opponentTeamId: z.string().uuid(),
});

export const resolveChallengeSchema = z.object({
  winnerTeamId: z.string().uuid().optional(),
  note: z.string().trim().max(300).optional(),
  status: z.enum(["resolved", "failed", "cancelled"]).optional(),
});

export const rateTaskSchema = z.object({
  stars: z.coerce.number().min(0.5).max(5).multipleOf(0.5),
});

export const overrideChallengeSchema = z.object({
  winnerTeamId: z.string().uuid().nullable(),
  note: z.string().trim().max(300).optional(),
  status: z.enum(["resolved", "failed", "cancelled"]).default("resolved"),
});

export const switchCaptainSchema = z.object({
  playerId: z.string().uuid(),
  teamId: z.string().uuid(),
});
