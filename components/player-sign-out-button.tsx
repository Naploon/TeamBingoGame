"use client";

import { useState } from "react";

import { Button } from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function PlayerSignOutButton({
  redirectTo = "/",
  tone = "ghost",
}: {
  redirectTo?: string;
  tone?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignOut() {
    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      window.location.assign(redirectTo);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Button type="button" tone={tone} onClick={handleSignOut} disabled={isSubmitting}>
      {isSubmitting ? "Signing out..." : "Sign out"}
    </Button>
  );
}
