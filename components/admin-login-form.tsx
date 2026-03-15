"use client";

import { useState } from "react";
import type { FormEvent } from "react";

import { Button, Input, Panel, SectionHeading } from "@/components/ui";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=/admin`;
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (authError) {
        throw authError;
      }

      setMessage("Magic link sent. Open it on this device to continue.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Panel className="mx-auto max-w-lg">
      <SectionHeading
        eyebrow="Admin"
        title="Sign in with a magic link"
        description="Only allowlisted organizer emails can open the dashboard."
      />
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-2 text-sm font-medium text-ink">
          <span>Email address</span>
          <Input
            type="email"
            placeholder="organizer@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        {message ? <p className="text-sm text-sea">{message}</p> : null}
        {error ? <p className="text-sm text-coral">{error}</p> : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Sending..." : "Send magic link"}
        </Button>
      </form>
    </Panel>
  );
}
