import { randomBytes } from "crypto";

import { clsx, type ClassValue } from "clsx";

const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function formatJoinCode(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => JOIN_CODE_ALPHABET[byte % JOIN_CODE_ALPHABET.length]).join("");
}

export function generateJoinCode() {
  return formatJoinCode(randomBytes(6));
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) {
    return "Not set";
  }

  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
