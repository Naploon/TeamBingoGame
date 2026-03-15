import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env } from "@/lib/env";

export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(env.supabaseUrl(), env.supabasePublishableKey(), {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        try {
          cookieStore.set(name, value, options);
        } catch {
          // Server Components can read cookies but cannot mutate them.
        }
      },
      remove(name, options) {
        try {
          cookieStore.set(name, "", {
            ...options,
            maxAge: 0,
          });
        } catch {
          // Server Components can read cookies but cannot mutate them.
        }
      },
    },
  });
}
