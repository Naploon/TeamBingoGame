const requiredKeys = [
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SESSION_SECRET",
  "NEXT_PUBLIC_APP_URL",
] as const;

type EnvKey = (typeof requiredKeys)[number];

function readEnv(key: EnvKey) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
}

export const env = {
  databaseUrl: () => readEnv("DATABASE_URL"),
  supabaseUrl: () => readEnv("NEXT_PUBLIC_SUPABASE_URL"),
  supabasePublishableKey: () =>
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    (() => {
      throw new Error(
        "Missing environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
      );
    })(),
  supabaseServiceRoleKey: () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  sessionSecret: () => readEnv("SESSION_SECRET"),
  appUrl: () => readEnv("NEXT_PUBLIC_APP_URL"),
  adminAllowlist: () =>
    (process.env.ADMIN_ALLOWLIST ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
};
