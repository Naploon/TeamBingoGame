import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { adminUsers } from "@/lib/db/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function normalizeAdminEmail(email: string) {
  return email.trim().toLowerCase();
}

async function getActiveAdminAccount(email: string) {
  const emailKey = normalizeAdminEmail(email);

  if (!emailKey) {
    return null;
  }

  return db.query.adminUsers.findFirst({
    where: and(eq(adminUsers.emailKey, emailKey), eq(adminUsers.isActive, true)),
    columns: {
      id: true,
      email: true,
    },
  });
}

export async function canAdminSignIn(email: string) {
  return Boolean(await getActiveAdminAccount(email));
}

export async function getAdminUser() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return null;
  }

  const adminAccount = await getActiveAdminAccount(user.email);
  if (!adminAccount) {
    return null;
  }

  return user;
}

export async function requireAdminUser() {
  const user = await getAdminUser();

  if (!user) {
    redirect("/admin/login");
  }

  return user;
}
