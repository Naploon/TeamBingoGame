import type { User } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type AuthenticatedPlayerUser = User & {
  email: string;
};

export async function getPlayerAuthUser(): Promise<AuthenticatedPlayerUser | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return null;
  }

  return user as AuthenticatedPlayerUser;
}
